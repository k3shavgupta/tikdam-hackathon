let sessionPromise=null;
let resetPromise=null,resetError=null,sessionGeneration=0;
const sessionChanged=()=>Object.assign(Error('The session changed. Review the current form before sending again.'),{code:'SESSION_CHANGED'});

function checkedPath(path){
 if(typeof path!=='string'||!path.startsWith('/api/')||path.includes('#')||path.includes('\\'))throw Error('Use a same-origin API path.');
 const parsed=new URL(path,'https://tikdam.invalid');
 if(parsed.origin!=='https://tikdam.invalid'||!parsed.pathname.startsWith('/api/')||parsed.pathname.includes('%'))throw Error('Use a same-origin API path.');
 return path;
}

export async function api(path,body,options={}){
 path=checkedPath(path);
 const requestGeneration=sessionGeneration;
 const headers={...(body===undefined?{}:{'Content-Type':'application/json'}),...options.headers};
 if(options.paid){
  if(typeof options.challengeToken!=='string'||!options.challengeToken)throw Object.assign(Error('Complete a fresh verification challenge before sending.'),{code:'CHALLENGE_REQUIRED'});
  await ensureSession();
  if(requestGeneration!==sessionGeneration)throw sessionChanged();
  headers['Idempotency-Key']=options.idempotencyKey||crypto.randomUUID();
  headers['X-Turnstile-Token']=options.challengeToken;
 }
 let response;
 try{response=await fetch(path,{method:options.method||(body===undefined?'GET':'POST'),credentials:'same-origin',redirect:'error',headers,...(body===undefined?{}:{body:JSON.stringify(body)}),signal:options.signal||AbortSignal.timeout(options.paid?70000:15000)});}
 catch{throw Object.assign(Error(path.startsWith('/api/admin/')?'The admin session is unavailable. Open the owner login and try again.':'The server could not be reached. Your request was not automatically retried.'),{code:'NETWORK_UNAVAILABLE'});}
 let data;
 try{data=await response.json();}catch{throw Object.assign(Error(path.startsWith('/api/admin/')?'Open the owner login to access this dashboard.':'The server returned an unreadable response. Use manual entry or try later.'),{code:'INVALID_RESPONSE'});}
 if(!response.ok){
  if(response.status===401&&requestGeneration===sessionGeneration)sessionPromise=null;
  throw Object.assign(Error(typeof data.message==='string'?data.message:typeof data.error==='string'?data.error:'This action could not be completed.'),{code:data.code||'REQUEST_FAILED',status:response.status,requestId:data.requestId});
 }
 return data;
}

export function ensureSession(){
 if(resetPromise)return resetPromise.then(()=>ensureSession());
 if(resetError)return Promise.reject(resetError);
 if(!sessionPromise){
  const generation=sessionGeneration;
  const pending=api('/api/session',{}).then(result=>{if(generation!==sessionGeneration)throw sessionChanged();return result;}).catch(error=>{if(sessionPromise===pending)sessionPromise=null;throw error;});
  sessionPromise=pending;
 }
 return sessionPromise;
}
export function resetSession(){
 const previousReset=resetPromise,previousSession=sessionPromise;
 sessionGeneration++;sessionPromise=null;resetError=null;
 const clearing=(async()=>{
  // An older session response can set its cookie. Let it settle before the
  // server expires that cookie, then admit fresh session creation afterward.
  await previousReset?.catch(()=>{});await previousSession?.catch(()=>{});
  return api('/api/session/clear',{});
 })();
 const pending=clearing.catch(error=>{if(resetPromise===pending)resetError=error;throw error;}).finally(()=>{if(resetPromise===pending)resetPromise=null;});
 resetPromise=pending;return pending;
}
export async function sendEvent(event,mode,country){
 if(!['workflow_started','example_loaded','pack_downloaded'].includes(event)||!['before','purchase','client'].includes(mode)||!['IN','GB','AU','CA','US','ID','VN','SG','CN','AE','JP'].includes(country))return;
 try{await ensureSession();await api('/api/events',{id:crypto.randomUUID(),event,mode,country});}catch{/* Operational tracking must not block the user's work. */}
}
