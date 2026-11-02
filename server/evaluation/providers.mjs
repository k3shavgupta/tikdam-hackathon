import {randomUUID} from 'node:crypto';
import {validateFile,createExtractionPayload,parseExtraction} from '../meta.mjs';
import {chatRequest,createChatPayload,parseChatResult} from '../ai/schemas.mjs';
import {verifiedPricing,validatePricing,estimateMicrousd,validatedUsage} from '../ai/pricing.mjs';
const META='https://api.meta.ai/v1/responses';
const BASETEN='https://inference.baseten.co/v1';
const redact=(value,key)=>String(value).split(key||'__no_key__').join('[REDACTED]').replace(/\b(?:sk-|as-|ws-)[A-Za-z0-9_-]{16,}/g,'[REDACTED]');
async function writeDiagnostic(sink,value){try{await sink(value);}catch{/* Diagnostics cannot alter durable spend accounting. */}}
const safeCode=e=>/^[A-Z][A-Z0-9_]{0,70}$/.test(e?.code||'')?e.code:'PROVIDER_UNAVAILABLE';
function err(code){return Object.assign(Error(code),{code});}
async function jsonResponse(response){
 const reader=response.body?.getReader();if(!reader)throw err('PROVIDER_RESPONSE_INVALID');const chunks=[];let count=0;
 try{while(true){const{done,value}=await reader.read();if(done)break;count+=value.byteLength;if(count>1000000){await reader.cancel();throw err('PROVIDER_RESPONSE_INVALID');}chunks.push(value);}}finally{reader.releaseLock();}
 const bytes=new Uint8Array(count);let at=0;for(const c of chunks){bytes.set(c,at);at+=c.length;}
 try{return JSON.parse(new TextDecoder().decode(bytes));}catch{throw err('PROVIDER_RESPONSE_INVALID');}
}
async function send({ledger,reservationId,kind,url,key,body,fetchImpl,method='POST'}){
 const attempt=await ledger.recordAttempt({reservationId,kind});if(!attempt.admitted)throw err(attempt.reason||'ATTEMPT_DENIED');
 let response;try{response=await fetchImpl(url,{method,redirect:'error',headers:{Authorization:`Bearer ${key}`,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(45000)});}catch{throw err('PROVIDER_UNAVAILABLE');}
 const data=await jsonResponse(response);
 if(!response.ok){const code=String(data.error?.code||data.code||'').slice(0,90);const message=redact(data.error?.message||data.message||'',key).slice(0,700);throw Object.assign(err(response.status===401?'PROVIDER_AUTH_REJECTED':response.status===429?'PROVIDER_LIMIT':'PROVIDER_REJECTED'),{httpStatus:response.status,diagnostic:{code,message}});}
 return data;
}
async function pack(fixture){
 if(fixture.operation==='extract'){const checked=await validateFile(fixture.file);return{body:createExtractionPayload(checked),parse:text=>parseExtraction(text,checked,'muse-spark-1.3')};}
 const value=chatRequest.parse({purpose:fixture.purpose,facts:fixture.facts,history:fixture.history});const p=createChatPayload(value);return{body:p.body,parse:text=>({...parseChatResult(text,{purpose:fixture.purpose,...p}),provider:'Meta Model API',model:'muse-spark-1.3',confirmed:false})};
}
async function admit(ledger,{id,provider,operation,fixtureId,ceilingMicrousd,maxAttempts,priceVersion}){const r=await ledger.reserve({id,provider,operation,fixtureId,ceilingMicrousd,maxAttempts,priceVersion});if(!r.admitted)throw err(r.reason||'BUDGET_EXHAUSTED');return r.reservationId;}
export async function evaluateMeta({ledger,fixture,key,fetchImpl=fetch,diagnosticSink=()=>{},requestId=randomUUID()}){
 if(!key)throw err('MODEL_NOT_CONFIGURED');const pricing=validatePricing(verifiedPricing,'muse-spark-1.3');const p=await pack(fixture);
 const body={...p.body,model:'muse-spark-1.3',store:false,reasoning:{effort:'minimal'},max_output_tokens:pricing.maxOutputTokens};
 const reservationId=await admit(ledger,{id:requestId,provider:'meta',operation:fixture.operation,fixtureId:fixture.id,ceilingMicrousd:estimateMicrousd({inputTokens:pricing.maxInputTokens,outputTokens:pricing.maxOutputTokens},pricing),maxAttempts:2,priceVersion:pricing.version});
 let generated=false,settled=false;const started=Date.now();let usage,estimatedMicrousd;
 try{
  const preflight=await send({ledger,reservationId,kind:'preflight',url:META+'/input_tokens',key,body:{model:body.model,input:body.input,instructions:body.instructions,text:body.text,reasoning:body.reasoning},fetchImpl});
  const count=preflight.input_tokens;if(!Number.isSafeInteger(count)||count<=0||count>pricing.maxInputTokens)throw err('PREFLIGHT_UNVERIFIED');
  generated=true;
  const result=await send({ledger,reservationId,kind:'generation',url:META,key,body,fetchImpl});
  usage=validatedUsage(result.usage,pricing,count);estimatedMicrousd=estimateMicrousd(usage,pricing);
  await ledger.settle({reservationId,status:'succeeded',estimatedMicrousd,...usage});settled=true;
  if(result.status!=='completed'){await writeDiagnostic(diagnosticSink,{provider:'meta',fixtureId:fixture.id,reservationId,status:result.status,incompleteReason:result.incomplete_details?.reason,outputTypes:result.output?.map(x=>x.type),usage:result.usage});throw err('MODEL_INCOMPLETE');}
  const text=(result.output||[]).filter(x=>x.type==='message').flatMap(x=>x.content||[]).filter(x=>x.type==='output_text').map(x=>x.text).join('');
  const parsed=p.parse(text);
  return{provider:'meta',fixtureId:fixture.id,reservationId,status:'passed',...usage,estimatedMicrousd,latencyMs:Date.now()-started,parsed};
 }catch(error){
  if(error.diagnostic)await writeDiagnostic(diagnosticSink,{provider:'meta',fixtureId:fixture.id,reservationId,httpStatus:error.httpStatus,...error.diagnostic});
  const code=safeCode(error);
  if(!settled){await ledger.settle({reservationId,status:generated?'billing_unknown':'unbilled',errorCode:code});if(generated)await ledger.pause('meta',code);}
  return{provider:'meta',fixtureId:fixture.id,reservationId,status:settled?'quality_failed':generated?'billing_unknown':'preflight_failed',errorCode:code,...(usage?usage:{}),...(estimatedMicrousd!==undefined?{estimatedMicrousd}:{}),latencyMs:Date.now()-started};
 }
}
export async function readBasetenModels({ledger,key,fetchImpl=fetch,requestId=randomUUID()}){
 if(!key)throw err('MODEL_NOT_CONFIGURED');const reservationId=await admit(ledger,{id:requestId,provider:'baseten',operation:'metadata',fixtureId:'model-catalogue',ceilingMicrousd:0,maxAttempts:1,priceVersion:'metadata-free-2026-11-01'});
 try{const r=await send({ledger,reservationId,kind:'metadata',url:BASETEN+'/models',key,method:'GET',fetchImpl});await ledger.settle({reservationId,status:'unbilled'});return{models:(r.data||[]).map(x=>x.id).filter(x=>typeof x==='string')};}
 catch(error){await ledger.settle({reservationId,status:'unbilled',errorCode:safeCode(error)});return{models:[],errorCode:safeCode(error)};}
}
export async function evaluateBaseten({ledger,fixture,key,model='meta-models/muse-spark-open',fetchImpl=fetch,diagnosticSink=()=>{},requestId=randomUUID()}){
 if(!key)throw err('MODEL_NOT_CONFIGURED');if(model!=='meta-models/muse-spark-open'||fixture.operation!=='chat')throw err('UNSUPPORTED_COMPARISON');
 const pricing=validatePricing(verifiedPricing,'muse-spark-1.3');const p=await pack(fixture);
 const content=JSON.stringify({input:p.body.input,jsonSchema:p.body.text.format.schema});
 // Text-only byte bound, generous scaffolding allowance; no implicit media.
 if(Buffer.byteLength(content+p.body.instructions,'utf8')+4096>20000)throw err('INPUT_TOO_LARGE');
 const reservationId=await admit(ledger,{id:requestId,provider:'baseten',operation:'chat',fixtureId:fixture.id,ceilingMicrousd:30100,maxAttempts:1,priceVersion:'baseten-muse-spark-open-2026-11-01'});
 const body={model,max_tokens:1200,reasoning_effort:'low',messages:[{role:'system',content:p.body.instructions+' Return only JSON matching the supplied schema. No markdown fences.'},{role:'user',content}]};
 let settled=false;const started=Date.now();let usage,estimatedMicrousd;
 try{
  const result=await send({ledger,reservationId,kind:'generation',url:BASETEN+'/chat/completions',key,body,fetchImpl});
  usage=validatedUsage({input_tokens:result.usage?.prompt_tokens,output_tokens:result.usage?.completion_tokens,total_tokens:result.usage?.total_tokens},pricing,20000);estimatedMicrousd=estimateMicrousd(usage,pricing);
  await ledger.settle({reservationId,status:'succeeded',estimatedMicrousd,...usage});settled=true;
  if(result.choices?.[0]?.finish_reason!=='stop')throw err('MODEL_INCOMPLETE');
  const parsed=p.parse(result.choices?.[0]?.message?.content||'');parsed.provider='Baseten';parsed.model=model;
  return{provider:'baseten',fixtureId:fixture.id,reservationId,status:'passed',...usage,estimatedMicrousd,latencyMs:Date.now()-started,parsed,structuredOutputGuarantee:'prompt_only_locally_validated'};
 }catch(error){if(error.diagnostic)await writeDiagnostic(diagnosticSink,{provider:'baseten',fixtureId:fixture.id,reservationId,httpStatus:error.httpStatus,...error.diagnostic});const code=safeCode(error);if(!settled){await ledger.settle({reservationId,status:'billing_unknown',errorCode:code});await ledger.pause('baseten',code);}return{provider:'baseten',fixtureId:fixture.id,reservationId,status:settled?'quality_failed':'billing_unknown',errorCode:code,...(usage?usage:{}),...(estimatedMicrousd!==undefined?{estimatedMicrousd}:{}),latencyMs:Date.now()-started};}
}
