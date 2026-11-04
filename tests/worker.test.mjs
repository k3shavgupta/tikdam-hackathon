import test from 'node:test';
import assert from 'node:assert/strict';
import { createHandler } from '../worker/index.mjs';
import { build } from 'esbuild';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { readFile } from 'node:fs/promises';

const env={APP_ORIGINS:'https://tikdam.xyz',SESSION_HMAC_SECRET:'synthetic-secret-at-least-32-bytes-in-tests',AI_ENABLED:'false',ASSETS:{fetch:async()=>new Response('<main>static app</main>',{headers:{'Content-Type':'text/html'}})}};
const calls=[];
const repository={
  createSession:async()=>{},getSession:async(id)=>id==='11111111-1111-4111-8111-111111111111'?{id}:null,
  consumeThrottle:async()=>({allowed:true}),recordJob:async x=>calls.push(x),finishJob:async x=>calls.push(x),recordEvent:async()=>{},addFeedback:async()=>{},
  getSettings:async()=>({aiEnabled:false}),getOverview:async()=>({settings:{aiEnabled:false}}),
};
const api=createHandler({repositoryFactory:()=>repository,aiFactory:()=>({capabilities:()=>({enabled:false,chatAvailable:false,extractionAvailable:false,reason:'AI is paused.'}),extract:async()=>{throw Error('unreachable')}})});
function request(path,body,headers={}) {return new Request(`https://tikdam.xyz${path}`,{method:body===undefined?'GET':'POST',headers:body===undefined?headers:{'Content-Type':'application/json',Origin:'https://tikdam.xyz',...headers},...(body===undefined?{}:{body:JSON.stringify(body)})});}
const facts={mode:'before',country:'IN',businessCountry:'IN'};

test('production config is safe and disabled AI is clearly declared',async()=>{
 const r=await api.fetch(request('/api/config'),env,{});const data=await r.json();
 assert.equal(r.status,200);assert.equal(data.countries.length,250);assert.equal(data.modelConfigured,false);assert.equal(data.ai.enabled,false);
 assert.equal(JSON.stringify(data).includes(env.SESSION_HMAC_SECRET),false);assert.equal(r.headers.get('cache-control'),'no-store');
});
test('ordinary deterministic flow works without provider or telemetry availability',async()=>{
 const offline=createHandler({repositoryFactory:()=>{throw Error('DB unavailable')},aiFactory:()=>({capabilities:()=>({enabled:false})})});
 const r=await offline.fetch(request('/api/plan',facts),env,{});assert.equal(r.status,200);assert.equal((await r.json()).guaranteedRefund,false);
});
test('unknown API routes are JSON404 while app routes are SPA assets',async()=>{
 const r=await api.fetch(request('/api/missing'),env,{});assert.equal(r.status,404);assert.match(r.headers.get('content-type'),/json/);
 const page=await api.fetch(request('/coverage'),env,{});assert.match(await page.text(),/static app/);
});
test('landing, checker, and owner dashboard use their intended assets',async()=>{
 const paths=[];
 const assets={...env,ASSETS:{fetch:async request=>{
  const path=new URL(request.url).pathname;paths.push(path);
  return new Response(path,{headers:{'Content-Type':'text/html'}});
 }}};
 const owner=createHandler({adminVerifier:async()=>({subject:'owner',email:'owner@example.test'})});
 for(const [route,asset] of [['/','/'],['/app','/app/index.html'],['/app/purchase','/app/index.html'],['/admin','/app/index.html']]){
  const response=await owner.fetch(request(route),assets,{});
  assert.equal(response.status,200);
  assert.equal(await response.text(),asset);
 }
 assert.deepEqual(paths,['/','/app/index.html','/app/index.html','/app/index.html']);
});
test('cross-origin and unapproved-host mutations are blocked',async()=>{
 assert.equal((await api.fetch(request('/api/plan',facts,{Origin:'https://evil.test'}),env,{})).status,403);
 assert.equal((await api.fetch(new Request('https://alternate.workers.dev/api/config'),env,{})).status,403);
 assert.equal((await api.fetch(new Request('https://tikdam.xyz/api/plan',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(facts)}),env,{})).status,403);
});
test('admin exact nested and encoded paths fail closed on every exposed host',async()=>{
 for(const path of ['/admin','/admin/','/admin/jobs','/api/admin','/api/admin/overview','/%61dmin','/api/%61dmin/overview']){
  const r=await api.fetch(request(path),env,{});assert.equal(r.status,403,path);
 }
});
test('session cookie is server-issued secure httponly same-site and has no client identity',async()=>{
 const r=await api.fetch(request('/api/session',{}),env,{});assert.equal(r.status,200);const cookie=r.headers.get('set-cookie');
 assert.match(cookie,/tikdam_session=[0-9a-f-]+/);assert.match(cookie,/HttpOnly/);assert.match(cookie,/Secure/);assert.match(cookie,/SameSite=Strict/);assert.equal(cookie.includes('Domain='),false);
});
test('public paid calls fail closed without a valid session and do not reach model',async()=>{
 const r=await api.fetch(request('/api/extract',{consent:true,file:{name:'x',data:'x'}}),env,{});assert.ok([401,503].includes(r.status));
 assert.equal((await r.json()).code!==undefined,true);
});
test('unreviewed country chat reaches the bounded assistant when AI controls are enabled',async()=>{
 let providerCalls=0;
 const guarded=createHandler({repositoryFactory:()=>({...repository,getSettings:async()=>({aiEnabled:true})}),aiFactory:()=>{providerCalls++;return{chat:async()=>({message:'What invoice details can you confirm?',proposals:{},missingFields:['item'],sourceIds:[]})}},challengeVerifier:async()=>{}});
 const body={purpose:'intake',facts:{mode:'before',country:'FR',businessCountry:'FR'},history:[{role:'user',content:'What should I prepare?'}]};
 const response=await guarded.fetch(request('/api/chat',body,{Cookie:'tikdam_session=11111111-1111-4111-8111-111111111111','Idempotency-Key':crypto.randomUUID()}),{...env,AI_ENABLED:'true'},{});
 assert.equal(response.status,200);
 assert.deepEqual((await response.json()).sourceIds,[]);
 assert.equal(providerCalls,1);
});
test('chat-only rollout blocks invoice extraction before challenge or provider work',async()=>{
 let verified=0,providerCalls=0;
 const guarded=createHandler({repositoryFactory:()=>({...repository,getSettings:async()=>({aiEnabled:true})}),aiFactory:()=>{providerCalls++;return{extract:async()=>({})}},challengeVerifier:async()=>{verified++;}});
 const response=await guarded.fetch(request('/api/extract',{consent:true,file:{name:'invoice.png',data:'data:image/png;base64,AA=='}},{Cookie:'tikdam_session=11111111-1111-4111-8111-111111111111','Idempotency-Key':crypto.randomUUID()}),{...env,AI_ENABLED:'true',AI_EXTRACTION_ENABLED:'false'},{});
 assert.equal(response.status,503);
 assert.equal((await response.json()).code,'AI_PAUSED');
 assert.equal(verified,0);
 assert.equal(providerCalls,0);
});
test('UI telemetry rejects arbitrary properties and invoice data',async()=>{
 const r=await api.fetch(request('/api/events',{id:crypto.randomUUID(),event:'workflow_started',mode:'purchase',country:'IN',invoiceNumber:'SECRET'},{Cookie:'tikdam_session=11111111-1111-4111-8111-111111111111'}),env,{});
 assert.equal(r.status,400);assert.equal(JSON.stringify(await r.json()).includes('SECRET'),false);
});
test('streamed oversized request is rejected before JSON processing',async()=>{
 const r=await api.fetch(new Request('https://tikdam.xyz/api/plan',{method:'POST',headers:{Origin:'https://tikdam.xyz','Content-Type':'application/json'},body:'x'.repeat(110000)}),env,{});
 assert.equal(r.status,413);
});
test('authenticated admin uses router only after verified identity and same-origin check',async()=>{
 let verified=0;
 const adminApi=createHandler({repositoryFactory:()=>repository,adminVerifier:async()=>{verified++;return{subject:'owner',email:'owner@example.test'}},adminHandler:async()=>Response.json({ok:true})});
 const r=await adminApi.fetch(request('/api/admin/overview'),env,{});assert.equal(r.status,200);assert.equal(verified,1);
 const bad=await adminApi.fetch(request('/api/admin/settings',{aiEnabled:true},{Origin:'https://evil.test'}),env,{});assert.equal(bad.status,403);assert.equal(verified,1);
});
test('admin mutation body is bounded before private router receives it',async()=>{
 let routed=false;
 const adminApi=createHandler({repositoryFactory:()=>repository,adminVerifier:async()=>({subject:'owner',email:'owner@example.test'}),adminHandler:async()=>{routed=true;return Response.json({ok:true})}});
 const r=await adminApi.fetch(request('/api/admin/settings',{extra:'x'.repeat(70000)}),env,{});
 assert.equal(r.status,413);assert.equal(routed,false);
});
test('canonical redirect uses only configured host and preserves path',async()=>{
 const r=await api.fetch(new Request('https://www.tikdam.xyz/coverage?mode=purchase'),{...env,APP_ORIGINS:'https://tikdam.xyz,https://www.tikdam.xyz',CANONICAL_ORIGIN:'https://tikdam.xyz'},{});
 assert.equal(r.status,308);assert.equal(r.headers.get('Location'),'https://tikdam.xyz/coverage?mode=purchase');
});
test('public navigation from judging and search pages remains available',async()=>{
 const r=await api.fetch(request('/',undefined,{'Sec-Fetch-Site':'cross-site','Sec-Fetch-Mode':'navigate'}),env,{});
 assert.equal(r.status,200);assert.match(await r.text(),/static app/);
 const privateRequest=await api.fetch(request('/api/admin/overview',undefined,{'Sec-Fetch-Site':'cross-site'}),env,{});
 assert.equal(privateRequest.status,403);
});
test('clear session expires the HttpOnly cookie and rejects cross-origin reset',async()=>{
 const r=await api.fetch(request('/api/session/clear',{}),env,{});
 assert.equal(r.status,200);assert.match(r.headers.get('Set-Cookie'),/tikdam_session=;/);assert.match(r.headers.get('Set-Cookie'),/Max-Age=0/);assert.match(r.headers.get('Set-Cookie'),/HttpOnly/);
 const bad=await api.fetch(request('/api/session/clear',{}, {Origin:'https://evil.test'}),env,{});assert.equal(bad.status,403);
});
test('exhausted operational throttle skips writes while preserving manual guidance',async()=>{
 let writes=0;
 const limited=createHandler({repositoryFactory:()=>({...repository,consumeThrottle:async()=>({allowed:false}),recordJob:async()=>{writes++;},finishJob:async()=>{writes++;}})});
 const r=await limited.fetch(request('/api/plan',facts,{Cookie:'tikdam_session=11111111-1111-4111-8111-111111111111'}),env,{});
 assert.equal(r.status,200);assert.equal(writes,0);
});
test('authenticated admin navigation can return from the Access login origin',async()=>{
 const owner=createHandler({adminVerifier:async()=>({subject:'owner',email:'owner@example.test'})});
 const r=await owner.fetch(request('/admin',undefined,{'Sec-Fetch-Site':'cross-site','Sec-Fetch-Mode':'navigate'}),env,{});
 assert.equal(r.status,200);assert.match(await r.text(),/static app/);
});

test('bundled Worker runs domain routes, sessions and metadata against actual local D1',async()=>{
 const bundle=await build({entryPoints:[new URL('../worker/index.mjs',import.meta.url).pathname],bundle:true,write:false,format:'esm',platform:'browser',target:'es2022',external:['node:*'],plugins:[{
  name:'explicit-offline-ai',
  setup(build){
   // AI is deliberately mocked in ordinary runtime tests. The rest of the
   // Worker, including repository, route schema and real D1, is bundled.
   build.onResolve({filter:/server\/ai\/service\.mjs$/},()=>({path:'offline-ai',namespace:'offline'}));
   build.onLoad({filter:/.*/,namespace:'offline'},()=>({contents:'export function createAiService(){return{capabilities(){return{enabled:false,chatAvailable:false,extractionAvailable:false,reason:"Offline test"}}}}',loader:'js'}));
  }
 }]});
 const fixture=new Miniflare(convertV4MiniflareOptions({modules:true,script:bundle.outputFiles[0].text,compatibilityDate:'2026-10-30',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],bindings:{APP_ORIGINS:'https://tikdam.xyz',AI_ENABLED:'false',SESSION_HMAC_SECRET:'synthetic-secret-at-least-32-bytes-in-tests'},serviceBindings:{ASSETS:()=>new Response('<main>bundled assets</main>',{headers:{'Content-Type':'text/html'}})}}));
 try{
  const db=await fixture.getD1Database('DB');
  const sql=await readFile(new URL('../migrations/0001_operations.sql',import.meta.url),'utf8');
  await db.batch(sql.split(';').map(x=>x.trim()).filter(Boolean).map(x=>db.prepare(x)));
  const topicMigration=await readFile(new URL('../migrations/0003_chat_topics.sql',import.meta.url),'utf8');
  await db.batch(topicMigration.split(';').map(x=>x.trim()).filter(Boolean).map(x=>db.prepare(x)));
  const config=await fixture.dispatchFetch('https://tikdam.xyz/api/config');assert.equal(config.status,200);assert.equal((await config.json()).ai.enabled,false);
  const session=await fixture.dispatchFetch('https://tikdam.xyz/api/session',{method:'POST',headers:{Origin:'https://tikdam.xyz','Content-Type':'application/json'},body:'{}'});
  assert.equal(session.status,200);const cookie=session.headers.get('set-cookie').split(';')[0];
  const plan=await fixture.dispatchFetch('https://tikdam.xyz/api/plan',{method:'POST',headers:{Origin:'https://tikdam.xyz','Content-Type':'application/json',Cookie:cookie},body:JSON.stringify({...facts,legalName:'PRIVACY_CANARY_9833',item:'SECRET_PURCHASE_9833'})});
  assert.equal(plan.status,200);assert.equal((await plan.json()).guaranteedRefund,false);
  const jobs=await db.prepare('SELECT * FROM jobs').all();assert.equal(jobs.results.length,1);assert.equal(JSON.stringify(jobs.results).includes('PRIVACY_CANARY_9833'),false);assert.equal(JSON.stringify(jobs.results).includes('SECRET_PURCHASE_9833'),false);
  const page=await fixture.dispatchFetch('https://tikdam.xyz/coverage');assert.match(await page.text(),/bundled assets/);
  for(const path of ['/admin','/api/admin/overview'])assert.equal((await fixture.dispatchFetch(`https://tikdam.xyz${path}`)).status,403);
  const unknown=await fixture.dispatchFetch('https://tikdam.xyz/api/not-a-route');assert.equal(unknown.status,404);assert.match(unknown.headers.get('content-type'),/json/);
 }finally{await fixture.dispose();}
});

test('provider changes require matching consent before challenge or model traffic',async()=>{
 let reached=0;
 const handler=createHandler({repositoryFactory:()=>({...repository,getSettings:async()=>({aiEnabled:true})}),challengeVerifier:async()=>{reached++;},aiFactory:()=>({chat:async()=>{reached++;return{provider:'Baseten'};}})});
 const body={purpose:'intake',facts,history:[{role:'user',content:'A fictional laptop purchase'}]};
 const baseHeaders={Cookie:'tikdam_session=11111111-1111-4111-8111-111111111111','Idempotency-Key':crypto.randomUUID()};
 for(const header of [undefined,'meta']){
  const response=await handler.fetch(request('/api/chat',body,{...baseHeaders,...(header?{'X-AI-Provider':header}:{})}),{...env,AI_ENABLED:'true',AI_PROVIDER:'baseten'},{});
  assert.equal(response.status,409);assert.equal((await response.json()).code,'PROVIDER_CHANGED');
 }
 assert.equal(reached,0);
 const response=await handler.fetch(request('/api/chat',body,{...baseHeaders,'X-AI-Provider':'baseten'}),{...env,AI_ENABLED:'true',AI_PROVIDER:'baseten'},{});
 assert.equal(response.status,200);assert.equal(reached,2);
 const oldBasetenTab=await handler.fetch(request('/api/chat',body,{...baseHeaders,'X-AI-Provider':'baseten'}),{...env,AI_ENABLED:'true',AI_PROVIDER:'meta'},{});
 assert.equal(oldBasetenTab.status,409);
 const config=await api.fetch(request('/api/config'),{...env,AI_PROVIDER:'baseten'},{});const data=await config.json();
 assert.equal(data.provider,'Baseten');assert.equal(data.model,'meta-models/muse-spark-open-1026');
});

test('provider requests work in workerd and never follow a redirect with the API key', async () => {
  const bundle = await build({
    stdin: {resolveDir:new URL('../',import.meta.url).pathname,contents:`
      import {createAiService} from './server/ai/service.mjs';
      export default {async fetch(request,env){
        const repository={
          getSettings:()=>({aiEnabled:true}),reserveAiCall:()=>({admitted:true,reservationId:'fixture'}),
          recordJob(){},finishJob(){},settleAiCall(){},updateSettings(){}
        };
        const service=createAiService({repository,env,clock:()=>Date.parse('2026-11-03T12:00:00Z'),
          fetchImpl:(url,init)=>env.UPSTREAM.fetch(new Request(url,init))});
        try{return Response.json(await service.chat(await request.json()));}
        catch(error){return Response.json({code:error.code},{status:error.status||500});}
      }};
    `},bundle:true,write:false,format:'esm',platform:'browser',external:['node:*']
  });
  const urls=[];
  const fixture=new Miniflare(convertV4MiniflareOptions({
    modules:true,script:bundle.outputFiles[0].text,compatibilityDate:'2026-10-30',compatibilityFlags:['nodejs_compat'],
    bindings:{AI_ENABLED:'true',AI_PROVIDER:'baseten',BASETEN_API_KEY:'fixture',SESSION_HMAC_SECRET:'synthetic-secret-at-least-32-bytes-for-test',TURNSTILE_SITE_KEY:'fixture',TURNSTILE_SECRET_KEY:'fixture'},
    serviceBindings:{UPSTREAM:async request=>{
      urls.push(request.url);
      if(urls.length===2)return Response.redirect('https://other.invalid/',307);
      return Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify({question:'What are you buying?',proposals:[],missingFields:['item'],sourceIds:[]})}}],usage:{prompt_tokens:500,completion_tokens:60,total_tokens:560}});
    }}
  }));
  try {
    const chat=()=>fixture.dispatchFetch('https://fixture.test/',{method:'POST',body:JSON.stringify({
      sessionId:crypto.randomUUID(),requestId:crypto.randomUUID(),idempotencyKey:crypto.randomUUID(),purpose:'intake',facts,
      history:[{role:'user',content:'Fictional stationery purchase'}]})});
    assert.equal((await (await chat()).json()).provider,'Baseten');
    assert.equal((await (await chat()).json()).code,'PROVIDER_UNAVAILABLE');
    assert.deepEqual(urls,Array(2).fill('https://inference.baseten.co/v1/chat/completions'));
  } finally {await fixture.dispose();}
});

test('a valid session survives exhausted session-creation quota without extending its expiry',async()=>{
 const guarded=createHandler({repositoryFactory:()=>({...repository,consumeThrottle:async()=>({allowed:false})})});
 const cookie='tikdam_session=11111111-1111-4111-8111-111111111111';
 const existing=await guarded.fetch(request('/api/session',{}, {Cookie:cookie}),env,{});
 assert.equal(existing.status,200);assert.equal(existing.headers.get('set-cookie'),null);
 assert.equal((await guarded.fetch(request('/api/session',{}),env,{})).status,429);
});
