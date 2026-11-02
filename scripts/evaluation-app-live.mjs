// Private API integration check. Only Meta requests are real; Turnstile is simulated.
// No public AI switches, remote D1 databases, or provider pauses are changed.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {randomUUID, randomBytes} from 'node:crypto';
import Decimal from 'decimal.js';
import {createHandler} from '../worker/index.mjs';
import {createAiService} from '../server/ai/service.mjs';
import {createRepository} from '../server/data/repository.mjs';
import {openEvaluationRuntime} from '../server/evaluation/runtime.mjs';
import {buildLiveCases, purchaseFacts, scenarios, runScenario} from '../tests/fixtures/evaluation/manifest.mjs';

const argv=process.argv.slice(2);
const option=(name,fallback)=>argv.includes(name)?argv[argv.indexOf(name)+1]:fallback;
const stateDir=option('--state-dir',null),tag=option('--run-tag','app-api-v1');
if(!stateDir||!/^[a-zA-Z0-9._-]{1,40}$/.test(tag))throw Error('Provide --state-dir for the existing campaign and a safe --run-tag.');
const persistPath=path.resolve(stateDir,'evaluation-d1');
await fs.access(persistPath); // Never silently create a replacement campaign.
const fixtures=await buildLiveCases();
const allowed=['live-intake-in','live-image-ordinary','live-pdf-ordinary','live-explain-gb','live-client-gb'];
const requested=option('--cases',allowed.join(',')).split(',');
if(!requested.length||new Set(requested).size!==requested.length||requested.some(id=>!allowed.includes(id)))throw Error('Choose unique cases from the supported app API suite.');
const selected=requested.map(id=>fixtures.find(x=>x.id===id));
const runtime=await openEvaluationRuntime({persistPath});
const report={scope:'private_api_integration',turnstile:'simulated',browserTested:false,provider:'Meta Model API',model:'muse-spark-1.3',tag,startedAt:new Date().toISOString(),checks:[],cases:[],before:await runtime.ledger.summary()};
let repository,active,attempts=0;
try{
 if(!argv.includes('--live')){
  console.log(JSON.stringify({mode:'dry_run',cases:selected.map(x=>x.id),maximumBatchMicrousd:selected.length*30100,summary:report.before},null,2));
 }else{
  const key=process.env.META_MODEL_API_KEY||process.env.MODEL_API_KEY;
  if(!key)throw Error('Meta credentials missing.');
  assert.equal(scenarios.length,1000);
  for(const scenario of scenarios)await runScenario(scenario);
  report.checks.push('1000 offline evaluation cases');
  if(report.before.paused||report.before.providers.meta.paused||report.before.inFlight||report.before.providers.meta.operatingRemainingMicrousd<selected.length*30100)throw Error('Existing campaign cannot admit this batch.');
  const previous=(await runtime.ledger.rows()).reservations;
  if(previous.some(x=>x.id.startsWith(`app-api:${tag}:`)))throw Error('This run tag already has activity. Review its saved results before starting another batch.');
  const migration=await fs.readFile(new URL('../migrations/0001_operations.sql',import.meta.url),'utf8');
  await runtime.db.batch(migration.split(';').map(x=>x.trim()).filter(Boolean).map(x=>runtime.db.prepare(x)));
  repository=createRepository(runtime.db);
  await repository.updateSettings({actor:'private-api-evaluation',patch:{aiEnabled:true}});
  const wrapped={...repository,
   async reserveAiCall(input){
    const local=await repository.reserveAiCall(input);
    if(!local.admitted)return local;
    const admitted=await runtime.ledger.reserve({id:`app-api:${tag}:${active.id}`,provider:'meta',operation:input.operation,fixtureId:active.id,ceilingMicrousd:input.ceilingMicrousd,maxAttempts:2,priceVersion:input.pricingVersion});
    if(!admitted.admitted){await repository.settleAiCall({reservationId:local.reservationId,status:'failed_before_send'});return admitted;}
    active.reservationId=admitted.reservationId;
    return local;
   },
   async settleAiCall(input){
    if(active?.reservationId)await runtime.ledger.settle({reservationId:active.reservationId,status:input.status==='succeeded'?'succeeded':input.status==='billing_unknown'?'billing_unknown':'unbilled',...(input.status==='succeeded'?{estimatedMicrousd:input.estimatedMicrousd,...input.tokens}:{})});
    return repository.settleAiCall(input);
   },
  };
  const env={APP_ORIGINS:'https://private-evaluation.invalid',AI_ENABLED:'true',META_MODEL_API_KEY:key,SESSION_HMAC_SECRET:randomBytes(32).toString('hex'),TURNSTILE_SITE_KEY:'synthetic-site',TURNSTILE_SECRET_KEY:'synthetic-secret'};
  const providerFetch=async(url,init)=>{
   if(!['https://api.meta.ai/v1/responses','https://api.meta.ai/v1/responses/input_tokens'].includes(url))throw Error('Unexpected provider destination.');
   const admitted=await runtime.ledger.recordAttempt({reservationId:active.reservationId,kind:url.endsWith('/input_tokens')?'preflight':'generation'});
   if(!admitted.admitted)throw Error('Campaign denied provider attempt.');
   attempts++;
   return fetch(url,{...init,redirect:'error'});
  };
  const api=createHandler({repositoryFactory:()=>wrapped,aiFactory:()=>createAiService({env,repository:wrapped,fetchImpl:providerFetch}),fetchImpl:async(url,init)=>{
   assert.equal(url,'https://challenges.cloudflare.com/turnstile/v0/siteverify');
   const {response}=JSON.parse(init.body);
   return Response.json({success:response.startsWith('synthetic-valid-'),hostname:'private-evaluation.invalid',action:response.endsWith('extract')?'extract':'chat'});
  }});
  let cookie='';
  async function call(route,body,{status=200,headers={}}={}){
   const response=await api.fetch(new Request(env.APP_ORIGINS+route,{method:body===undefined?'GET':'POST',headers:{Origin:env.APP_ORIGINS,'Content-Type':'application/json',Cookie:cookie,...headers},...(body===undefined?{}:{body:JSON.stringify(body)})}),env);
   const data=await response.json();
   assert.equal(response.status,status,`${route}: ${data.code||'unexpected status'}`);
   return {response,data};
  }
  const config=await call('/api/config');assert.equal(config.data.ai.enabled,true);assert.equal(config.data.countries.length,250);
  const session=await call('/api/session',{});cookie=session.response.headers.get('set-cookie').split(';')[0];assert.match(session.response.headers.get('set-cookie'),/HttpOnly/);
  const extract=fixtures.find(x=>x.id==='live-image-ordinary');
  await call('/api/extract',{consent:false,file:extract.file},{status:400});
  const intake=fixtures.find(x=>x.id==='live-intake-in');
  await call('/api/chat',{purpose:'intake',facts:intake.facts,history:intake.history},{status:403,headers:{'Idempotency-Key':randomUUID()}});
  assert.equal(attempts,0);report.checks.push('consent and challenge rejection before provider calls');
  for(const fixture of selected){
   active={id:fixture.id};
   const body=fixture.operation==='extract'?{consent:true,file:fixture.file}:{purpose:fixture.purpose,facts:fixture.facts,history:fixture.history};
   const headers={'Idempotency-Key':randomUUID(),'X-Turnstile-Token':`synthetic-valid-${fixture.operation}`};
   const started=Date.now();const {data}=await call('/api/'+fixture.operation,body,{headers});
   const record={fixtureId:fixture.id,status:'passed',latencyMs:Date.now()-started,usage:data.usage,answer:data.message,fields:data.fields,checks:[]};
   // Save the received answer even if a later quality assertion fails.
   report.cases.push(record);
   assert.equal(data.confirmed,false);
   if(fixture.operation==='extract'){
    for(const [field,expected] of Object.entries(fixture.expected.fields)){
     if(['net','tax','gross'].includes(field))assert.ok(new Decimal(data.fields[field]).eq(expected),field);
     else assert.equal(data.fields[field],expected,field);
    }
    const facts={...purchaseFacts('GB'),invoiceConfirmed:false};
    // Apply visible fields exactly as the app does, preserving blanks for nulls.
    for(const [field,value] of Object.entries(data.fields))if(value!==null&&Object.hasOwn(facts,field))facts[field]=value;
    assert.equal((await call('/api/assess',facts)).data.benefit.amount,null);
    const confirmed=(await call('/api/assess',{...facts,invoiceConfirmed:true})).data;
    assert.equal(confirmed.benefit.amount,'20.00');assert.equal(confirmed.cashRefund,null);
    record.checks.push('visible invoice fields','confirmation required','conditional assessment after confirmation');
   }else if(fixture.id==='live-explain-gb'){
    assert.match(data.message,/20\.00 GBP/);assert.match(data.message,/conditional/i);assert.match(data.message,/not a cash refund/i);
    record.checks.push('server-calculated amount and caveats');
   }else if(fixture.id==='live-client-gb'){
    assert.match(data.message,/No numerical benefit is determined/i);assert.match(data.message,/certificate/i);assert.doesNotMatch(data.message,/Ordinary VAT-registered businesses/i);
    record.checks.push('payment gap explanation without purchase VAT route');
   }else{
    for(const field of ['invoiceConfirmed','indiaChecks','registration','taxId'])assert.equal(Object.hasOwn(data.proposals||{},field),false);
    assert.equal((await call('/api/plan',fixture.facts)).data.guaranteedRefund,false);
    record.checks.push('intake cannot confirm protected facts');
    const count=attempts;await call('/api/chat',body,{headers,status:409});assert.equal(attempts,count);
    report.checks.push('duplicate request blocked without another generation');
   }
   console.log(JSON.stringify({fixtureId:fixture.id,status:'passed',usage:data.usage,latencyMs:record.latencyMs}));
  }
  await call('/api/events',{id:randomUUID(),event:'workflow_started',mode:'purchase',country:'GB'});
  await call('/api/feedback',{text:'FICTIONAL private API evaluation.',mode:'purchase',country:'GB'});
  await call('/api/admin/overview',undefined,{status:403});
  const cleared=await call('/api/session/clear',{});assert.match(cleared.response.headers.get('set-cookie'),/Max-Age=0/);cookie='';
  await call('/api/feedback',{text:'Fictional unauthenticated test.',mode:'purchase',country:'GB'},{status:401});
  report.checks.push('events and feedback stored','admin access denied','session clear and unauthenticated feedback');
  report.status='passed';
 }
}catch(error){
 report.status='failed';report.failure=String(error.message).slice(0,400);process.exitCode=1;
 if(report.cases.length)report.cases.at(-1).status='review_required';
 console.error(report.failure);
}finally{
 if(repository)await repository.updateSettings({actor:'private-api-evaluation-finished',patch:{aiEnabled:false}});
 report.after=await runtime.ledger.summary();report.providerHttpAttempts=attempts;report.finishedAt=new Date().toISOString();
 if(argv.includes('--live')){
  const output=path.resolve(stateDir,'evaluation',`app-api-${tag}.json`);await fs.mkdir(path.dirname(output),{recursive:true,mode:0o700});await fs.writeFile(output,JSON.stringify(report,null,2),{mode:0o600});
  console.log(JSON.stringify({status:report.status,completedCases:report.cases.length,providerHttpAttempts:attempts,incrementalEstimatedMicrousd:report.after.combined.spentMicrousd-report.before.combined.spentMicrousd,report:output}));
 }
 await runtime.close();
}
