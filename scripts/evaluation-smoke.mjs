// HTTP checks only: no extraction/chat generation requests or provider credentials.
import assert from 'node:assert/strict';
import {purchaseFacts} from '../tests/fixtures/evaluation/manifest.mjs';
const base=process.argv[2];
if(!['https://tikdam.xyz','https://tikdam-v1-staging.k3shavgupta.workers.dev'].includes(base))throw Error('Choose the verified preview or production origin.');
const checks=[];
async function get(path,status){const r=await fetch(base+path,{redirect:'manual',signal:AbortSignal.timeout(15000)});assert.equal(r.status,status,path);checks.push({path,status:r.status});return r;}
async function post(path,body,status=200,headers={}){const r=await fetch(base+path,{method:'POST',headers:{Origin:base,'Content-Type':'application/json',...headers},body:JSON.stringify(body),redirect:'manual',signal:AbortSignal.timeout(15000)});assert.equal(r.status,status,path);checks.push({path,status:r.status});return r;}
const production = base === 'https://tikdam.xyz';
const home = await (await get('/', 200)).text();
assert.match(home, /href="\/app"/, 'Landing page links to the checker');
const html = await (await get('/app', 200)).text();
const asset = html.match(/src="([^"]*\/assets\/index-[^"]+\.js)"/)?.[1];
assert.ok(asset && asset.startsWith('/') && !asset.startsWith('//'), 'Checker loads its local bundle');
assert.match((await get(asset,200)).headers.get('content-type'), /javascript/);
const config = await (await get('/api/config',200)).json();
assert.equal(new Set(config.countries.map(c => c.code)).size, 250);
assert.equal(config.countries.filter(c => c.sources?.length).length, 11);
if (!production) assert.equal(config.ai.chatAvailable, false);
else if (!config.ai.chatAvailable) assert.ok(config.ai.reason, 'A paused assistant must explain why');
assert.equal(config.ai.extractionAvailable, false);
if (production) {
  assert.equal(config.provider, 'Meta Model API');
  assert.equal(config.model, 'muse-spark-1.3');
}
for (const path of ['/admin','/api/admin/overview','/api/admin/evaluation']) {
  const response = await get(path, production ? 302 : 403);
  if (production) assert.match(new URL(response.headers.get('location')).hostname, /\.cloudflareaccess\.com$/);
}
for(const path of ['/.env.local','/server/evaluation/schema.sql','/api/missing','/unlisted-page','/app/unlisted-page'])await get(path,404);
const pre=await(await post('/api/plan',{mode:'before',country:'GB',businessCountry:'GB',item:'Fictional office stationery'})).json();assert.equal(pre.guaranteedRefund,false);
for(const country of ['IN','GB','SG']){const data=await(await post('/api/assess',purchaseFacts(country))).json();assert.equal(data.status,'conditional');assert.equal(data.benefit.amount,'20.00');assert.equal(data.cashRefund,null);assert.equal(data.verification,'user_assertions_only');}
const unconfirmed=await(await post('/api/assess',{...purchaseFacts('GB'),invoiceConfirmed:false})).json();assert.equal(unconfirmed.benefit.amount,null);
const foreign=await(await post('/api/assess',{...purchaseFacts('GB'),businessCountry:'JP'})).json();assert.equal(foreign.benefit.amount,null);
const client=await(await post('/api/assess',{...purchaseFacts('GB'),mode:'client',gross:'120',amountReceived:'100',withheld:'20'})).json();assert.equal(client.benefit.amount,null);assert.equal(client.cashRefund,null);
await post('/api/plan',{mode:'before',country:'GB',businessCountry:'GB',eligibility:'APPROVED'},400);
await post('/api/plan',{mode:'before',country:'GB',businessCountry:'GB'},403,{Origin:'https://evil.invalid'});
const session=await post('/api/session',{});const cookie=session.headers.get('set-cookie');assert.match(cookie,/HttpOnly/);assert.match(cookie,/Secure/);assert.match(cookie,/SameSite=Strict/);
if(!production && process.argv.includes('--write-feedback')){const auth={Cookie:cookie.split(';')[0]};await post('/api/events',{id:crypto.randomUUID(),event:'workflow_started',mode:'purchase',country:'GB'},200,auth);await post('/api/feedback',{text:'FICTIONAL EVALUATION: preview feedback transport check.',mode:'purchase',country:'GB'},200,auth);}
const cleared=await post('/api/session/clear',{},200,{Cookie:cookie.split(';')[0]});assert.match(cleared.headers.get('set-cookie'),/Max-Age=0/);await post('/api/feedback',{text:'Synthetic unauthenticated test.',mode:'purchase',country:'GB'},401);
if(base==='https://tikdam.xyz'){const r=await fetch('https://www.tikdam.xyz',{redirect:'manual',signal:AbortSignal.timeout(15000)});assert.equal(r.status,308);assert.equal(r.headers.get('location'),'https://tikdam.xyz/');checks.push({path:'www canonical redirect',status:r.status});}
console.log(JSON.stringify({base,passed:checks.length,chatAvailable:config.ai.chatAvailable,providerCalls:0,checks},null,2));
