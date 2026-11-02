# V1 integration contracts

Frozen initial version, 1 November 2026. Lead coordinates changes. Read the root orchestration prompt for product/security constraints. No provider calls during agent implementation.

## Ownership

Tax worker owns existing domain/catalog/schema and domain tests plus route research. Data worker owns migrations, `server/data/`, `server/admin/`, and data/admin tests. Runtime worker owns `worker/`, Wrangler configuration and worker/auth tests. Later AI worker owns `server/meta.mjs`, `server/ai/`, and AI/meta/budget tests. Later UI worker owns new `src/components/`, `src/admin/`, `src/api.mjs`, `src/admin.css`, and UI tests. Lead owns package files, existing frontend entry/App/style, Node entry, docs and integration. Do not edit another owner's files without coordination.

## Runtime bindings

- `DB`: D1, primary writes for budgets.
- `ASSETS`: built `dist` only.
- `META_MODEL_API_KEY`, `META_MODEL` default `muse-spark-1.3`.
- `AI_ENABLED`: string `false` initially. DB switch must also be on to admit AI.
- `APP_ORIGINS`: comma-separated exact allowed HTTPS origins. Local development exceptions explicit.
- `SESSION_HMAC_SECRET`: server HMAC for normalized payload/client throttle digests, random at least 32 bytes.
- `ACCESS_TEAM_DOMAIN`: HTTPS Access issuer/team hostname; `ACCESS_AUD`: application audience; `ADMIN_EMAILS`: comma-separated verified owner identities. Missing configuration denies admin.
- `TURNSTILE_SITE_KEY`: public; `TURNSTILE_SECRET_KEY`: private. Missing either disables public AI.
- No browser-facing secret fields or environment dump.

## Repository

`createRepository(db, {clock = () => Date.now()} = {})` returns the following async methods. Dates are ISO UTC strings unless explicitly `utcDay` YYYY-MM-DD. IDs are server-generated random UUIDs, except validated client event/idempotency keys. All monetary values are integer micro-USD. Expiry default session twelve hours, operational rows thirty days, feedback ninety days. Minimal spending ledger retained across cleanup.

- `createSession({id,expiresAt})`, `getSession(id)` returns a valid row or null.
- `recordEvent({id,sessionId,event,mode,country})`. Event allowlist `workflow_started`, `example_loaded`, `pack_downloaded`. No arbitrary properties. Deduplicate event id per session. Processing completion is derived from server jobs, not events.
- `recordJob({id,sessionId,operation,mode,country,model,status})`, `finishJob({id,status,errorCode,durationMs,tokens,estimatedMicrousd})`. `operation`: plan/assess/extract/chat. Status running/succeeded/failed/billing_unknown/blocked. Store no input values besides mode/country, no file names or model outputs.
- `consumeThrottle({key,limit,windowSeconds})` returns `{allowed,remaining}` with shared atomic count. Keys contain only keyed digests or opaque IDs, never raw IP.
- `getSettings()` returns `{aiEnabled,campaignCapMicrousd,dailyCapMicrousd,dailyCallCap,maxInFlight}`. Defaults false, 5000000, 1000000, 10, 1. Persist initial settings once; repeat migration/deploy must not reset them.
- `updateSettings({actor,patch})` only allowlisted stricter limits or aiEnabled boolean; cannot raise caps above initial constants, nor below already committed/reserved use if inconsistent. Actor is verified admin subject, not client data. Audit changes. No exposed budget reset.
- `reserveAiCall({requestId,sessionId,idempotencyKey,payloadHmac,operation,model,ceilingMicrousd,utcDay,pricingVersion})` returns `{admitted,reservationId,reason}`. Enforce both dollar limits, call-count, global in-flight=1, campaign persistence and uniqueness atomically. Check duplicate keys before new admission; different payload HMAC is IDEMPOTENCY_CONFLICT. Reasons are safe enums. No raw document digest.
- `settleAiCall({reservationId,status,tokens,estimatedMicrousd})`, status succeeded/failed_before_send/billing_unknown. Unknown retains reserved allowance; succeeded costs require validated usage and price; repeat settlement must be idempotent. Do not release uncertain billing or unknown usage. Disallow client-influenced changes to costs.
- `getOverview({from,to})`: `{settings,usage:{spentMicrousd,reservedMicrousd,remainingMicrousd,inputTokens,outputTokens,billingUnknown},totals:{started,completed,failed},byCountry,byMode}`. started means client-reported workflow starts; completed means successful server plan/assess, failures are server jobs. Label in UI.
- `listJobs({from,to,status,operation,country,limit=25,offset=0})`: `{items,total}`. limit at most100.
- `addFeedback({id,sessionId,text,mode,country})`, `listFeedback({limit=25,offset=0})`: `{items,total}`. Explicit text max1000, warnings to exclude sensitive information.
- `purge({actor,kind,confirm})`, kinds `events`, `jobs`, `feedback`, confirm literal `DELETE`. Audit; never delete budget reservations/campaign totals. UI must make irreversibility clear.
- `cleanup()` deletes expired operational records in bounded batches. Must not restore the campaign allowance or remove minimal idempotency/spend history.

The data worker may add helper modules/methods, but coordinate changes to these methods with the lead and consumers. Prove D1 atomic behavior with local Miniflare/D1 tests rather than an in-memory replacement.

## Admin router

`handleAdminRequest(request, {repository,admin,coverage})` returns Response or null for unknown route. `admin` must be an already verified `{subject,email}` or router denies. Requests use standard Request, no Express dependency. GET overview/jobs/coverage/feedback; POST settings/purge. JSON envelopes use shape above. Router validates fields, dates, pagination, and only accepts same-origin mutations after runtime security checks. Coverage supplied by domain catalogue, never from client.

## AI service

`createAiService({env,repository,fetchImpl=fetch,clock=()=>Date.now()})` returns:

- `extract({sessionId,idempotencyKey,file,consent,requestId,clientKey})` returns existing `{fields,confidence,uncertainties,pages,provider,model,confirmed:false}` plus optional safe usage metadata. Transport `consent:true` unchanged, idempotency/challenge in headers.
- `chat({sessionId,idempotencyKey,facts,history,purpose,requestId,clientKey})`: purpose `intake` or `explain`, history at most8 turns each at most1000 chars. Return `{message,proposals,missingFields,sourceIds,provider,model,confirmed:false}`. proposals allowlisted facts only, never invoiceConfirmed, final eligibility, cost or money calculations. Server recomputes results for explanations. Source IDs reference server catalogue. Message must not contradict deterministic amount/status; no model URLs. Reserve every call, even conversation turns.
- `capabilities()` returns `{enabled,chatAvailable,extractionAvailable,reason}` derived from env, price evidence and required controls. DB kill switch additionally enforced at call time. Do not imply a configured key alone enables AI.

The AI worker owns pricing verification and usage validation. If price/media bounds cannot be verified, leave the relevant capability false with a useful reason. No guessed model prices. Keep user manual workflows functional. Export safe errors with `{code,status,message}`.

## Public routes and transport

- Existing GET `/api/config`, POST `/api/plan` and `/api/assess` remain schema-compatible.
- `/api/config` adds `ai:{enabled,chatAvailable,extractionAvailable,reason}`, `turnstileSiteKey`, truthful storage text. `modelConfigured` means extraction usable, not just key exists.
- POST `/api/session`: empty JSON, returns `{ok:true}` and server-issued HttpOnly host-only SameSite cookie `tikdam_session`, Secure in production. Verify exact allowed Origin for browser mutations. Never accept client session IDs as authority.
- POST `/api/extract` body remains `{consent:true,file:{name,data}}`; POST `/api/chat` body `{purpose,facts,history}`. Both require cookie, `Idempotency-Key` UUID header and `X-Turnstile-Token` header; challenge server-validated hostname/action before AI service. JSON content type, bounded body.
- POST `/api/events`: `{id,event,mode,country}` with enum/schema allowlist, session/rate guard. POST `/api/feedback`: `{text,mode,country}` with same session/rate checks. Events are not tax facts.
- Common failure `{code,message,requestId}`, API no-store. Unknown `/api/*` returns JSON404, never SPA.
- Stateless plan/assess still work if session/telemetry is unavailable. Paid operations fail closed when controls/storage fail.

## Runtime and test hooks

Worker default exports `fetch(request,env,ctx)` and `scheduled(event,env,ctx)`. Export `createHandler({repositoryFactory,aiFactory,adminVerifier,challengeVerifier,fetchImpl})` for injected offline tests if helpful. No test-only authorization bypass in deployed runtime. `requireAdmin(request,env)` verifies issuer/audience/signature/expiry/allowlist and returns `{subject,email}` or throws safe403. `verifyChallenge({token,expectedAction,request,env})` verifies Siteverify success, action and exact configured hostname. Use `jose` for JWT verification; lead installs it. Runtime can use `miniflare`/Wrangler for actual D1/Worker tests; lead installs dependencies.

## UI exports

New public components export `AssistantPanel({facts,result,config,onPropose})` and `FeedbackPanel({mode,country})`; admin exports default `AdminApp`. Lead integrates them into existing App. `src/api.mjs` exports `api(path,body,options)`, `ensureSession()`, `sendEvent(event,mode,country)`. API accepts paths starting `/api/`, no absolute arbitrary URL. AI calls need explicit challenge token and generate a UUID idempotency key once per intentional request; do not automatically retry paid calls. Configure Turnstile using safe public config, never a secret. UI integration must preserve explicit invoice consent and confirmation. Admin never sends facts to analytics. Update README and privacy copy only through lead.
