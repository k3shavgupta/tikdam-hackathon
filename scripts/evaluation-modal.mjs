import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {openEvaluationRuntime} from '../server/evaluation/runtime.mjs';
import {buildLiveCases} from '../tests/fixtures/evaluation/manifest.mjs';
process.chdir(fileURLToPath(new URL('../',import.meta.url)));
const live=process.argv.includes('--live'),compute=process.argv.includes('--compute');const mode=compute?'compute':'metadata';
const runtime=await openEvaluationRuntime({persistPath:'.local-state/evaluation-d1'});
try{
 if(!live){console.log(JSON.stringify({mode:'dry_run',operation:mode,ceilingMicrousd:compute?400000:0,summary:await runtime.ledger.summary()}));}
 else{
  if(!process.env.MODAL_TOKEN_ID||!process.env.MODAL_TOKEN_SECRET)throw Error('Modal credentials missing');
  const id=`modal-${mode}-initial`;
  const admitted=await runtime.ledger.reserve({id,provider:'modal',operation:mode==='compute'?'document_metadata':'metadata',fixtureId:mode==='compute'?'synthetic-pdf-png-batch':'sdk-auth',ceilingMicrousd:compute?400000:0,maxAttempts:1,priceVersion:'modal-cpu-2026-11-01'});
  if(!admitted.admitted)throw Error(admitted.reason);
  const attempt=await runtime.ledger.recordAttempt({reservationId:id,kind:mode});if(!attempt.admitted)throw Error(attempt.reason);
  const docs=compute?(await buildLiveCases()).filter(x=>['live-pdf-ordinary','live-image-ordinary'].includes(x.id)).map(x=>({id:x.id,data:x.file.data.split(',')[1]})):[];
  // SDK/control calls may use gRPC internally. We count this logical SDK action,
  // not claim exact Modal HTTP sends. Meta HTTP counting remains exact.
  const result=await new Promise(resolve=>{
   const child=spawn('.local-state/evaluation-python/bin/python',['scripts/evaluation-modal.py',mode],{env:process.env,stdio:['pipe','pipe','pipe']});let stdout='',stderr='',killed=false;
   const timer=setTimeout(()=>{killed=true;child.kill('SIGINT');setTimeout(()=>child.kill('SIGKILL'),5000).unref();},90000);
   child.stdout.on('data',x=>{stdout=(stdout+x).slice(-100000);});child.stderr.on('data',x=>{stderr=(stderr+x).slice(-100000);});child.stdin.end(JSON.stringify(docs));
   child.on('exit',code=>{clearTimeout(timer);resolve({code,stdout,stderr,killed});});child.on('error',()=>{clearTimeout(timer);resolve({code:1,stdout:'',stderr:'LOCAL_RUNNER_FAILURE'});});
  });
  const lines=result.stdout.trim().split('\n');let details;try{details=JSON.parse(lines.at(-1));}catch{details=null;}
  const safe={provider:'modal',operation:mode,reservationId:id,status:result.code===0&&details?'passed':'failed',...(details||{}),costEvidence:compute?'unverified_reserved':'documented_non_compute_handshake'};
  if(compute){await runtime.ledger.settle({reservationId:id,status:'billing_unknown',errorCode:'COMPUTE_BILLING_UNVERIFIED'});if(details?.results?.some(x=>!x.allowed))safe.status='quality_failed';}
  else await runtime.ledger.settle({reservationId:id,status:'unbilled',...(safe.status==='failed'?{errorCode:'PROVIDER_AUTH_OR_CONNECTION'}:{})});
  if(safe.status==='failed'){
   const appId=result.stderr.match(/"appId":\s*"(ap-[A-Za-z0-9_-]+)"/)?.[1];
   if(appId){const cleanup=await new Promise(resolve=>{const p=spawn('.local-state/evaluation-python/bin/python',['-m','modal','app','stop','--yes',appId],{env:process.env,stdio:'ignore'});const t=setTimeout(()=>{p.kill('SIGKILL');resolve(false);},15000);p.on('exit',code=>{clearTimeout(t);resolve(code===0);});});safe.appId=appId;safe.cleanupStopRequested=cleanup;}

   let diagnostic=(result.stderr||'').slice(-5000);for(const secret of [process.env.MODAL_TOKEN_ID,process.env.MODAL_TOKEN_SECRET])if(secret)diagnostic=diagnostic.split(secret).join('[REDACTED]');await fs.writeFile('.local-state/evaluation/modal-diagnostic.txt',diagnostic,{mode:0o600});
  }
  await fs.appendFile('.local-state/evaluation/live-results.jsonl',JSON.stringify(safe)+'\n',{mode:0o600});console.log(JSON.stringify(safe));console.log(JSON.stringify({summary:await runtime.ledger.summary()}));
 }
}finally{await runtime.close();}
