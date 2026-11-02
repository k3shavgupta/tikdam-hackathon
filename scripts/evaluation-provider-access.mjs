// Explicitly requested credential repair only. Preserves all prior reservations.
import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {openEvaluationRuntime} from '../server/evaluation/runtime.mjs';
import {readBasetenModels} from '../server/evaluation/providers.mjs';
const args=process.argv.slice(2),option=(k)=>args[args.indexOf(k)+1];
if(!args.includes('--state-dir')||!args.includes('--run-tag'))throw Error('Provide --state-dir and a unique --run-tag.');
const state=path.resolve(option('--state-dir')),tag=option('--run-tag');
if(!/^[A-Za-z0-9._-]{1,40}$/.test(tag))throw Error('Invalid run tag.');
await fs.access(state+'/evaluation-d1');
const runtime=await openEvaluationRuntime({persistPath:state+'/evaluation-d1'});
try{
 const before=await runtime.ledger.summary();
 if(!args.includes('--live'))console.log(JSON.stringify({mode:'dry_run',before}));
 else{
  if(before.inFlight||before.paused)throw Error('Campaign unavailable.');
  const rows=await runtime.ledger.rows();
  if(rows.reservations.some(x=>['baseten-metadata-'+tag,'modal-auth-'+tag].includes(x.id)))throw Error('Recheck already attempted. Review its report.');
  for(const provider of ['baseten','modal']){
   await fs.appendFile(state+'/evaluation/provider-access-audit.jsonl',JSON.stringify({at:new Date().toISOString(),provider,action:'explicit_credential_repair_recheck',prior:before.providers[provider]})+'\n',{mode:0o600});
   await runtime.db.prepare('UPDATE evaluation_providers SET paused=0,pause_reason=NULL WHERE provider=?').bind(provider).run();
  }
  const catalogue=await readBasetenModels({ledger:runtime.ledger,key:process.env.BASETEN_API_KEY,requestId:'baseten-metadata-'+tag});
  const baseten={provider:'baseten',catalogueAccessible:!catalogue.errorCode,museListed:catalogue.models.includes('meta-models/muse-spark-open'),generationVerified:false,errorCode:catalogue.errorCode||null};
  console.log(JSON.stringify(baseten));
  if(catalogue.errorCode)await runtime.ledger.pause('baseten',catalogue.errorCode);
  const id='modal-auth-'+tag;
  const admit=await runtime.ledger.reserve({id,provider:'modal',operation:'metadata',fixtureId:'sdk-auth-recheck',ceilingMicrousd:0,maxAttempts:1,priceVersion:'metadata-free-2026-11-02'});
  if(!admit.admitted)throw Error(admit.reason);
  await runtime.ledger.recordAttempt({reservationId:id,kind:'metadata'});
  const modal=await new Promise(resolve=>{
   const child=spawn(state+'/evaluation-python/bin/python',['scripts/evaluation-modal.py','metadata'],{env:process.env,stdio:['ignore','pipe','pipe']});let stdout='',stderr='';
   const timer=setTimeout(()=>{child.kill('SIGTERM');setTimeout(()=>child.kill('SIGKILL'),3000).unref();},20000);
   child.stdout.on('data',x=>stdout=(stdout+x).slice(-5000));child.stderr.on('data',x=>stderr=(stderr+x).slice(-5000));
   child.on('error',()=>{clearTimeout(timer);resolve({provider:'modal',authenticated:false,errorCode:'LOCAL_RUNNER_FAILURE'});});
   child.on('exit',code=>{clearTimeout(timer);resolve({provider:'modal',authenticated:code===0&&stdout.includes('"authenticated": true'),errorCode:code===0?null:/Token ID is malformed/.test(stderr)?'MALFORMED_TOKEN_ID':/AuthError/.test(stderr)?'AUTH_REJECTED':'SDK_OR_CONNECTION_FAILURE'});});
  });
  await runtime.ledger.settle({reservationId:id,status:'unbilled',...(modal.errorCode?{errorCode:modal.errorCode}:{})});
  if(!modal.authenticated)await runtime.ledger.pause('modal',modal.errorCode);
  console.log(JSON.stringify(modal));
  await fs.writeFile(state+'/evaluation/provider-access-'+tag+'.json',JSON.stringify({baseten,modal,after:await runtime.ledger.summary()},null,2),{mode:0o600});
 }
}finally{await runtime.close();}
