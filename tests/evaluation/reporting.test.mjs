import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openEvaluationRuntime} from '../../server/evaluation/runtime.mjs';
import {buildEvaluationSnapshot,createEvaluationReporting,evaluationReportingSchemaSql,snapshotToSql} from '../../server/evaluation/reporting.mjs';

async function fixture(fn){const directory=await mkdtemp(join(tmpdir(),'tikdam-report-'));const r=await openEvaluationRuntime({persistPath:directory});try{await r.db.batch(evaluationReportingSchemaSql.split(';').map(s=>s.trim()).filter(Boolean).map(s=>r.db.prepare(s)));await fn(r);}finally{await r.close();await rm(directory,{recursive:true,force:true});}}
const request={id:'synthetic-report-operation',provider:'meta',operation:'chat',fixtureId:'synthetic-invoice-fixture',ceilingMicrousd:30100,maxAttempts:2,priceVersion:'meta-standard-2026-11-01.1'};
async function snapshot(ledger,generatedAt='2026-11-02T00:00:00.000Z') {return buildEvaluationSnapshot(await ledger.summary(),await ledger.rows(),{generatedAt});}

test('sanitized snapshot contains aggregate use and no invoice/prompt/request details',()=>fixture(async({ledger})=>{
 await ledger.reserve(request);await ledger.recordAttempt({reservationId:request.id,kind:'preflight'});await ledger.recordAttempt({reservationId:request.id,kind:'generation'});await ledger.settle({reservationId:request.id,status:'succeeded',estimatedMicrousd:1500,inputTokens:800,outputTokens:100});
 const rows=await ledger.rows();rows.reservations[0].prompt='PRIVATE_PROMPT_CANARY';rows.reservations[0].invoiceNumber='PRIVATE_INVOICE_CANARY';
 const s=buildEvaluationSnapshot(await ledger.summary(),rows,{generatedAt:'2026-11-02T00:00:00.000Z'});assert.equal(s.providers.meta.attempts,2);assert.equal(s.providers.meta.attemptsByKind.generation,1);assert.equal(s.providers.meta.attemptsByKind.preflight,1);assert.equal(s.providers.meta.inputTokens,800);assert.equal(s.providers.meta.spentMicrousd,1500);assert.deepEqual(s.providers.meta.priceVersions,['meta-standard-2026-11-01.1']);assert.equal(s.scope,'evaluation_only');
 const serialized=JSON.stringify(s);for(const secret of ['PRIVATE_PROMPT_CANARY','PRIVATE_INVOICE_CANARY',request.id,request.fixtureId])assert.equal(serialized.includes(secret),false);
}));

test('missing report is null and imported report is separate from production operational tables',()=>fixture(async({ledger,db})=>{
 const store=createEvaluationReporting(db);assert.equal(await store.latest(),null);const s=await snapshot(ledger);assert.equal((await store.importSnapshot(s)).imported,true);assert.deepEqual(await store.latest(),s);assert.equal((await db.prepare("SELECT COUNT(*) n FROM sqlite_master WHERE name='ai_reservations'").first()).n,0);
}));

test('snapshot import rejects unknown fields and wrong caps rather than storing payloads',()=>fixture(async({ledger,db})=>{
 const s=await snapshot(ledger),store=createEvaluationReporting(db);await assert.rejects(store.importSnapshot({...s,prompt:'PRIVATE'}));await assert.rejects(store.importSnapshot({...s,providers:{...s.providers,meta:{...s.providers.meta,capMicrousd:5000000}}}));assert.equal(await store.latest(),null);
}));

test('older or reset aggregate snapshots cannot overwrite a newer report',()=>fixture(async({ledger,db})=>{
 const store=createEvaluationReporting(db);const empty=await snapshot(ledger,'2026-11-02T00:00:00.000Z');await ledger.reserve(request);await ledger.recordAttempt({reservationId:request.id,kind:'generation'});await ledger.settle({reservationId:request.id,status:'succeeded',estimatedMicrousd:1500,inputTokens:800,outputTokens:100});const current=await snapshot(ledger,'2026-11-02T01:00:00.000Z');await store.importSnapshot(current);
 assert.equal((await store.importSnapshot(empty)).imported,false);assert.equal((await store.importSnapshot({...empty,generatedAt:'2026-11-02T02:00:00.000Z'})).imported,false);assert.deepEqual(await store.latest(),current);
}));

test('offline SQL export imports only the strictly validated aggregate snapshot',()=>fixture(async({ledger,db})=>{
 const s=await snapshot(ledger);const sql=snapshotToSql(s);assert.equal(sql.includes('DROP '),false);assert.equal(sql.includes('ai_reservations'),false);await db.prepare(sql).run();assert.deepEqual(await createEvaluationReporting(db).latest(),s);assert.throws(()=>snapshotToSql({...s,payload:'PRIVATE'}));
}));
