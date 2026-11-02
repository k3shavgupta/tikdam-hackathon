# Tikdam V1

Tikdam helps freelancers and small businesses prepare before buying, review purchase bills, and investigate deductions from client payments. The public app runs on Cloudflare Workers with a React/Vite frontend and D1 operational metadata.

- Production: https://tikdam.xyz
- Preview: https://tikdam-v1-staging.k3shavgupta.workers.dev
- Owner dashboard: https://tikdam.xyz/admin, denied until Cloudflare Access is configured.
- Public AI is disabled pending Access/Turnstile configuration. The private, budgeted evaluation successfully exercised Meta with fictional chat/PDF/image inputs; see `docs/evaluation/RESULTS.md`. Owner login and public browser AI are not yet verified.

## Run and verify

Use Node 22 or newer. Install with `npm ci`.

```sh
npm run dev
npm test
npm run build
npm run db:local
npm run dev:worker
```

The legacy Node development app binds to http://127.0.0.1:4174. Its paid extraction route is disabled by default, even when a key exists. The primary Workers development runtime uses http://127.0.0.1:8787. Local D1 is isolated from remote data. `.dev.vars` can hold ignored local Worker bindings; copy names from `.env.example` and never commit values.

Tests include real local Workers/D1 execution, tax guards, concurrent budget admissions, billing uncertainty, idempotency, JWT denial, privacy canaries, strict API validation, React interactions, and session reset races. Ordinary tests mock Meta and Turnstile. Build/test success does not establish live OCR accuracy or legal entitlement.

See `docs/BUILD-STATUS.md` for the build record and `docs/DEPLOYMENT.md` for deployment limits.

## What V1 does

- Before buying: source-linked country guidance, actual legal purchaser details, business-use/evidence checklist, and a copyable seller request.
- Purchase review: manual facts or consented image/PDF extraction, uncertainty, editable fields, invoice confirmation, arithmetic/identity/date/regime checks, and a JSON preparation pack.
- Client payment: reconciliation and certificate request. A payment gap is not automatically tax withheld, eligible credit, or a refund.
- Assistant: Meta selects bounded clarifications and reviewable structured proposals. For explanation, the server recomputes the result and renders server-owned statements selected by the model. The model cannot set statutory confirmations, invoice confirmation, final amounts, legal eligibility or arbitrary source URLs.
- Private operations dashboard: activity, jobs, failures, token usage, reserved/estimated cost, recorded price versions, country coverage, explicit feedback, AI pause switch and lower-only limits. Authenticated administrative changes are audited.

The dashboard records processing activity. Successful processing does not mean a claim was filed, accepted, or paid. It does not count unique people. Example interactions and repeated checks can be included.

## Coverage

Eleven jurisdictions have preparation and routing guidance: India, UK, Australia, Canada, USA, Indonesia including Bali, Vietnam, Singapore, mainland China, UAE including Dubai, and Japan.

Numerical results are limited conditional candidate input-tax amounts for narrow domestic operating-purchase scenarios in India, UK and Singapore. The implementation transaction window is 1 January through 1 November 2026. That is a software coverage limit, not a statement that tax law starts or ends on those dates.

India supports ordinary office stationery only, 100% business use, ordinary registration, fully taxable activity, correct buyer and valid confirmed invoice, payment/no-prior-claim safeguards, and eight separate user/preparer statutory assertions. GSTR-2B visibility does not prove supplier tax payment. No government records are checked by this app. UK/Singapore retain exclusions for special registration, partial exemption, equipment/vehicles/entertainment, foreign-established claims and other specialist cases.

Client withholding, treaties, refunds, capital allowances, foreign-business cases and other numerical country routes remain review/research cases. The country selector is not a complete tax-law database. Read the scenario and official sources, and get professional review where needed.

See `docs/research/routes/2026-11-01-narrow-input-credit-routes.md`, `server/catalog.mjs`, and `CONTEXT.md`. No professional legal/tax sign-off, automatic filing or portal integration has occurred.

## Credit controls

Meta Model API is the production AI provider. A separate private evaluation adapter tried Baseten (inference403) and Modal (malformed SDK token); both are paused. Neither is a public fallback. No GPU endpoints were provisioned.

Live AI requires all of: environment `AI_ENABLED=true`, the database AI switch enabled, Meta key, HMAC secret, Turnstile keys, valid session/challenge and fresh supported pricing evidence. Missing controls fail closed; manual checks remain available.

Initial app limits are $5 across the entire campaign, $1 per UTC day, ten admitted paid requests per day, and one paid request in flight globally. Deployment/month changes, record cleanup, and admin purge cannot reset campaign spending. Dashboard settings can pause AI and lower limits; raising the ceiling requires a reviewed change and new user instruction.

For the currently configured standard `muse-spark-1.3`, the app reserves $0.0301 before preflight, using the full uncached price for 20,000 input tokens and 1,200 output tokens including reasoning. Meta counts the exact rendered input before a single generation request. Oversized inputs are rejected. There are no hosted tools, agent loops or automatic paid retries. Prices and limits are recorded in `server/ai/pricing.json` with official sources.

Validated returned usage determines estimated cost. Unknown generation usage and generation timeouts retain the allowance and pause AI. A preflight-only failure releases its reservation because generation was not requested. Provider billing is authoritative. Token preflight is not a provider invoice, and the app estimate is not an account-level billing guarantee. Pricing expires after thirty days unless reviewed.

## Bounded evaluation

The fixed private campaign has independent Meta$3/1,000 actual HTTP attempts, Modal$0.50, Baseten$0.50 and combined$4 ceilings, with ten percent operating headroom. Its real local D1 ledger persists in ignored `.local-state/evaluation-d1`; never delete it to replenish a budget. Unknown billing holds its maximum reservation and pauses the affected provider. Public spending limits above remain unchanged.

`npm run eval:offline` runs the exact1,000-case deterministic manifest. `npm run eval:live` and `npm run eval:modal` default to dry-run. Only the lead may pass `--live`, using synthetic fixtures and batches at most10; ordinary tests and builds make no provider calls. The Modal helper requires an isolated SDK environment; its auth regressions run with `python3 tests/evaluation/modal_auth_test.py`.

See `docs/evaluation/TEST-PLAN.md`, `PROVIDER-SETUP.md`, `RESULTS.md` and `COSTS.csv` for executed samples, returned-token estimates, held amounts and gaps. The admin evaluation panel is a timestamped aggregate snapshot imported separately from production traffic, not a provider invoice or real-time sync.

## Data handling

Bills, profile details, extracted facts and conversations remain transient in browser/server memory. Selecting a bill does not upload it. Explicit consent and a deliberate action are required to transmit a document or assistant conversation/form facts to Meta. User confirmation remains necessary after extraction. `store:false` requests no stored response but does not override Meta's separate logs, retention or terms.

D1 stores opaque session/job identifiers, coarse workflow/country, timestamps, safe status/error codes, model/token/cost metadata, settings/audit records and explicit feedback. It does not store invoice files, extracted text, tax identifiers, buyer/supplier names, bill amounts, raw prompts/responses, filenames or raw IP addresses. Feedback is optional text and may contain what the user submits; the interface asks users to omit sensitive information.

Operational records become eligible for bounded daily cleanup after thirty days and feedback after ninety days. Processing a backlog can take longer. A minimal campaign/idempotency spending ledger remains to prevent resetting the cap. Administrative audit records also remain. Clearing a session clears browser facts and expires its cookie; it does not erase retained operational/budget records. No advertising trackers or invoice archive are included.

Admin pages and APIs require server-verified Cloudflare Access JWT signature, issuer, audience, expiry and owner allowlist. Unconfigured authentication denies access. Production workers.dev and version previews are disabled. CSP, exact origins, Turnstile validation, shared throttles, bounded uploads and safe errors apply. No security certification is implied.

## Deployment

```sh
npx wrangler whoami
npm run db:staging
npm run deploy:staging
npm run db:production
npm run deploy:production
```

The checked-in `wrangler.jsonc` uses placeholder D1 IDs and omits the account ID. Configure your own Cloudflare account, D1 databases, routes and secrets before remote deployment. An optional separate scoped Cloudflare token for Access/Turnstile management may lack deployment permissions; do not replace the deployment identity with that token unintentionally.

Cloudflare serves only built `dist` assets. D1 databases are separate for staging and production. The live `www` host redirects to the apex. See the deployment notes before configuring a separate account or domain.

## Origin of this work

The React/Node V1, tax modules, Meta adapter, Workers runtime, operational backend, tests and dashboard were built during the hackathon on 1 November 2026. Earlier project exploration is separate from this codebase. This repository publishes the hackathon code; a repository push alone is not an event submission or demo video. Organizer eligibility remains subject to the event rules.
