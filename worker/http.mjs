export function safeError(code, status, message) {
  return Object.assign(new Error(message), { code, status });
}

export function json(value, status=200, extra={}) {
  return new Response(JSON.stringify(value), {status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...extra}});
}

export function securityHeaders(response) {
  const headers=new Headers(response.headers);
  headers.set('X-Content-Type-Options','nosniff');
  headers.set('Referrer-Policy','strict-origin-when-cross-origin');
  headers.set('Permissions-Policy','camera=(), microphone=(), geolocation=()');
  headers.set('X-Frame-Options','DENY');
  headers.set('Strict-Transport-Security','max-age=31536000');
  headers.set('Content-Security-Policy',"default-src 'self'; script-src 'self' https://challenges.cloudflare.com; style-src 'self'; img-src 'self' blob: data:; connect-src 'self' https://challenges.cloudflare.com; frame-src https://challenges.cloudflare.com; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'");
  return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
}

export function checkOrigin(request,env,{mutation=false,protectedRead=false}={}) {
  const url=new URL(request.url);
  const allowed=String(env.APP_ORIGINS||'').split(',').map(x=>x.trim()).filter(Boolean);
  if(!allowed.includes(url.origin)) throw safeError('HOST_NOT_ALLOWED',403,'Use the configured Tikdam address.');
  const origin=request.headers.get('Origin');
  if((origin&&origin!==url.origin)||(mutation&&origin!==url.origin)) throw safeError('ORIGIN_NOT_ALLOWED',403,'This request must come from Tikdam.');
  if((mutation||protectedRead)&&request.headers.get('Sec-Fetch-Site')==='cross-site') throw safeError('ORIGIN_NOT_ALLOWED',403,'Cross-site requests are not accepted.');
  return url;
}

export async function readJson(request,maxBytes=65536) {
  if(!/^application\/json(?:\s*;|$)/i.test(request.headers.get('Content-Type')||'')) throw safeError('JSON_REQUIRED',415,'Send JSON from the app.');
  const declared=Number(request.headers.get('Content-Length'));
  if(Number.isFinite(declared)&&declared>maxBytes) throw safeError('BODY_TOO_LARGE',413,'The request is too large.');
  const reader=request.body?.getReader();
  if(!reader) throw safeError('INVALID_JSON',400,'A JSON body is required.');
  let size=0;
  const chunks=[];
  try {
    while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>maxBytes){await reader.cancel();throw safeError('BODY_TOO_LARGE',413,'The request is too large.');}chunks.push(value);}
  }finally{reader.releaseLock();}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
  let body;
  try{body=JSON.parse(new TextDecoder().decode(bytes));}catch{throw safeError('INVALID_JSON',400,'Invalid JSON request.');}
  if(!body||typeof body!=='object'||Array.isArray(body))throw safeError('INVALID_JSON',400,'A JSON object is required.');
  return body;
}

export function normalizedPath(request) {
  let path;
  try{path=decodeURIComponent(new URL(request.url).pathname);}catch{throw safeError('INVALID_PATH',400,'Invalid request path.');}
  if(/[%\\\x00-\x1f]/.test(path))throw safeError('INVALID_PATH',400,'Invalid request path.');
  return path.replace(/\/{2,}/g,'/');
}

export function cookieValue(request,name) {
  const matches=(request.headers.get('Cookie')||'').split(';').map(x=>x.trim()).filter(x=>x.startsWith(name+'='));
  return matches.length===1?matches[0].slice(name.length+1):null;
}

export async function keyedDigest(secret,value) {
  if(typeof secret!=='string'||secret.length<32)throw safeError('CONTROLS_UNAVAILABLE',503,'Processing controls are not configured. Manual entry remains available.');
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const digest=await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,'0')).join('');
}
