import {z} from 'zod';
import {countries,indiaCheckDefinitions,clientSources} from '../server/catalog.mjs';
import {factsSchema} from '../server/schema.mjs';
import {planPurchase,assess} from '../server/domain.mjs';
import {requireAdmin} from './auth.mjs';
import {verifyChallenge} from './turnstile.mjs';
import {createEvaluationReporting} from '../server/evaluation/reporting.mjs';
import {json,safeError,securityHeaders,checkOrigin,readJson,normalizedPath,cookieValue,keyedDigest} from './http.mjs';

const uuid=z.string().uuid();
const country=factsSchema.shape.country;
const mode=z.enum(['before','purchase','client']);
const extractionSchema=z.object({consent:z.literal(true),file:z.object({name:z.string().max(180),data:z.string().max(8500000)}).strict()}).strict();
const chatSchema=z.object({purpose:z.enum(['intake','explain']),facts:factsSchema,history:z.array(z.object({role:z.enum(['user','assistant']),content:z.string().trim().min(1).max(1000)}).strict()).max(8)}).strict();
const eventSchema=z.object({id:uuid,event:z.enum(['workflow_started','example_loaded','pack_downloaded']),mode,country}).strict();
const feedbackSchema=z.object({text:z.string().trim().min(1).max(1000),mode,country}).strict();
const disabled={enabled:false,chatAvailable:false,extractionAvailable:false,reason:'AI is paused. Manual entry and source-linked guidance remain available.'};
const defaultRepo=async(db)=>{const {createRepository}=await import('../server/data/repository.mjs');return createRepository(db);};
const defaultAi=async(args)=>{const {createAiService}=await import('../server/ai/service.mjs');return createAiService(args);};
const defaultAdmin=async(request,args)=>{const {handleAdminRequest}=await import('../server/admin/routes.mjs');return handleAdminRequest(request,{...args,evaluationReporting:createEvaluationReporting(args.db)});};

async function coverage(){
  const module=await import('../server/catalog.mjs');
  if(typeof module.getCoverage==='function')return module.getCoverage();
  return countries.map(c=>({code:c.code,name:c.name,status:['GB','SG'].includes(c.code)?'limited_conditional_estimate':'guidance_only',sources:c.sources}));
}

export function createHandler({repositoryFactory=defaultRepo,aiFactory=defaultAi,adminVerifier=requireAdmin,challengeVerifier=verifyChallenge,adminHandler=defaultAdmin,fetchImpl=fetch}={}){
  async function fetchHandler(request,env,ctx={}){
    const requestId=crypto.randomUUID();
    try{
      const path=normalizedPath(request),lower=path.toLowerCase();
      const isApi=lower==='/api'||lower.startsWith('/api/');
      const isAdmin=lower==='/admin'||lower.startsWith('/admin/')||lower==='/api/admin'||lower.startsWith('/api/admin/');
      const mutation=!['GET','HEAD','OPTIONS'].includes(request.method);
      const url=checkOrigin(request,env,{mutation,protectedRead:isApi});
      if(env.CANONICAL_ORIGIN&&url.origin!==env.CANONICAL_ORIGIN){
        const canonical=String(env.CANONICAL_ORIGIN);
        const allowed=String(env.APP_ORIGINS||'').split(',').map(x=>x.trim());
        if(!allowed.includes(canonical)||new URL(canonical).origin!==canonical||!canonical.startsWith('https://'))throw safeError('HOST_NOT_ALLOWED',403,'Use the configured Tikdam address.');
        if(mutation)throw safeError('HOST_NOT_ALLOWED',403,'Use the canonical Tikdam address for this action.');
        return securityHeaders(new Response(null,{status:308,headers:{Location:`${canonical}${url.pathname}${url.search}`}}));
      }
      if(request.method==='OPTIONS')throw safeError('METHOD_NOT_ALLOWED',405,'Cross-origin API access is not supported.');
      if(/(?:^|\/)\.[^/]*(?:\/|$)/.test(path)||/\.(?:sql|map|env|toml|jsonc)$/i.test(path))throw safeError('NOT_FOUND',404,'Not found.');
      if(isAdmin){
        const admin=await adminVerifier(request,env);
        if(lower.startsWith('/api/admin')){
          if(mutation){
            const body=await readJson(request);
            request=new Request(request.url,{method:request.method,headers:request.headers,body:JSON.stringify(body)});
          }
          const repository=await repositoryFactory(env.DB);
          const response=await adminHandler(request,{repository,admin,coverage:await coverage(),db:env.DB});
          return securityHeaders(response||json({code:'NOT_FOUND',message:'Unknown admin API route.',requestId},404));
        }
        if(request.method!=='GET'&&request.method!=='HEAD')throw safeError('METHOD_NOT_ALLOWED',405,'Use GET to open the dashboard.');
        const asset=await env.ASSETS.fetch(new Request(new URL('/app.html',request.url),{method:request.method,headers:request.headers}));
        const headers=new Headers(asset.headers);headers.set('Cache-Control','no-store');
        return securityHeaders(new Response(asset.body,{status:asset.status,headers}));
      }
      if(!isApi){
        if(request.method!=='GET'&&request.method!=='HEAD')throw safeError('METHOD_NOT_ALLOWED',405,'Method not allowed.');
        if(!env.ASSETS)throw safeError('ASSETS_UNAVAILABLE',503,'Application assets are not configured.');
        const appPath=lower==='/app'||lower.startsWith('/app/');
        const assetPath=appPath?'/app.html':path==='/'?'/index.html':path;
        const asset=await env.ASSETS.fetch(new Request(new URL(assetPath,request.url),request));
        return securityHeaders(asset,{landing:!appPath&&assetPath!=='/app.html'});
      }
      if(path==='/api/config'&&request.method==='GET'){
        let ai={...disabled};
        try{
          const repository=await repositoryFactory(env.DB);
          const service=await aiFactory({env,repository,fetchImpl});
          ai={...disabled,...await service.capabilities()};
          const settings=await repository.getSettings();
          if(!settings.aiEnabled||env.AI_ENABLED!=='true')ai={...disabled};
        }catch{}
        if(!env.TURNSTILE_SITE_KEY||!env.TURNSTILE_SECRET_KEY||String(env.SESSION_HMAC_SECRET||'').length<32)ai={...disabled,reason:'AI controls are not configured. Manual entry remains available.'};
        const coverageRows=await coverage();
        return securityHeaders(json({countries:countries.map(c=>({code:c.code,name:c.name,currency:c.currency,tax:c.tax,idLabel:c.idLabel,sources:c.sources,coverage:coverageRows.find(row=>row.code===c.code)?.purchaseEstimate==='conditional_narrow'?'Guidance + limited conditional estimates':c.sources.length?'Guidance; estimates need review':'General evidence preparation; local rules not reviewed'})),coverage:coverageRows,indiaCheckDefinitions,clientSources:Object.values(clientSources),modelConfigured:Boolean(ai.extractionAvailable),model:env.META_MODEL||'muse-spark-1.3',provider:'Meta Model API',ai,turnstileSiteKey:env.TURNSTILE_SITE_KEY||null,limits:{fileMB:6,pdfPages:10},storage:'Invoices and profile facts are transient. Minimal operational metadata is eligible for bounded daily cleanup after 30 days, explicit feedback after 90 days; processing a backlog can take longer, and a minimal campaign spending ledger is retained to enforce the cap. Meta processing follows its service terms.'}));
      }
      if(['/api/plan','/api/assess'].includes(path)&&request.method==='POST'){
        const facts=factsSchema.parse(await readJson(request));
        const result=path==='/api/plan'?planPurchase(facts):assess(facts);
        try{
          const repository=await repositoryFactory(env.DB),session=await currentSession(request,repository,false);
          if(session){
            await throttle(repository,{key:`domain:${session.id}`,limit:60,windowSeconds:3600});
            await throttle(repository,{key:await throttleKey(request,env,'domain'),limit:100,windowSeconds:3600});
            const id=crypto.randomUUID();await repository.recordJob({id,sessionId:session.id,operation:path.slice(5),mode:facts.mode,country:facts.country,status:'running'});await repository.finishJob({id,status:'succeeded',durationMs:0});
          }
        }catch{}
        return securityHeaders(json(result));
      }
      if(path==='/api/session/clear'&&request.method==='POST'){
        z.object({}).strict().parse(await readJson(request,1024));
        const secure=new URL(request.url).protocol==='https:'?'; Secure':'';
        return securityHeaders(json({ok:true},200,{'Set-Cookie':`tikdam_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure}`}));
      }
      if(path==='/api/session'&&request.method==='POST'){
        z.object({}).strict().parse(await readJson(request,1024));
        const repository=await repositoryFactory(env.DB);
        const clientKey=await throttleKey(request,env,'session');
        await throttle(repository,{key:clientKey,limit:12,windowSeconds:3600});
        let session=await currentSession(request,repository,false);
        if(!session){const id=crypto.randomUUID();await repository.createSession({id,expiresAt:new Date(Date.now()+12*3600000).toISOString()});session={id};}
        const secure=new URL(request.url).protocol==='https:'?'; Secure':'';
        return securityHeaders(json({ok:true},200,{'Set-Cookie':`tikdam_session=${session.id}; Path=/; HttpOnly; SameSite=Strict; Max-Age=43200${secure}`}));
      }
      if(['/api/events','/api/feedback'].includes(path)&&request.method==='POST'){
        const body=(path==='/api/events'?eventSchema:feedbackSchema).parse(await readJson(request,8192));
        const repository=await repositoryFactory(env.DB),session=await currentSession(request,repository,true);
        const prefix=path==='/api/events'?'events':'feedback';
        await throttle(repository,{key:`${prefix}:${session.id}`,limit:prefix==='events'?100:5,windowSeconds:3600});
        await throttle(repository,{key:await throttleKey(request,env,prefix),limit:prefix==='events'?200:10,windowSeconds:3600});
        if(prefix==='events')await repository.recordEvent({...body,sessionId:session.id});
        else await repository.addFeedback({...body,id:crypto.randomUUID(),sessionId:session.id});
        return securityHeaders(json({ok:true}));
      }
      if(['/api/extract','/api/chat'].includes(path)&&request.method==='POST'){
        const repository=await repositoryFactory(env.DB),session=await currentSession(request,repository,true);
        const settings=await repository.getSettings();
        if(env.AI_ENABLED!=='true'||!settings.aiEnabled)throw safeError('AI_PAUSED',503,disabled.reason);
        const operation=path.slice(5);
        const body=(operation==='extract'?extractionSchema:chatSchema).parse(await readJson(request,operation==='extract'?9000000:32768));
        if(operation==='chat'&&!countries.find(c=>c.code===body.facts.country)?.sources.length)throw safeError('COUNTRY_NOT_REVIEWED',422,'AI guidance is available only for reviewed countries. Use the manual evidence checklist here.');
        const idempotencyKey=uuid.parse(request.headers.get('Idempotency-Key'));
        const clientKey=await throttleKey(request,env,operation);
        await throttle(repository,{key:`${operation}:${session.id}`,limit:3,windowSeconds:60});
        await throttle(repository,{key:clientKey,limit:5,windowSeconds:60});
        await challengeVerifier({token:request.headers.get('X-Turnstile-Token'),expectedAction:operation,request,env,fetchImpl});
        const service=await aiFactory({env,repository,fetchImpl});
        return securityHeaders(json(await service[operation]({...body,sessionId:session.id,idempotencyKey,requestId,clientKey})));
      }
      throw safeError('NOT_FOUND',404,'Unknown API route.');
    }catch(error){
      const validation=error instanceof z.ZodError;
      const known=Number.isInteger(error?.status)&&error.status>=400&&error.status<=599&&typeof error.code==='string';
      const code=validation?'INVALID_INPUT':known?error.code:'SERVICE_UNAVAILABLE';
      const message=validation?'Check the input fields and try again.':known?error.message:'This operation is temporarily unavailable. Manual guidance remains available.';
      return securityHeaders(json({code,message,requestId},validation?400:known?error.status:503));
    }
  }
  return {fetch:fetchHandler,async scheduled(event,env,ctx){const repository=await repositoryFactory(env.DB);await repository.cleanup();}};
}

async function currentSession(request,repository,required){
  const id=cookieValue(request,'tikdam_session');
  const parsed=uuid.safeParse(id);
  const row=parsed.success?await repository.getSession(id):null;
  if(!row&&required)throw safeError('SESSION_REQUIRED',401,'Start a new Tikdam session before this action.');
  return row;
}
async function throttle(repository,input){const result=await repository.consumeThrottle(input);if(!result.allowed)throw safeError('RATE_LIMITED',429,'Too many requests. Wait before trying again.');}
async function throttleKey(request,env,operation){
  const day=new Date().toISOString().slice(0,10);
  // CF-Connecting-IP is accepted only inside Cloudflare's request context. A
  // user-supplied forwarded header on local/custom request objects is ignored.
  const address=request.cf?request.headers.get('CF-Connecting-IP')||'unknown':'local-untrusted';
  return `${operation}:${await keyedDigest(env.SESSION_HMAC_SECRET,`${day}:${address}`)}`;
}

export default createHandler();
