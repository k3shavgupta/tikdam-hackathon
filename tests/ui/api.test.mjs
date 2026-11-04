import test from 'node:test';
import assert from 'node:assert/strict';
import {api,ensureSession,resetSession,sendEvent} from '../../src/api.mjs';

test('API accepts only same-origin API paths and requires fresh paid challenge',async()=>{
 const original=globalThis.fetch;let calls=0;globalThis.fetch=async()=>{calls++;return Response.json({ok:true});};
 try{
  for(const path of ['https://evil.test/api/chat','//evil.test/api/chat','/api/../admin','/api/chat#fragment'])await assert.rejects(api(path),/API path/);
  await assert.rejects(api('/api/chat',{purpose:'intake'},{paid:true}),/verification/);
  assert.equal(calls,0);
 }finally{globalThis.fetch=original;}
});
test('paid request sends cookies, challenge and one idempotency key without retry',async()=>{
 const original=globalThis.fetch;const requests=[];globalThis.fetch=async(path,options)=>{requests.push({path,options});return path==='/api/session'?Response.json({ok:true}):Response.json({code:'AI_PAUSED',message:'AI is paused.'},{status:503});};
 try{
  await assert.rejects(api('/api/chat',{purpose:'intake'},{paid:true,challengeToken:'fresh-test-challenge'}),error=>error.code==='AI_PAUSED');
  assert.equal(requests.filter(x=>x.path==='/api/chat').length,1);const request=requests.find(x=>x.path==='/api/chat');
  assert.equal(request.options.credentials,'same-origin');assert.equal(request.options.headers['X-Turnstile-Token'],'fresh-test-challenge');assert.match(request.options.headers['Idempotency-Key'],/^[0-9a-f-]{36}$/);
  assert.equal(request.options.redirect,'error');
 }finally{globalThis.fetch=original;}
});
test('session clear is explicit and feedback or events do not include arbitrary fields',async()=>{
 const original=globalThis.fetch;const requests=[];globalThis.fetch=async(path,options)=>{requests.push({path,options});return Response.json({ok:true});};
 try{
  await resetSession();await Promise.all([ensureSession(),ensureSession()]);
  assert.equal(requests.filter(x=>x.path==='/api/session').length,1);
  await sendEvent('workflow_started','purchase','FR');const body=JSON.parse(requests.find(x=>x.path==='/api/events').options.body);
  assert.equal(body.country,'FR');assert.deepEqual(Object.keys(body).sort(),['country','event','id','mode']);
  assert.equal(requests.some(x=>x.path==='/api/session/clear'),true);
 }finally{globalThis.fetch=original;}
});

test('session creation waits for cookie clearing and concurrent callers share the fresh session',async()=>{
 const client=await import('../../src/api.mjs?clear-barrier='+crypto.randomUUID());
 const original=globalThis.fetch,requests=[];let clearDone;
 globalThis.fetch=async(path)=>{requests.push(path);return path==='/api/session/clear'?new Promise(resolve=>{clearDone=()=>resolve(Response.json({ok:true}));}):Response.json({ok:true});};
 try{
  const clearing=client.resetSession();const first=client.ensureSession(),second=client.ensureSession();
  await new Promise(resolve=>setTimeout(resolve,0));assert.deepEqual(requests,['/api/session/clear']);
  clearDone();await Promise.all([clearing,first,second]);
  assert.deepEqual(requests,['/api/session/clear','/api/session']);
 }finally{clearDone?.();globalThis.fetch=original;}
});

test('an older pending session settles before clear and cannot invalidate the new session',async()=>{
 const client=await import('../../src/api.mjs?old-session='+crypto.randomUUID());
 const original=globalThis.fetch,requests=[];let finishOld,creates=0;
 globalThis.fetch=async(path)=>{requests.push(path);if(path==='/api/session'&&++creates===1)return new Promise(resolve=>{finishOld=()=>resolve(Response.json({ok:true}));});return Response.json({ok:true});};
 try{
  const old=client.ensureSession();const oldResult=old.catch(error=>error);
  const clearing=client.resetSession(),fresh=client.ensureSession();
  await new Promise(resolve=>setTimeout(resolve,0));assert.deepEqual(requests,['/api/session']);
  finishOld();assert.equal((await oldResult).code,'SESSION_CHANGED');await Promise.all([clearing,fresh]);await client.ensureSession();
  assert.deepEqual(requests,['/api/session','/api/session/clear','/api/session']);
 }finally{finishOld?.();globalThis.fetch=original;}
});

test('clearing a session stops a pending paid send before its model endpoint is reached',async()=>{
 const client=await import('../../src/api.mjs?pending-paid='+crypto.randomUUID());
 const original=globalThis.fetch,requests=[];let finishSession;
 globalThis.fetch=async(path)=>{requests.push(path);return path==='/api/session'?new Promise(resolve=>{finishSession=()=>resolve(Response.json({ok:true}));}):Response.json({ok:true});};
 try{
  const send=client.api('/api/chat',{purpose:'intake'},{paid:true,challengeToken:'synthetic-token'}).catch(error=>error);
  const clearing=client.resetSession();finishSession();assert.equal((await send).code,'SESSION_CHANGED');await clearing;
  assert.deepEqual(requests,['/api/session','/api/session/clear']);
 }finally{finishSession?.();globalThis.fetch=original;}
});

test('failed cookie clearing blocks fresh sessions until an explicit successful clear',async()=>{
 const client=await import('../../src/api.mjs?failed-clear='+crypto.randomUUID());
 const original=globalThis.fetch,requests=[];let fail=true;
 globalThis.fetch=async(path)=>{requests.push(path);return path==='/api/session/clear'&&fail?Response.json({code:'CLEAR_FAILED',message:'Could not clear the session.'},{status:503}):Response.json({ok:true});};
 try{
  await assert.rejects(client.resetSession(),error=>error.code==='CLEAR_FAILED');
  await assert.rejects(client.ensureSession(),error=>error.code==='CLEAR_FAILED');
  assert.equal(requests.includes('/api/session'),false);
  fail=false;await client.resetSession();await client.ensureSession();
  assert.deepEqual(requests,['/api/session/clear','/api/session/clear','/api/session']);
 }finally{globalThis.fetch=original;}
});
