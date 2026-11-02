import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {openEvaluationRuntime} from '../server/evaluation/runtime.mjs';
import {evaluateMeta} from '../server/evaluation/providers.mjs';
import {purchaseFacts} from '../tests/fixtures/evaluation/manifest.mjs';

process.chdir(fileURLToPath(new URL('../',import.meta.url)));
const cases={
  india:{
    id:'answer-india-equipment',operation:'chat',purpose:'explain',
    facts:{...purchaseFacts('IN'),item:'Laptop',category:'equipment'},
    history:[{role:'user',content:'For this fictional Indian business invoice for a laptop, can I claim the GST shown? Explain what is still unverified.'}],
    checks:{noAmount:/No numerical benefit is determined/i,localLimit:/equipment|office stationery|GSTR-2B/i},
  },
  uk:{
    id:'answer-uk-stationery',operation:'chat',purpose:'explain',
    facts:purchaseFacts('GB'),
    history:[{role:'user',content:'For this fictional confirmed UK stationery invoice, explain the conditional result and whether it is cash I will receive.'}],
    checks:{amount:/20\.00 GBP/,conditional:/conditional/i,noCashRefund:/not a cash refund/i},
  },
  client:{
    id:'answer-client-payment',operation:'chat',purpose:'explain',
    facts:{...purchaseFacts('GB'),mode:'client',amountReceived:'100',withheld:'20',certificate:false,workCountry:'unknown',taxResidence:'unknown'},
    history:[{role:'user',content:'A fictional client paid 100 against a 120 invoice and says 20 was tax. Can Tikdam confirm a refund, and what proof is missing?'}],
    checks:{noAmount:/No numerical benefit is determined/i,certificate:/certificate/i,noVatRoute:/^(?![\s\S]*Ordinary VAT-registered businesses)/i},
  },
};
const name=process.argv[process.argv.indexOf('--case')+1];
if(!Object.hasOwn(cases,name))throw Error('Choose --case india, uk, or client.');
const fixture=cases[name];
const runtime=await openEvaluationRuntime({persistPath:'.local-state/evaluation-d1'});
try{
  const before=await runtime.ledger.summary();
  if(!process.argv.includes('--live')){
    console.log(JSON.stringify({mode:'dry_run',case:name,fixtureId:fixture.id,before}));
    process.exitCode=0;
  }else{
    const offline=JSON.parse(await fs.readFile('.local-state/evaluation/offline-results.json','utf8'));
    if(offline.failed!==0||offline.cases.length!==1000)throw Error('Exact 1,000-case offline baseline must pass first.');
    if(before.paused||before.providers.meta.paused||before.inFlight||before.providers.meta.operatingRemainingMicrousd<30100)throw Error('Evaluation campaign cannot admit a safe Meta request.');
    const requestId=`meta:${fixture.id}:answer-check-2026-11-02${name==='client'?'-v2':''}`;
    if((await runtime.ledger.rows()).reservations.some(row=>row.id===requestId))throw Error('This answer check already ran; review its saved result.');
    const result=await evaluateMeta({ledger:runtime.ledger,fixture,key:process.env.META_MODEL_API_KEY||process.env.MODEL_API_KEY,requestId});
    const message=result.parsed?.message||'';
    const checks=Object.fromEntries(Object.entries(fixture.checks).map(([key,pattern])=>[key,pattern.test(message)]));
    const record={case:name,fixtureId:fixture.id,status:result.status,errorCode:result.errorCode||null,checks,renderedAnswer:message,sourceIds:result.parsed?.sourceIds||[],inputTokens:result.inputTokens??null,outputTokens:result.outputTokens??null,estimatedMicrousd:result.estimatedMicrousd??null,latencyMs:result.latencyMs,before,after:await runtime.ledger.summary()};
    await fs.mkdir('.local-state/evaluation',{recursive:true,mode:0o700});
    await fs.appendFile('.local-state/evaluation/answer-check-results.jsonl',JSON.stringify(record)+'\n',{mode:0o600});
    console.log(JSON.stringify({case:name,status:record.status,errorCode:record.errorCode,checks,sourceIds:record.sourceIds,estimatedMicrousd:record.estimatedMicrousd,latencyMs:record.latencyMs}));
    if(record.status!=='passed'||Object.values(checks).some(pass=>!pass))process.exitCode=2;
  }
}finally{await runtime.close();}
