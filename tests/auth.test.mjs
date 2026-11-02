import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPair, exportJWK, SignJWT } from 'jose';
import { createAdminVerifier } from '../worker/auth.mjs';
import { verifyChallenge } from '../worker/turnstile.mjs';

const env = { ACCESS_TEAM_DOMAIN: 'https://test-team.cloudflareaccess.com', ACCESS_AUD: 'tikdam-aud', ADMIN_EMAILS: 'owner@example.test' };
const { privateKey, publicKey } = await generateKeyPair('RS256');
const publicJwk = { ...(await exportJWK(publicKey)), kid: 'test-key', alg: 'RS256', use: 'sig' };
const jwksFetch = async () => Response.json({ keys: [publicJwk] });
const verifier = createAdminVerifier({fetchImpl: jwksFetch});
const token = async (claims={}) => new SignJWT({ email: 'owner@example.test', ...claims })
  .setProtectedHeader({ alg:'RS256', kid:'test-key' }).setSubject('owner-subject')
  .setIssuer(env.ACCESS_TEAM_DOMAIN).setAudience(env.ACCESS_AUD).setIssuedAt().setExpirationTime('5m').sign(privateKey);
const request = (jwt,extra={}) => new Request('https://tikdam.xyz/api/admin/overview',{headers:{...(jwt?{'Cf-Access-Jwt-Assertion':jwt}:{}),...extra}});

test('valid signed Access identity must also match owner allowlist', async () => {
  assert.deepEqual(await verifier(request(await token()),env),{subject:'owner-subject',email:'owner@example.test'});
  await assert.rejects(verifier(request(await token({email:'other@example.test'})),env),e=>e.status===403);
});
test('missing config, unsigned headers and forged signatures never authenticate', async () => {
  await assert.rejects(verifier(request(null,{'Cf-Access-Authenticated-User-Email':'owner@example.test'}),env),e=>e.status===403);
  await assert.rejects(verifier(request(await token()),{}),e=>e.status===403);
  const jwt=await token();
  const [head,payload,sig]=jwt.split('.');
  await assert.rejects(verifier(request(`${head}.${payload}.${sig.slice(0,-8)}AAAAAAAA`),env),e=>e.status===403);
});
test('expired wrong-audience wrong-issuer and future tokens are denied', async () => {
  for (const claims of [{exp:1},{aud:'other'},{iss:'https://attacker.test'},{nbf:Math.floor(Date.now()/1000)+3600}]) {
    const jwt=await new SignJWT({email:'owner@example.test',sub:'owner-subject',iss:env.ACCESS_TEAM_DOMAIN,aud:env.ACCESS_AUD,exp:Math.floor(Date.now()/1000)+600,...claims}).setProtectedHeader({alg:'RS256',kid:'test-key'}).sign(privateKey);
    await assert.rejects(verifier(request(jwt),env),e=>e.status===403);
  }
});
test('Access issuer cannot be an arbitrary key-server URL', async () => {
  await assert.rejects(verifier(request(await token()),{...env,ACCESS_TEAM_DOMAIN:'https://attacker.test'}),e=>e.status===403);
});
test('Turnstile checks success, exact hostname and operation before accepting', async () => {
  const request=new Request('https://tikdam.xyz/api/extract');
  const env={TURNSTILE_SECRET_KEY:'synthetic-test-secret',TURNSTILE_SITE_KEY:'synthetic-site-key'};
  const valid={success:true,hostname:'tikdam.xyz',action:'extract'};
  const verify=(body)=>verifyChallenge({token:'synthetic-turnstile-token',expectedAction:'extract',request,env,fetchImpl:async()=>Response.json(body)});
  assert.equal(await verify(valid),true);
  for(const bad of [{...valid,success:false},{...valid,hostname:'attacker.test'},{...valid,action:'chat'}]) await assert.rejects(verify(bad),e=>e.status===403);
  await assert.rejects(verifyChallenge({token:'x',expectedAction:'extract',request,env:{},fetchImpl:()=>{throw Error('must not call')}}),e=>e.status===503);
});
