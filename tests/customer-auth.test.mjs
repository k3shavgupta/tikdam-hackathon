import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPair, exportSPKI, SignJWT } from 'jose';
import { requireCustomer } from '../worker/customer-auth.mjs';
import { clerkConfig } from '../server/clerk-config.mjs';
import { createHandler } from '../worker/index.mjs';
import { build } from 'esbuild';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';

const { privateKey, publicKey } = await generateKeyPair('RS256');
const issuer = 'https://clerk.example.test';
const env = { APP_ORIGINS: 'https://tikdam.xyz', CLERK_PUBLISHABLE_KEY: `pk_live_${btoa('clerk.example.test$').replace(/=+$/, '')}`, CLERK_JWT_KEY: await exportSPKI(publicKey) };
const token = async (claims = {}, key = privateKey) => new SignJWT({ azp: 'https://tikdam.xyz', sid: 'sess_test', ...claims })
  .setProtectedHeader({ alg: 'RS256', kid: 'synthetic' }).setSubject('user_test').setIssuer(issuer).setIssuedAt().setNotBefore('0s').setExpirationTime('5m').sign(key);
const request = jwt => new Request('https://tikdam.xyz/api/account', { headers: jwt ? { Authorization: `Bearer ${jwt}` } : {} });

test('customer identity is verified with the public signing key and no Clerk secret', async () => {
  assert.deepEqual(await requireCustomer(request(await token()), env), { userId: 'user_test' });
});
test('missing, forged, expired, other-site and incomplete customer sessions fail closed', async () => {
  const other = await generateKeyPair('RS256');
  const badTokens = [null, 'forged', await token({}, other.privateKey), await token({azp:'https://evil.test'}), await token({azp:undefined}), await token({sid:undefined}), await token({sts:'pending'})];
  // Override registered claims after setting the defaults.
  for (const claims of [{ exp: 1 }, { iss: 'https://other.clerk.accounts.dev' }, { nbf: Math.floor(Date.now()/1000)+600 }]) {
    badTokens.push(await new SignJWT({sub:'user_test',sid:'sess_test',azp:'https://tikdam.xyz',iss:issuer,iat:Math.floor(Date.now()/1000),nbf:0,exp:Math.floor(Date.now()/1000)+600,...claims}).setProtectedHeader({alg:'RS256',kid:'synthetic'}).sign(privateKey));
  }
  for(const jwt of badTokens) await assert.rejects(requireCustomer(request(jwt),env),e=>e.status===401);
});

test('Clerk session verification runs in the actual Workers runtime with no private key',async()=>{
  const bundle=await build({entryPoints:[new URL('../worker/index.mjs',import.meta.url).pathname],bundle:true,write:false,format:'esm',platform:'browser',external:['node:*']});
  const fixture=new Miniflare(convertV4MiniflareOptions({modules:true,script:bundle.outputFiles[0].text,compatibilityDate:'2026-10-30',compatibilityFlags:['nodejs_compat'],bindings:env}));
  try{
    const response=await fixture.dispatchFetch('https://tikdam.xyz/api/account',{headers:{Authorization:`Bearer ${await token()}`}});
    assert.equal(response.status,200);assert.deepEqual(await response.json(),{userId:'user_test'});
    const forged=await fixture.dispatchFetch('https://tikdam.xyz/api/account',{headers:{Authorization:'Bearer forged'}});
    assert.equal(forged.status,401);
  }finally{await fixture.dispose();}
});
test('auth configuration fails closed and exposes no private keys', async () => {
  assert.equal(clerkConfig({}).enabled,false);
  assert.equal(clerkConfig({...env,CLERK_PUBLISHABLE_KEY:'pk_live_invalid'}).enabled,false);
  assert.equal(clerkConfig({...env,CLERK_JWT_KEY:undefined}).enabled,false);
  const api=createHandler();
  const response=await api.fetch(new Request('https://tikdam.xyz/api/auth/config'),env);
  assert.deepEqual(await response.json(),{enabled:true,publishableKey:env.CLERK_PUBLISHABLE_KEY});
  assert.equal(response.headers.get('cache-control'),'no-store');
  assert.equal((await api.fetch(request(null),env)).status,401);
  assert.equal((await api.fetch(request(null),{APP_ORIGINS:env.APP_ORIGINS})).status,503);
});
test('a Clerk customer cannot access owner routes and guest checks stay public', async () => {
  const api=createHandler();
  const jwt=await token();
  const response=await api.fetch(new Request('https://tikdam.xyz/api/admin/overview',{headers:{Authorization:`Bearer ${jwt}`}}),env);
  assert.equal(response.status,403);
  const guest=await api.fetch(new Request('https://tikdam.xyz/api/plan',{method:'POST',headers:{Origin:'https://tikdam.xyz','Content-Type':'application/json'},body:JSON.stringify({mode:'before',country:'IN',businessCountry:'IN'})}),env);
  assert.equal(guest.status,200);
  assert.equal((await api.fetch(new Request('https://tikdam.xyz/api/account',{headers:{Authorization:`Bearer ${jwt}`,Origin:'https://evil.test'}}),env)).status,403);
});
test('Clerk CSP applies only to app routes; inline scripts stay blocked everywhere',async()=>{
  const api=createHandler({adminVerifier:async()=>({subject:'owner'})});
  const assets={...env,ASSETS:{fetch:async()=>new Response('app')}};
  for(const path of ['/','/app','/app/sign-in','/app/sign-up/verify-email-address','/admin']){
    const r=await api.fetch(new Request(`https://tikdam.xyz${path}`),assets);
    assert.equal(r.status,200);
    const csp=r.headers.get('content-security-policy');
    assert.equal(csp.includes(issuer),path.startsWith('/app'));
    assert.doesNotMatch(csp.match(/script-src[^;]+/)[0],/unsafe-inline|unsafe-eval/);
  }
});
