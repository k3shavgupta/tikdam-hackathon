import {safeError} from './http.mjs';

export async function verifyChallenge({token,expectedAction,request,env,fetchImpl=fetch}) {
  if(!env.TURNSTILE_SECRET_KEY||!env.TURNSTILE_SITE_KEY)throw safeError('CHALLENGE_UNAVAILABLE',503,'Public AI is unavailable until its verification controls are configured.');
  if(typeof token!=='string'||token.length<10||token.length>2048)throw safeError('CHALLENGE_INVALID',403,'Complete a fresh verification challenge.');
  let result;
  try{
    const response=await fetchImpl('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({secret:env.TURNSTILE_SECRET_KEY,response:token}),signal:AbortSignal.timeout(10000)});
    if(!response.ok)throw Error();result=await response.json();
  }catch{throw safeError('CHALLENGE_UNAVAILABLE',503,'Verification is unavailable. Use manual entry or try later.');}
  if(result.success!==true||result.hostname!==new URL(request.url).hostname||result.action!==expectedAction)throw safeError('CHALLENGE_INVALID',403,'Verification expired or did not match this action. Complete a fresh challenge.');
  return true;
}
