import {createRemoteJWKSet,jwtVerify,customFetch} from 'jose';
import {cookieValue,safeError} from './http.mjs';

export function createAdminVerifier({fetchImpl=fetch}={}) {
  const keysets=new Map();
  return async function requireAdmin(request,env) {
    try {
      const issuer=String(env.ACCESS_TEAM_DOMAIN||'').replace(/\/$/,'');
      if(!/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/i.test(issuer))throw Error();
      const audience=String(env.ACCESS_AUD||'').trim();
      const emails=String(env.ADMIN_EMAILS||'').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean);
      if(!audience||emails.length===0)throw Error();
      const token=request.headers.get('Cf-Access-Jwt-Assertion')||cookieValue(request,'CF_Authorization');
      if(!token||token.length>16384)throw Error();
      let keys=keysets.get(issuer);
      if(!keys){keys=createRemoteJWKSet(new URL(`${issuer}/cdn-cgi/access/certs`),{[customFetch]:fetchImpl,timeoutDuration:5000,cooldownDuration:30000});keysets.set(issuer,keys);}
      const {payload}=await jwtVerify(token,keys,{issuer,audience,algorithms:['RS256'],clockTolerance:5,requiredClaims:['exp','sub','email']});
      if(typeof payload.sub!=='string'||!payload.sub||payload.sub.length>200||typeof payload.email!=='string'||!emails.includes(payload.email.toLowerCase()))throw Error();
      return {subject:payload.sub,email:payload.email.toLowerCase()};
    } catch {
      throw safeError('ADMIN_ACCESS_DENIED',403,'Administrator access requires the configured owner login.');
    }
  };
}

export const requireAdmin=createAdminVerifier();
