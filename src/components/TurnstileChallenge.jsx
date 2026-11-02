import React,{useEffect,useRef,useState} from 'react';

let loader;
function loadTurnstile(){
 if(window.turnstile)return Promise.resolve(window.turnstile);
 if(!loader)loader=new Promise((resolve,reject)=>{
  const script=document.createElement('script');script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';script.async=true;script.defer=true;
  script.addEventListener('load',()=>window.turnstile?resolve(window.turnstile):reject(Error('Verification did not load.')),{once:true});
  script.addEventListener('error',()=>reject(Error('Verification could not load.')),{once:true});document.head.appendChild(script);
 }).catch(error=>{loader=null;throw error;});
 return loader;
}

export function TurnstileChallenge({siteKey,action,onToken,resetKey=0}){
 const container=useRef(null),callbacks=useRef(onToken);callbacks.current=onToken;
 const [error,setError]=useState('');
 useEffect(()=>{
  let disposed=false,widget=null,instance=null;
  callbacks.current?.('');setError('');
  if(!siteKey)return;
  loadTurnstile().then(api=>{
   if(disposed)return;instance=api;
   widget=api.render(container.current,{sitekey:siteKey,action,theme:'light',callback:token=>{if(!disposed)callbacks.current?.(token);},'expired-callback':()=>callbacks.current?.(''),'error-callback':()=>{callbacks.current?.('');setError('Verification failed. Refresh this challenge or use manual entry.');}});
  }).catch(error=>{if(!disposed)setError(error.message+' Manual entry remains available.');});
  return()=>{disposed=true;if(widget!==null)instance?.remove(widget);};
 },[siteKey,action,resetKey]);
 if(!siteKey)return <p className="tk-note">AI verification is not configured. Manual entry remains available.</p>;
 return <div className="tk-challenge"><div ref={container} aria-label="Verification challenge"/>{error&&<p role="alert" className="tk-error">{error}</p>}</div>;
}
