import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
process.chdir(fileURLToPath(new URL('../',import.meta.url)));
import Decimal from 'decimal.js';
import {openEvaluationRuntime} from '../server/evaluation/runtime.mjs';
import {evaluateMeta,evaluateBaseten,readBasetenModels} from '../server/evaluation/providers.mjs';
import {buildLiveCases} from '../tests/fixtures/evaluation/manifest.mjs';
import {buildExtendedLiveCases} from '../tests/fixtures/evaluation/extended.mjs';
const argv=process.argv.slice(2);const option=(name,fallback)=>{const index=argv.indexOf(name);return index<0?fallback:argv[index+1];};
const provider=option('--provider','meta'),batch=Number(option('--batch','1')),tag=option('--run-tag','initial');
if(!['meta','baseten','metadata'].includes(provider)||!Number.isSafeInteger(batch)||batch<1||batch>10||!/^[A-Za-z0-9._-]{1,40}$/.test(tag))throw Error('Invalid runner options. Batch is 1..10.');
await fs.mkdir('.local-state/evaluation',{recursive:true,mode:0o700});
const runtime=await openEvaluationRuntime({persistPath:'.local-state/evaluation-d1'});
const resultsPath='.local-state/evaluation/live-results.jsonl';
try{
 const cases=await (argv.includes('--extended')?buildExtendedLiveCases():buildLiveCases());const selected=option('--case',null);const all=selected?cases.filter(x=>x.id===selected):cases.filter(x=>provider!=='baseten'||x.operation==='chat');if(selected&&!all.length)throw Error('Unknown fixture ID');
 if(!argv.includes('--live')){console.log(JSON.stringify({mode:'dry_run',provider,selected:all.slice(0,batch).map(x=>x.id),summary:await runtime.ledger.summary()}));process.exitCode=0;}
 else{
  const offline=JSON.parse(await fs.readFile('.local-state/evaluation/offline-results.json','utf8'));if(offline.failed!==0||offline.cases.length!==1000)throw Error('Run and pass the exact1000 offline cases first.');
  const known=await runtime.ledger.rows();const done=new Set(known.reservations.map(x=>x.id));
  const sink=async diagnostic=>{await fs.appendFile('.local-state/evaluation/diagnostics.jsonl',JSON.stringify(diagnostic)+'\n',{mode:0o600});};
  if(provider==='metadata'){
   const id='baseten-metadata-'+tag;if(!done.has(id)){const r=await readBasetenModels({ledger:runtime.ledger,key:process.env.BASETEN_API_KEY,requestId:id});await fs.appendFile(resultsPath,JSON.stringify({operation:'metadata',provider:'baseten',...r})+'\n',{mode:0o600});console.log(JSON.stringify(r));}
  }else{
   let n=0;for(const fixture of all){const requestId=`${provider}:${fixture.id}:${tag}`;if(done.has(requestId))continue;if(n++>=batch)break;
    const run=provider==='meta'?evaluateMeta:evaluateBaseten;const result=await run({ledger:runtime.ledger,fixture,key:provider==='meta'?process.env.META_MODEL_API_KEY||process.env.MODEL_API_KEY:process.env.BASETEN_API_KEY,requestId,diagnosticSink:sink});
    result.runTag=tag;result.expected=fixture.expected;result.assertionFailures=[];
    if(result.parsed){
     const parsed=result.parsed;if(parsed.confirmed!==false)result.assertionFailures.push('MODEL_AUTO_CONFIRMED');
     for(const key of fixture.expected?.proposalsExclude||[])if(Object.hasOwn(parsed.proposals||{},key))result.assertionFailures.push('PROTECTED_PROPOSAL_'+key);
     for(const [key,expected]of Object.entries(fixture.expected?.fields||{})){const actual=parsed.fields?.[key];let equal=actual===expected;if(fixture.expected.numericEquivalent&&['net','tax','gross'].includes(key)){try{equal=new Decimal(actual).eq(expected);}catch{equal=false;}}if(!equal)result.assertionFailures.push('FIELD_'+key);}
     for(const key of fixture.expected?.nullFields||[])if(parsed.fields?.[key]!==null)result.assertionFailures.push('EXPECTED_NULL_'+key);
     if(result.assertionFailures.length)result.status='quality_failed';
    }
    await fs.appendFile(resultsPath,JSON.stringify(result)+'\n',{mode:0o600});
    console.log(JSON.stringify({provider,fixtureId:fixture.id,status:result.status,errorCode:result.errorCode,assertionFailures:result.assertionFailures,estimatedMicrousd:result.estimatedMicrousd,inputTokens:result.inputTokens,outputTokens:result.outputTokens}));
    if(result.status!=='passed')break;
   }
  }
  console.log(JSON.stringify({summary:await runtime.ledger.summary()}));
 }
 const rows=await runtime.ledger.rows();const summary=await runtime.ledger.summary();await fs.writeFile('.local-state/evaluation/ledger-summary.json',JSON.stringify(summary,null,2),{mode:0o600});
 await fs.mkdir('docs/evaluation',{recursive:true});
 const resultRows=(await fs.readFile(resultsPath,'utf8').catch(()=>'' )).trim().split('\n').filter(Boolean).map(JSON.parse);
 const resultById=new Map(resultRows.filter(x=>x.reservationId).map(x=>[x.reservationId,x]));
 const headers=['campaign_id','provider','operation','fixture_id','reservation_id','status','quality_outcome','latency_ms','attempt_unit','attempt_count','attempt_types','input_tokens','output_tokens','reserved_microusd','estimated_microusd','price_version','billing_evidence','error_code'];
 const lines=[headers.join(',')];
 for(const r of rows.reservations){
  const attempts=rows.attempts.filter(x=>x.reservation_id===r.id);
  const held=['running','billing_unknown'].includes(r.status);
  const evidence=held?'unknown_held':r.estimated_microusd>0?'returned_usage_estimate':r.provider==='modal'?'sdk_initialization_only_not_auth':'non_generation_metadata_or_preflight';
  lines.push([summary.campaignId,r.provider,r.operation,r.fixture_id,r.id,r.status,resultById.get(r.id)?.status||'',resultById.get(r.id)?.latencyMs??'',r.provider==='modal'?'logical_sdk_action':'http_attempt',attempts.length,attempts.map(x=>x.kind).join('|'),r.input_tokens,r.output_tokens,held?r.ceiling_microusd:0,r.estimated_microusd??'',r.price_version,evidence,r.error_code||''].join(','));
 }
 await fs.writeFile('docs/evaluation/COSTS.csv',lines.join('\n')+'\n');
}finally{await runtime.close();}
