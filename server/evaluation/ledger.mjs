import {z} from 'zod';
import {readFile} from 'node:fs/promises';

export const CAMPAIGN_ID='tikdam-v1-eval-2026-11-01';
const providerSchema=z.enum(['meta','modal','baseten']);
const safe=z.string().min(1).max(160).regex(/^[A-Za-z0-9._:-]+$/);
const integer=z.number().int().safe().nonnegative();
const requestSchema=z.object({id:safe,provider:providerSchema,operation:safe,fixtureId:safe,ceilingMicrousd:integer.max(4000000),maxAttempts:integer.min(1).max(1000),priceVersion:safe}).strict();
const settlementSchema=z.object({reservationId:safe,status:z.enum(['succeeded','unbilled','billing_unknown']),estimatedMicrousd:integer.optional(),inputTokens:integer.optional(),outputTokens:integer.optional(),errorCode:z.string().regex(/^[A-Z][A-Z0-9_]{0,79}$/).optional()}).strict();
const amount="CASE WHEN status='succeeded' THEN estimated_microusd WHEN status IN ('running','billing_unknown') THEN ceiling_microusd ELSE 0 END";
const failure=(message,code='INVALID_LEDGER_INPUT')=>Object.assign(new Error(message),{code});

export function createEvaluationLedger(db){
 if(!db?.prepare||!db?.batch)throw failure('A persistent D1 database is required.','STORAGE_UNAVAILABLE');
 const statement=(sql,args=[])=>db.prepare(sql).bind(...args);
 const first=(sql,args=[])=>statement(sql,args).first();
 const run=(sql,args=[])=>statement(sql,args).run();
 const all=async(sql,args=[])=>(await statement(sql,args).all()).results;
 async function init(){
  const sql=await readFile(new URL('./schema.sql',import.meta.url),'utf8');
  await db.batch(sql.split(';').map(s=>s.trim()).filter(Boolean).map(s=>db.prepare(s)));
 }
 async function summary(){
  const campaign=await first('SELECT * FROM evaluation_campaign WHERE id=?',[CAMPAIGN_ID]);if(!campaign)throw failure('Evaluation campaign is not initialized.');
  const configs=await all('SELECT * FROM evaluation_providers ORDER BY provider');const providers={};
  for(const c of configs){
   const costs=await first("SELECT COALESCE(SUM(CASE WHEN status='succeeded' THEN estimated_microusd ELSE 0 END),0) spent,COALESCE(SUM(CASE WHEN status IN ('running','billing_unknown') THEN ceiling_microusd ELSE 0 END),0) reserved FROM evaluation_reservations WHERE provider=?",[c.provider]);
   const attempts=await first('SELECT COUNT(*) n FROM evaluation_attempts a JOIN evaluation_reservations r ON r.id=a.reservation_id WHERE r.provider=?',[c.provider]);
   const slots=await first("SELECT COALESCE(SUM(max_attempts-(SELECT COUNT(*) FROM evaluation_attempts WHERE reservation_id=r.id)),0) n FROM evaluation_reservations r WHERE provider=? AND status='running'",[c.provider]);
   providers[c.provider]={capMicrousd:c.cap_microusd,operatingStopMicrousd:c.operating_stop_microusd,spentMicrousd:costs.spent,reservedMicrousd:costs.reserved,remainingMicrousd:Math.max(0,c.cap_microusd-costs.spent-costs.reserved),operatingRemainingMicrousd:Math.max(0,c.operating_stop_microusd-costs.spent-costs.reserved),attempts:attempts.n,reservedAttempts:slots.n,attemptCap:c.attempt_cap,paused:Boolean(c.paused),pauseReason:c.pause_reason};
  }
  const values=Object.values(providers),spentMicrousd=values.reduce((n,p)=>n+p.spentMicrousd,0),reservedMicrousd=values.reduce((n,p)=>n+p.reservedMicrousd,0);
  const running=await first("SELECT COUNT(*) n FROM evaluation_reservations WHERE status='running'");
  return{campaignId:CAMPAIGN_ID,paused:Boolean(campaign.paused),pauseReason:campaign.pause_reason,combined:{capMicrousd:campaign.cap_microusd,spentMicrousd,reservedMicrousd,remainingMicrousd:Math.max(0,campaign.cap_microusd-spentMicrousd-reservedMicrousd)},providers,inFlight:running.n};
 }
 async function reserve(input){
  const v=requestSchema.parse(input),now=new Date().toISOString();
  // One serialized SQLite INSERT performs every admission check against the
  // same primary state. No read-then-write application lock admits requests.
  const row=await first(`INSERT INTO evaluation_reservations(id,provider,operation,fixture_id,ceiling_microusd,max_attempts,price_version,status,created_at)
   SELECT ?,?,?,?,?,?,?,'running',? FROM evaluation_providers p JOIN evaluation_campaign c ON c.id=?
   WHERE p.provider=? AND p.paused=0 AND c.paused=0
   AND NOT EXISTS(SELECT 1 FROM evaluation_reservations WHERE status='running')
   AND (SELECT COALESCE(SUM(${amount}),0) FROM evaluation_reservations WHERE provider=p.provider)+?<=p.operating_stop_microusd
   AND (SELECT COALESCE(SUM(${amount}),0) FROM evaluation_reservations WHERE provider=p.provider)+?<=p.cap_microusd
   AND (SELECT COALESCE(SUM(${amount}),0) FROM evaluation_reservations)+?<=c.cap_microusd
   AND (SELECT COUNT(*) FROM evaluation_attempts a JOIN evaluation_reservations r ON r.id=a.reservation_id WHERE r.provider=p.provider)
     +(SELECT COALESCE(SUM(max_attempts-(SELECT COUNT(*) FROM evaluation_attempts WHERE reservation_id=r.id)),0) FROM evaluation_reservations r WHERE r.provider=p.provider AND r.status='running')+?<=p.attempt_cap
   ON CONFLICT(id) DO NOTHING RETURNING id`,[v.id,v.provider,v.operation,v.fixtureId,v.ceilingMicrousd,v.maxAttempts,v.priceVersion,now,CAMPAIGN_ID,v.provider,v.ceilingMicrousd,v.ceilingMicrousd,v.ceilingMicrousd,v.maxAttempts]);
  if(row)return{admitted:true,reason:null,reservationId:row.id};
  const existing=await first('SELECT * FROM evaluation_reservations WHERE id=?',[v.id]);
  if(existing){const equal=existing.provider===v.provider&&existing.operation===v.operation&&existing.fixture_id===v.fixtureId&&existing.ceiling_microusd===v.ceilingMicrousd&&existing.max_attempts===v.maxAttempts&&existing.price_version===v.priceVersion;return{admitted:false,reason:equal?'ALREADY_PROCESSED':'IDEMPOTENCY_CONFLICT',reservationId:existing.id};}
  const s=await summary(),p=s.providers[v.provider];
  const reason=s.paused?'CAMPAIGN_PAUSED':p.paused?'PROVIDER_PAUSED':s.inFlight?'IN_FLIGHT':p.attempts+p.reservedAttempts+v.maxAttempts>p.attemptCap?'ATTEMPT_LIMIT':v.ceilingMicrousd>p.operatingRemainingMicrousd?'OPERATING_STOP':'BUDGET_EXHAUSTED';
  return{admitted:false,reason,reservationId:null};
 }
 async function recordAttempt(input){
  const v=z.object({reservationId:safe,kind:z.enum(['preflight','generation','metadata','compute','cleanup'])}).strict().parse(input);const id=crypto.randomUUID();
  // The attempt row is durable before the caller invokes fetch. Concurrent
  // recorders cannot consume the same last reserved/authorized send slot.
  const row=await first(`INSERT INTO evaluation_attempts(id,reservation_id,kind,created_at)
   SELECT ?,r.id,?,? FROM evaluation_reservations r JOIN evaluation_providers p ON p.provider=r.provider JOIN evaluation_campaign c ON c.id=?
   WHERE r.id=? AND r.status='running' AND p.paused=0 AND c.paused=0
   AND (SELECT COUNT(*) FROM evaluation_attempts WHERE reservation_id=r.id)<r.max_attempts
   AND (SELECT COUNT(*) FROM evaluation_attempts a JOIN evaluation_reservations rr ON rr.id=a.reservation_id WHERE rr.provider=r.provider)<p.attempt_cap
   RETURNING id`,[id,v.kind,new Date().toISOString(),CAMPAIGN_ID,v.reservationId]);
  return{admitted:Boolean(row),attemptId:row?.id??null,reason:row?null:'ATTEMPT_NOT_ADMITTED'};
 }
 async function settle(input){
  const v=settlementSchema.parse(input);
  if(v.status==='succeeded'&&v.estimatedMicrousd===undefined)throw failure('Successful settlement requires an estimated cost.');
  if(v.status!=='succeeded'&&(v.estimatedMicrousd!==undefined||v.inputTokens!==undefined||v.outputTokens!==undefined))throw failure('Only successful settlement can report usage/cost.');
  const fields=[v.status,v.estimatedMicrousd??null,v.inputTokens??0,v.outputTokens??0,v.errorCode??null,new Date().toISOString(),v.reservationId,v.estimatedMicrousd??0];
  const update=statement("UPDATE evaluation_reservations SET status=?,estimated_microusd=?,input_tokens=?,output_tokens=?,error_code=?,finished_at=? WHERE id=? AND status='running' AND ?<=ceiling_microusd",fields);
  const statements=[update];
  if(v.status==='billing_unknown')statements.push(statement("UPDATE evaluation_providers SET paused=1,pause_reason=? WHERE provider=(SELECT provider FROM evaluation_reservations WHERE id=? AND status='billing_unknown')",[v.errorCode||'BILLING_UNKNOWN',v.reservationId]));
  const results=await db.batch(statements);if(results[0].meta.changes)return{settled:true};
  const prior=await first('SELECT * FROM evaluation_reservations WHERE id=?',[v.reservationId]);if(!prior)throw failure('Unknown reservation.');
  if((v.estimatedMicrousd??0)>prior.ceiling_microusd)throw failure('Estimated cost exceeds reservation ceiling.');
  if(prior.status===v.status&&prior.estimated_microusd===(v.estimatedMicrousd??null)&&prior.input_tokens===(v.inputTokens??0)&&prior.output_tokens===(v.outputTokens??0)&&prior.error_code===(v.errorCode??null))return{settled:true};
  throw failure('Reservation is already settled and its cost history is immutable.');
 }
 async function pause(provider,reason){
  z.enum(['meta','modal','baseten','*']).parse(provider);const safeReason=z.string().regex(/^[A-Z][A-Z0-9_]{0,79}$/).parse(reason);
  if(provider==='*')await run('UPDATE evaluation_campaign SET paused=1,pause_reason=? WHERE id=?',[safeReason,CAMPAIGN_ID]);else await run('UPDATE evaluation_providers SET paused=1,pause_reason=? WHERE provider=?',[safeReason,provider]);
 }
 async function rows(){return{reservations:await all('SELECT * FROM evaluation_reservations ORDER BY created_at,id'),attempts:await all('SELECT a.*,r.provider,r.fixture_id,r.operation FROM evaluation_attempts a JOIN evaluation_reservations r ON r.id=a.reservation_id ORDER BY a.created_at,a.id')};}
 return{init,reserve,recordAttempt,settle,pause,summary,rows};
}
