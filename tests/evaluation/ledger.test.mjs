import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openEvaluationRuntime} from '../../server/evaluation/runtime.mjs';
import {createEvaluationLedger} from '../../server/evaluation/ledger.mjs';

async function fixture(fn){const directory=await mkdtemp(join(tmpdir(),'tikdam-eval-ledger-'));const r=await openEvaluationRuntime({persistPath:directory});try{await fn(r,directory);}finally{await r.close();await rm(directory,{recursive:true,force:true});}}
const request=(extra={})=>({id:crypto.randomUUID(),provider:'meta',operation:'chat',fixtureId:'synthetic-fixture-1',ceilingMicrousd:30100,maxAttempts:2,priceVersion:'verified-test-v1',...extra});

test('fresh campaign has exact provider and aggregate ceilings and init never resets pauses',()=>fixture(async({ledger})=>{
 const s=await ledger.summary();assert.equal(s.campaignId,'tikdam-v1-eval-2026-11-01');assert.equal(s.combined.capMicrousd,4000000);assert.equal(s.providers.meta.capMicrousd,3000000);assert.equal(s.providers.meta.operatingStopMicrousd,2700000);assert.equal(s.providers.modal.capMicrousd,500000);assert.equal(s.providers.baseten.operatingStopMicrousd,450000);
 await ledger.pause('meta','AUTH_REJECTED');await ledger.init();assert.equal((await ledger.summary()).providers.meta.paused,true);
}));

test('simultaneous cross-provider admission allows only one billable operation',()=>fixture(async({ledger})=>{
 const results=await Promise.all([ledger.reserve(request()),ledger.reserve(request({provider:'baseten'})),ledger.reserve(request({provider:'modal'}))]);assert.equal(results.filter(x=>x.admitted).length,1);assert.equal((await ledger.summary()).inFlight,1);
}));

test('sent attempts count once before fetch and unsent reserved slots release on settlement',()=>fixture(async({ledger})=>{
 const r=request();assert.equal((await ledger.reserve(r)).admitted,true);let s=await ledger.summary();assert.equal(s.providers.meta.attempts,0);assert.equal(s.providers.meta.reservedAttempts,2);
 assert.equal((await ledger.recordAttempt({reservationId:r.id,kind:'preflight'})).admitted,true);
 s=await ledger.summary();assert.equal(s.providers.meta.attempts,1);assert.equal(s.providers.meta.reservedAttempts,1);
 await ledger.settle({reservationId:r.id,status:'unbilled'});s=await ledger.summary();assert.equal(s.providers.meta.attempts,1);assert.equal(s.providers.meta.reservedAttempts,0);assert.equal(s.providers.meta.reservedMicrousd,0);
 assert.equal((await ledger.recordAttempt({reservationId:r.id,kind:'generation'})).admitted,false);
}));

test('reused operation IDs are denied and altered metadata is an idempotency conflict',()=>fixture(async({ledger})=>{
 const r=request();await ledger.reserve(r);await ledger.settle({reservationId:r.id,status:'unbilled'});
 assert.equal((await ledger.reserve(r)).reason,'ALREADY_PROCESSED');assert.equal((await ledger.reserve({...r,fixtureId:'other-fixture'})).reason,'IDEMPOTENCY_CONFLICT');
}));

test('unknown billing holds cost and pauses provider even across init',()=>fixture(async({ledger})=>{
 const r=request();await ledger.reserve(r);await ledger.recordAttempt({reservationId:r.id,kind:'generation'});await ledger.settle({reservationId:r.id,status:'billing_unknown',errorCode:'TIMEOUT'});await ledger.init();
 const s=await ledger.summary();assert.equal(s.providers.meta.reservedMicrousd,30100);assert.equal(s.providers.meta.paused,true);assert.equal(s.inFlight,0);assert.equal((await ledger.reserve(request())).reason,'PROVIDER_PAUSED');assert.equal((await ledger.reserve(request({provider:'baseten'}))).admitted,true);
}));

test('settlement cannot exceed reservation or mutate successful recorded cost',()=>fixture(async({ledger})=>{
 const r=request();await ledger.reserve(r);await assert.rejects(ledger.settle({reservationId:r.id,status:'succeeded',estimatedMicrousd:30101}),/ceiling|reservation/i);
 await ledger.settle({reservationId:r.id,status:'succeeded',estimatedMicrousd:2000,inputTokens:1000,outputTokens:100});
 await ledger.settle({reservationId:r.id,status:'succeeded',estimatedMicrousd:2000,inputTokens:1000,outputTokens:100});
 await assert.rejects(ledger.settle({reservationId:r.id,status:'succeeded',estimatedMicrousd:0,inputTokens:0,outputTokens:0}),/settled|immutable/i);
 const s=await ledger.summary();assert.equal(s.providers.meta.spentMicrousd,2000);assert.equal(s.providers.meta.reservedMicrousd,0);
}));

test('soft stops reserve worst case and the provider caps cannot borrow from another',()=>fixture(async({ledger})=>{
 for(const provider of ['modal','baseten']){const r=request({provider,ceilingMicrousd:440000,maxAttempts:1});assert.equal((await ledger.reserve(r)).admitted,true);await ledger.settle({reservationId:r.id,status:'succeeded',estimatedMicrousd:440000});assert.equal((await ledger.reserve(request({provider,ceilingMicrousd:10001}))).admitted,false);}
 const s=await ledger.summary();assert.equal(s.combined.spentMicrousd,880000);assert.equal(s.providers.meta.spentMicrousd,0);
}));

test('Meta 999/1000/1001 attempts cannot be bypassed with concurrent admissions',()=>fixture(async({ledger,db})=>{
 const r=request({maxAttempts:1000,ceilingMicrousd:0});await ledger.reserve(r);
 const statements=Array.from({length:999},(_,i)=>db.prepare("INSERT INTO evaluation_attempts(id,reservation_id,kind,created_at) VALUES(?,?,?,?)").bind(crypto.randomUUID(),r.id,'metadata',new Date().toISOString()));
 await db.batch(statements);await ledger.settle({reservationId:r.id,status:'unbilled'});
 assert.equal((await ledger.reserve(request({maxAttempts:2,ceilingMicrousd:0}))).reason,'ATTEMPT_LIMIT');
 const last=request({maxAttempts:1,ceilingMicrousd:0});assert.equal((await ledger.reserve(last)).admitted,true);
 const attempts=await Promise.all([ledger.recordAttempt({reservationId:last.id,kind:'metadata'}),ledger.recordAttempt({reservationId:last.id,kind:'metadata'})]);assert.equal(attempts.filter(x=>x.admitted).length,1);
 await ledger.settle({reservationId:last.id,status:'unbilled'});assert.equal((await ledger.summary()).providers.meta.attempts,1000);assert.equal((await ledger.reserve(request({maxAttempts:1,ceilingMicrousd:0}))).reason,'ATTEMPT_LIMIT');
}));

test('global pause stops reserved sends and persists through reinitialization',()=>fixture(async({ledger})=>{
 const r=request();await ledger.reserve(r);await ledger.pause('*','OPERATOR_STOP');assert.equal((await ledger.recordAttempt({reservationId:r.id,kind:'preflight'})).admitted,false);await ledger.init();assert.equal((await ledger.reserve(request({provider:'modal'}))).reason,'CAMPAIGN_PAUSED');
}));

test('real persisted D1 survives close/reopen with its cost, attempts and in-flight lock intact',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'tikdam-eval-reopen-'));let runtime=await openEvaluationRuntime({persistPath:directory});
 try{const r=request();await runtime.ledger.reserve(r);await runtime.ledger.recordAttempt({reservationId:r.id,kind:'preflight'});await runtime.close();runtime=await openEvaluationRuntime({persistPath:directory});const s=await runtime.ledger.summary();assert.equal(s.providers.meta.attempts,1);assert.equal(s.providers.meta.reservedMicrousd,30100);assert.equal(s.inFlight,1);assert.equal((await runtime.ledger.reserve(request())).reason,'IN_FLIGHT');await runtime.ledger.settle({reservationId:r.id,status:'billing_unknown'});}
 finally{await runtime.close();await rm(directory,{recursive:true,force:true});}
});

test('strict schemas reject unsafe costs, arbitrary providers and payload fields',()=>fixture(async({ledger})=>{
 for(const change of [{ceilingMicrousd:-1},{ceilingMicrousd:1.5},{ceilingMicrousd:Number.MAX_SAFE_INTEGER+1},{provider:'other'},{maxAttempts:1001},{documentText:'PRIVATE_PAYLOAD'}])await assert.rejects(ledger.reserve(request(change)));
 const rows=await ledger.rows();assert.deepEqual(rows.reservations,[]);assert.deepEqual(rows.attempts,[]);
}));
