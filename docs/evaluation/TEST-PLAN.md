# Tikdam V1 evaluation plan

Campaign ID: `tikdam-v1-eval-2026-11-01`. This document describes the executed offline selection and bounded live plan. It does not turn a planned test into a passing result. Current observations are recorded separately in `COVERAGE.md`, `RESULTS.md`, the safe live-result log and `COSTS.csv`.

## Budget and execution controls

| Provider | Campaign ceiling | Default operating stop | Intended live use |
|---|---:|---:|---|
| Meta Model API | $3.00 | $2.70 | Production-schema intake, explanation and synthetic invoice extraction |
| Modal | $0.50 | $0.45 | Short CPU-only document preparation, if invocation and cost are bounded |
| Baseten | $0.50 | $0.45 | A small existing-model compatibility comparison, if available |
| Combined | $4.00 | $3.60 | No budget transfer or top-up |

Meta has an additional ceiling of 1,000 actual outbound HTTP attempts, including preflight, generation, failed requests and deliberate retries. A preflight plus a generation uses two attempts. This is a maximum, not a request quota to exhaust. The offline manifest has 1,000 cases; that does not mean 1,000 live model calls.

A single lead-controlled runner uses the persistent evaluation ledger. Workers use mocks and make no live provider calls. The evaluation campaign is separate from the production ledger. Public AI and pending public authentication controls must not be bypassed for a service-level test.

Before any live request, atomically reserve conservative cost and needed attempt slots. Count the actual send before fetching. Unknown billing holds its reservation and pauses the affected provider. A known billed response remains counted even if its output fails a quality assertion. Restart, deploy, midnight and fixture changes must not reset spending or attempts. Provider billing remains authoritative; a local estimate is not an invoice guarantee.

## Exact offline test manifest

`tests/fixtures/evaluation/manifest.mjs` contains 1,000 distinct records. The manifest test verifies count, unique IDs, unique area/kind/input/expectation signatures and the following distribution.

| Area | Cases | Main independent checks |
|---|---:|---|
| Extraction and documents | 300 | Visible-value type/length limits, country/currency/document enums, date syntax, strict unknown-field rejection, PDF pages, transport and image/file bounds |
| Intake and proposals | 250 | Accepted proposal fields, protected-field rejection across eleven countries, history role/count/size bounds |
| Explanations | 150 | Server-owned statement selection across modes/countries and rejection of unknown explanation IDs |
| Jurisdiction/routing | 150 | Narrow supported scenarios, buyer confirmation, prior claim/payment, categories, foreign businesses, currency, India assertions, dates and country aliases |
| Security/privacy guards | 100 | Host/origin/path validation, strict fact schema, invented sources, duplicate session cookies and HMAC secret bounds |
| Cost and accounting guards | 50 | Fixed token-cost expectations, invalid provider usage and stale/future price evidence |
| Total | 1,000 | No network calls from this runner |

The cost cases above are distinct from the separate real-D1 tests for atomic reservations, concurrent admission, restart persistence and attempt ceilings. Parser/validator success is not model accuracy, a legal opinion or a public browser test.

Run from `hackathon/`:

```sh
node scripts/evaluation-offline.mjs
node --test tests/evaluation/scenarios.test.mjs
npm test
npm run build
```

The offline runner records safe case IDs and outcomes under ignored `.local-state/evaluation/offline-results.json`. It currently reports 1,000 passed and zero failed. Tests exercise actual production parsing, routing and guards. Some cases supply synthetic model output to validate the parser; they do not claim that a live model extracted the content.

## Selected live Meta set

`buildLiveCases()` selects 25 unique fixtures rather than sending all offline cases to the model.

| Selection | Unique cases | Purpose |
|---|---:|---|
| Country intake | 11 | One English request for each target jurisdiction, with constrained reviewable proposals |
| Result explanation | 6 | IN, GB, SG, US, CA and JP route/result boundaries |
| Client-payment explanation | 1 | Evidence and withholding distinction, including known client source IDs |
| Prompt injection | 1 | Request to forge confirmations/India assertions must not change protected facts |
| Native PDFs | 5 | Ordinary invoice, absent tax breakdown, quote, ambiguous date and two separate invoices |
| Rendered PNG invoice | 1 | Known text/amount extraction from a real image |
| Total | 25 | 19 chat operations and 6 extraction operations |

All fixtures are fictional. PDFs are generated with pdf-lib from defined text, without object streams. The multi-invoice case uses different per-page identifiers and totals. The PNG contains a clear rendered fictional invoice. Ground truth is supplied by fixture construction and manually defined assertions, not by another model. Numeric-equivalent decimal strings such as `100` and `100.00` may compare equal. Ambiguous/absent evidence has explicit null expectations.

The current live set is English, even when the chosen jurisdiction is India, China or Japan. It does not measure native-script OCR or regional invoice-format accuracy.

## Live sequence and repair rule

1. Re-run the baseline and verify the fixed campaign, actual accounts, price versions and credentials without printing secrets. Prove the spending guard offline before a provider send.
2. Run a short synthetic Meta pilot with the actual production schema. Inspect completeness, usage, schema and known expectations. Stop on failure; make a local regression and a reviewed fix before a deliberate new attempt. Do not automatically retry.
3. Once the pilot passes, run the selected high-risk live set in controlled operations with one in flight. Review cost and quality after each batch, with no more than ten generation operations between reviews. A shared run tag can contain several reviewed sub-batches; the tag alone is not proof of review timing.
4. Exercise Modal/Baseten only after account/model/job availability and cost bounds are known. A metadata check or runtime initialization is not a successful document-preparation job or a model-quality comparison.
5. A severe privacy, eligibility override, secret disclosure, duplicate charge, budget bypass or unauthorized admin finding stops affected live work immediately. Keep unknown reservations held.
6. Stop expansion when the critical selected behaviors have live evidence and two consecutive reviewed clean batches show no new material defect, or earlier at a cost/control boundary. Do not spend solely to reach 1,000 attempts. Report whether this stop criterion actually occurred rather than inferring it from an aggregate run tag.
7. Re-run all offline regressions, Worker/D1 checks and the build after repair. Deploy reviewed changes to preview, verify the actual deployed behavior, then promote fixes within the existing Tikdam deployment scope. Keep model-service testing distinct from public browser authentication, real Turnstile and owner login.

## Observed pilot history

The first two Meta pilot attempts produced `MODEL_INCOMPLETE`, under run tags `initial` and `low-reasoning-fix`. They are quality failures, not passing extractions or unbilled successes. The `minimal-reasoning-fix` pilot then passed. The recorded `coverage-batch-1` contains all 25 selected unique fixtures with passing assertions. This does not erase the failed pilots or prove exhaustive accuracy. Later clean-batch/verification evidence belongs in the final results report.

## Required final evidence

Record actual provider HTTP attempts separately from generation operations, unique fixtures and offline cases. Include failure/retest history, assertion scope, returned tokens, estimated usage, held unknown amounts, observed provider billing evidence, stop reason, cleanup state and deployed version.

Do not report tax-authority approval, filing, a paid refund, multilingual accuracy, real-device testing, successful owner login or public end-to-end AI unless that specific result has independent evidence.

## User-requested extended run

On 2 November, after the original25 cases passed, the user explicitly requested more testing. The same persistent campaign admitted13 additional synthetic extraction cases in reviewed batches10+3 under `extended-v1`. No cap, paused provider or reservation was reset. All13 passed. Use `npm run eval:live -- --extended` for a dry-run; live requires deliberate `--live`, an at-most10 batch and review of current holds. Supplemental cases do not inflate or replace the exact1,000-case manifest. See COVERAGE.md for measured assertions and remaining limits.
