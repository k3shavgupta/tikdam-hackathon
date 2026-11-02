import {z} from 'zod';

const campaign='tikdam-v1-eval-2026-11-01';
const integer=z.number().int().safe().nonnegative();
const code=z.string().regex(/^[A-Z][A-Z0-9_]{0,79}$/).nullable();
const price=z.string().min(1).max(160).regex(/^[A-Za-z0-9._:-]+$/);
const timestamp=z.string().regex(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/).refine(v=>!Number.isNaN(Date.parse(v))&&new Date(v).toISOString()===v);
const kinds=['preflight','generation','metadata','compute','cleanup'];
const names=['meta','modal','baseten'];
const providerShape=(cap,stop)=>z.object({capMicrousd:z.literal(cap),operatingStopMicrousd:z.literal(stop),spentMicrousd:integer,reservedMicrousd:integer,remainingMicrousd:integer,attempts:integer.max(1000),reservedAttempts:integer.max(1000),attemptsByKind:z.object(Object.fromEntries(kinds.map(k=>[k,integer.max(1000)]))).strict(),inputTokens:integer,outputTokens:integer,billingUnknown:integer,paused:z.boolean(),pauseReason:code,priceVersions:z.array(price).max(100)}).strict();
export const evaluationSnapshotSchema=z.object({version:z.literal(1),campaignId:z.literal(campaign),scope:z.literal('evaluation_only'),source:z.literal('local_evaluation_ledger'),billingEvidence:z.literal('estimated_not_invoice'),generatedAt:timestamp,paused:z.boolean(),pauseReason:code,combined:z.object({capMicrousd:z.literal(4000000),spentMicrousd:integer,reservedMicrousd:integer,remainingMicrousd:integer}).strict(),providers:z.object({meta:providerShape(3000000,2700000),modal:providerShape(500000,450000),baseten:providerShape(500000,450000)}).strict(),inFlight:integer.max(1)}).strict().superRefine((v,ctx)=>{
 let spent=0,reserved=0;
 for(const name of names){const p=v.providers[name];spent+=p.spentMicrousd;reserved+=p.reservedMicrousd;
  if(p.spentMicrousd+p.reservedMicrousd>p.capMicrousd||p.remainingMicrousd!==p.capMicrousd-p.spentMicrousd-p.reservedMicrousd||Object.values(p.attemptsByKind).reduce((n,x)=>n+x,0)!==p.attempts||p.attempts+p.reservedAttempts>1000)ctx.addIssue({code:'custom',message:'Inconsistent provider totals.',path:['providers',name]});
 }
 if(spent!==v.combined.spentMicrousd||reserved!==v.combined.reservedMicrousd||spent+reserved>4000000||v.combined.remainingMicrousd!==4000000-spent-reserved)ctx.addIssue({code:'custom',message:'Inconsistent combined totals.'});
});

export const evaluationReportingSchemaSql=`CREATE TABLE IF NOT EXISTS evaluation_report_snapshots (
 campaign_id TEXT PRIMARY KEY CHECK(campaign_id='tikdam-v1-eval-2026-11-01'),
 generated_at TEXT NOT NULL,
 payload_json TEXT NOT NULL CHECK(json_valid(payload_json))
);`;

export function buildEvaluationSnapshot(summary,rows,{generatedAt=new Date().toISOString()}={}){
 if(summary?.campaignId!==campaign||!Array.isArray(rows?.reservations)||!Array.isArray(rows?.attempts))throw Error('A complete evaluation ledger is required.');
 const providers={};
 for(const name of names){
  const s=summary.providers[name];const reservations=rows.reservations.filter(r=>r.provider===name),attempts=rows.attempts.filter(a=>a.provider===name);
  const versions=[...new Set(reservations.map(r=>r.price_version))].sort();
  providers[name]={capMicrousd:s.capMicrousd,operatingStopMicrousd:s.operatingStopMicrousd,spentMicrousd:s.spentMicrousd,reservedMicrousd:s.reservedMicrousd,remainingMicrousd:s.remainingMicrousd,attempts:s.attempts,reservedAttempts:s.reservedAttempts,attemptsByKind:Object.fromEntries(kinds.map(k=>[k,attempts.filter(a=>a.kind===k).length])),inputTokens:reservations.reduce((n,r)=>n+(r.input_tokens||0),0),outputTokens:reservations.reduce((n,r)=>n+(r.output_tokens||0),0),billingUnknown:reservations.filter(r=>r.status==='billing_unknown').length,paused:s.paused,pauseReason:s.pauseReason,priceVersions:versions};
 }
 return evaluationSnapshotSchema.parse({version:1,campaignId:summary.campaignId,scope:'evaluation_only',source:'local_evaluation_ledger',billingEvidence:'estimated_not_invoice',generatedAt,paused:summary.paused,pauseReason:summary.pauseReason,combined:summary.combined,providers,inFlight:summary.inFlight});
}

const monotonicFields=['spentMicrousd','attempts','inputTokens','outputTokens'];
const upsert=(values)=>`INSERT INTO evaluation_report_snapshots(campaign_id,generated_at,payload_json) VALUES(${values}) ON CONFLICT(campaign_id) DO UPDATE SET generated_at=excluded.generated_at,payload_json=excluded.payload_json WHERE excluded.generated_at>evaluation_report_snapshots.generated_at ${names.flatMap(name=>monotonicFields.map(field=>`AND json_extract(excluded.payload_json,'$.providers.${name}.${field}')>=json_extract(evaluation_report_snapshots.payload_json,'$.providers.${name}.${field}')`)).join(' ')}`;
const literal=value=>"'"+String(value).replaceAll("'","''")+"'";
export function snapshotToSql(snapshot){
 const safe=evaluationSnapshotSchema.parse(snapshot);
 return upsert([safe.campaignId,safe.generatedAt,JSON.stringify(safe)].map(literal).join(','))+';';
}
export function createEvaluationReporting(db){
 if(!db?.prepare)throw Error('Operational reporting storage is unavailable.');
 return{
  async importSnapshot(snapshot){const safe=evaluationSnapshotSchema.parse(snapshot);const result=await db.prepare(upsert('?,?,?')).bind(safe.campaignId,safe.generatedAt,JSON.stringify(safe)).run();return{imported:result.meta.changes>0};},
  async latest(){const row=await db.prepare('SELECT payload_json FROM evaluation_report_snapshots WHERE campaign_id=?').bind(campaign).first();return row?evaluationSnapshotSchema.parse(JSON.parse(row.payload_json)):null;},
 };
}
