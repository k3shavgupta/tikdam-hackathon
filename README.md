# Tikdam V1

Tikdam helps freelancers and small businesses prepare before buying, review purchase bills, and investigate deductions from client payments. The public app runs on Cloudflare Workers with a React/Vite frontend and D1 operational metadata.

- Homepage: https://tikdam.xyz
- Purchase checker: https://tikdam.xyz/app
- Preview: https://tikdam-v1-staging.k3shavgupta.workers.dev
- Owner dashboard: https://tikdam.xyz/admin, protected by Cloudflare Access.
- Production uses Baseten for optional text chat. Check /api/config for current availability. Invoice extraction is paused. Guests can use the manual checker.

## Run and verify

Use Node 22 or newer. Install both packages with `npm ci` and `npm --prefix landing ci`. The combined build exports the homepage at `/` and the interactive checker at `/app`.

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
- Purchase review: manual invoice facts, uncertainty, editable fields, invoice confirmation, arithmetic/identity/date/regime checks, and a JSON preparation pack.
- Client payment: reconciliation and certificate request. A payment gap is not automatically tax withheld, eligible credit, or a refund.
- Assistant: the configured model selects bounded clarifications and reviewable structured proposals. For explanation, the server recomputes the result and renders server-owned statements selected by the model. The model cannot set statutory confirmations, invoice confirmation, final amounts, legal eligibility or arbitrary source URLs.
- Private operations dashboard: activity, jobs, failures, token usage, reserved/estimated cost, recorded price versions, country coverage, explicit feedback, AI pause switch and lower-only limits. Authenticated administrative changes are audited.

The dashboard records processing activity. Successful processing does not mean a claim was filed, accepted, or paid. It does not count unique people. Example interactions and repeated checks can be included.

## Coverage

The selector contains 250 countries and territories, including Kosovo's user-assigned `XK` code. Eleven have researched preparation and routing guidance: India, UK, Australia, Canada, USA, Indonesia including Bali, Vietnam, Singapore, mainland China, UAE including Dubai, and Japan. Other locations provide a general invoice and evidence checklist. Their local tax rules, credits, deductions, refunds, and filing routes have not been reviewed; no numerical eligibility amount is shown. The country list is based on `i18n-iso-countries` 7.14.0 ([MIT notice](docs/COUNTRY-DATA-LICENSE.txt)); check [ISO's country-code register](https://www.iso.org/iso-3166-country-codes.html) for changes.

When AI controls are enabled, the bounded assistant accepts all selectable locations. For locations without reviewed local sources, it asks about purchase or payment evidence and explains the server's general preparation result. It returns no invented official source, tax amount, eligibility or filing route. The manual workflows remain available when the AI allowance runs out.

Numerical results are limited conditional candidate input-tax amounts for narrow domestic operating-purchase scenarios in India, UK and Singapore. The implementation transaction window is 1 January through 1 November 2026. That is a software coverage limit, not a statement that tax law starts or ends on those dates.

India supports ordinary office stationery only, 100% business use, ordinary registration, fully taxable activity, correct buyer and valid confirmed invoice, payment/no-prior-claim safeguards, and eight separate user/preparer statutory assertions. GSTR-2B visibility does not prove supplier tax payment. No government records are checked by this app. UK/Singapore retain exclusions for special registration, partial exemption, equipment/vehicles/entertainment, foreign-established claims and other specialist cases.

Client withholding, treaties, refunds, capital allowances, foreign-business cases and other numerical country routes remain review/research cases. The country selector is not a complete tax-law database. Read the scenario and official sources, and get professional review where needed.

See `docs/research/routes/2026-11-01-narrow-input-credit-routes.md`, `server/catalog.mjs`, and `CONTEXT.md`. No professional legal/tax sign-off, automatic filing or portal integration has occurred.

## Credit controls

Baseten serves text chat after consent, session validation, Turnstile, and budget admission. Production disables invoice extraction independently. The settings in D1 and Worker environment must both permit chat. Clerk sign-in is optional and does not save checks or grant owner access.

Initial app limits are $5 across the entire campaign, $1 per UTC day, ten admitted paid requests per day, and one paid request in flight globally. Deployment/month changes, record cleanup, and admin purge cannot reset campaign spending. Dashboard settings can pause AI and lower limits; raising the ceiling requires a reviewed change and new user instruction.

Each Baseten request reserves up to $0.0301 at the configured price, with at most 20,000 input and 1,200 output tokens. The adapter bounds request size before admission. The service makes no automatic paid retry. See `server/ai/baseten-pricing.json` for the price assumptions.

Validated returned usage determines estimated cost. Unknown generation usage and generation timeouts retain the allowance and pause AI. A preflight-only failure releases its reservation because generation was not requested. Provider billing is authoritative. Token preflight is not a provider invoice, and the app estimate is not an account-level billing guarantee. Pricing expires after thirty days unless reviewed.

## Bounded evaluation

The fixed private campaign has independent Meta$3/1,000 actual HTTP attempts, Modal$0.50, Baseten$0.50 and combined$4 ceilings, with ten percent operating headroom. Its real local D1 ledger persists in ignored `.local-state/evaluation-d1`; never delete it to replenish a budget. Unknown billing holds its maximum reservation and pauses the affected provider. Public spending limits above remain unchanged.

`npm run eval:offline` runs the exact1,000-case deterministic manifest. `npm run eval:live` and `npm run eval:modal` default to dry-run. Only the lead may pass `--live`, using synthetic fixtures and batches at most10; ordinary tests and builds make no provider calls. The Modal helper requires an isolated SDK environment; its auth regressions run with `python3 tests/evaluation/modal_auth_test.py`.

See `docs/evaluation/TEST-PLAN.md`, `PROVIDER-SETUP.md`, `RESULTS.md` and `COSTS.csv` for executed samples, returned-token estimates, held amounts and gaps. The admin evaluation panel is a timestamped aggregate snapshot imported separately from production traffic, not a provider invoice or real-time sync.

## Data handling

Manual entries go to Tikdam for calculation. Optional chat sends recent conversation and selected case details to Baseten. Named form fields for identifiers, names, invoice number and address are replaced with presence indicators. Free text is transmitted as typed. Provider retention is governed separately.

D1 stores opaque session/job identifiers, coarse chat topic and workflow/country, timestamps, safe status/error codes, model/token/cost metadata, settings/audit records and explicit feedback. It does not store invoice files, extracted text, tax identifiers, buyer/supplier names, bill amounts, raw prompts/responses, filenames or raw IP addresses. Feedback is optional text and may contain what the user submits; the interface asks users to omit sensitive information.

Operational records become eligible for bounded daily cleanup after thirty days and feedback after ninety days. Processing a backlog can take longer. A minimal campaign/idempotency spending ledger remains to prevent resetting the cap. Administrative audit records also remain. Clearing a session clears browser facts and revokes the anonymous session and expires its cookie; it does not erase retained operational/budget records. No advertising trackers or invoice archive are included.

Admin pages and APIs require server-verified Cloudflare Access JWT signature, issuer, audience, expiry and owner allowlist. Unconfigured authentication denies access. Production workers.dev and version previews are disabled. CSP, exact origins, Turnstile validation, shared throttles, bounded uploads and safe errors apply. No security certification is implied.

## Deployment

```sh
npx wrangler whoami
npm run deploy:staging
npm run test:browser -- https://tikdam-v1-staging.k3shavgupta.workers.dev
npm run deploy:production
node scripts/evaluation-smoke.mjs https://tikdam.xyz
npm run test:browser -- https://tikdam.xyz
```

Release from a clean main checkout. The release script discovers the existing D1 binding, preserves runtime variables and secrets and tags the Worker with the Git commit. Production also checks that the commit matches remote main. For schema changes, apply the reviewed migrations to each environment before deploying code that depends on them.

Cloudflare serves only built `dist` assets. D1 databases are separate for staging and production. The live `www` host redirects to the apex. See the deployment notes before configuring a separate account or domain.

## Origin of this work

The React/Node V1, tax modules, Meta adapter, Workers runtime, operational backend, tests and dashboard were built during the hackathon on 1 November 2026. Earlier project exploration is separate from this codebase. This repository publishes the hackathon code; a repository push alone is not an event submission or demo video. Organizer eligibility remains subject to the event rules.
