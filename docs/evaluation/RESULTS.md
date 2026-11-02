# Evaluation results — 2 November 2026

The fixed campaign `tikdam-v1-eval-2026-11-01` completed its selected Meta tests and the user's requested extension. Meta worked through the private production-schema harness. Baseten inference and Modal compute remain blocked by external access/credential failures. Public AI remains disabled. No private customer bill was uploaded.

## Executed verification

| Layer | Actual result |
|---|---|
| Exact deterministic manifest | 1,000 passed, 0 failed; extraction300/intake250/explanation150/routing150/security100/budget50 |
| Integrated local Node suite | 1,160 passed, 0 failed, 0 skipped, including the 1,000 manifest cases and 14 supplemental extended-fixture checks |
| Isolated release suite | 1,145 passed, 0 failed, before deploying the reviewed application snapshot; supplemental extended fixtures remain local tooling |
| Modal auth regression | 2 Python tests passed using a fake SDK and no network |
| Production build | Passed in the isolated release |
| Production dependency audit | 0 reported vulnerabilities on the checked dependency set |
| Actual credential-value scan | 98 tracked/build files checked, 0 matches; ignored credential files excluded |
| Preview HTTP smoke | 23 checks passed, including synthetic feedback transport and D1 persistence |
| Production HTTP smoke | Recorded separately in private operations notes; not repeated for this source export |
| Native Chrome | Existing preview displayed; further interaction was interrupted by changing user windows. Complete manual browser/mobile verification remains unclaimed |

The complete suite count includes manifest cases; do not add1,000 to1,160. Mock/parser and HTTP checks are separate from model accuracy and real device testing.

## Meta live results

There were **82 actual HTTP sends: 41 token-count preflights and 41 generations**. Generation history contains39 passing operations and2 initial incomplete outputs. The final selection has **38 unique passing fixtures**: the original25 and13 added after the user's request for more testing. A passing repeat of the India pilot adds an operation, not a unique fixture.

The original set covers11 country intakes,6 server-grounded explanations,1 client-payment explanation,1 protected-field injection,5 PDFs and1 PNG. The extension covers JPEG, WebP, a rotated PDF, a negative credit note, mixed visible tax aggregates, foreign currency without a country, document injection, three native-script images, light blur, zero tax and no visible invoice facts. All38 selected fixtures passed their manually defined assertions. This is not a universal OCR accuracy rate or tax-law validation for eleven countries.

For the credit note, document type remained unknown and negative amounts remained null. A USD currency did not invent a supply country. Missing tax, ambiguous dates and multiple invoices retained required unknown values. Document instructions could not auto-confirm facts, change protected fields or override the known visible amounts. Extraction never confirms an invoice; deterministic rules continue to control supported calculations.

The original coverage run was reviewed in batches10+10+5. The extension used10+3. Both ended with clean reviewed batches and no further unmet selected Meta objective. No calls were made to exhaust a quota.

## Costs and holds

| Provider | Ceiling | Returned-usage estimate | Unknown billing held | Uncommitted allowance |
|---|---:|---:|---:|---:|
| Meta | $3.00 | $0.171289 | $0 | $2.828711 |
| Modal | $0.50 | No verified compute usage | $0.400000 | $0.100000 |
| Baseten | $0.50 | No returned generation usage | $0.030100 | $0.469900 |
| Combined | $4.00 | $0.171289 | $0.430100 | $3.398611 |

Meta returned63,409 input and21,650 output tokens across all41 generations, including incomplete outputs. Cost rounds each operation upward using full uncached rates, so it can exceed a calculation rounded only once over summed tokens. Cached-token details were not retained and discounts are not assumed. These are estimates from response usage, not provider invoices or verified current balances. Promotional credit eligibility, delayed billing and Cloudflare infrastructure usage are separate.

Baseten made1 catalogue request and1 inference request. The catalogue returned a model list; inference returned403 with no generated answer/usage. Its allowance stays held and the provider stays paused. No successful comparison or model-quality winner is claimed.

Modal recorded2 **logical SDK actions**, not an exact HTTP count: initialization and an attempted ephemeral app creation. App creation was rejected for a malformed token ID. No successful app ID, function result or compute execution was observed. The initial initialization record was erroneously called authenticated; an appended correction and the setup report preserve that distinction. The entire$0.40 compute reservation stays held. No observed created app requires stopping, but provider-wide residual state could not be independently checked with invalid authentication. No schedule, GPU, endpoint, warm deployment, durable volume or recurring test runner was configured.

`COSTS.csv` exports safe operation IDs, ledger/quality outcomes, attempt kinds/units, usage, holds, estimates, price versions and evidence categories. Restarted runners re-opened the same real D1 ledger and preserved totals and paused states. There is no active in-flight reservation. Unknown costs were not released to unlock another test.

## Defects and repairs

| Finding | Severity / evidence | Repair and verification |
|---|---|---|
| Output cap consumed before complete JSON | Medium; first default and explicit-low reasoning pilots returned `MODEL_INCOMPLETE` with1,200 output tokens each | Set explicit minimal reasoning in production and evaluation, including identical preflight settings. Mocked regression passed; affected India pilot and subsequent38 unique live cases passed |
| Images accepted from magic bytes alone | Medium; truncated/corrupt inputs could reach a paid request | Bounded PNG structure/CRC, JPEG segments/scans, WebP chunks and dimension/pixel checks. Positive/negative regressions and actual bundled Worker tests passed; no complete pixel decoder or malware claim |
| SDK initialization misreported authentication | Medium harness reporting defect; Modal AppCreate later rejected malformed credentials | Metadata path now requires `client.hello()`. Two offline tests prove failed auth cannot emit authenticated success. Historical ledger retained with an audit correction; no unauthorized retry |

Budget tests cover real-D1 atomic admission, cross-provider accounting, idempotency, persistence, unknown-billing holds and999/1,000/1,001 attempt boundaries. Denied transport tests prove no provider fetch occurs. There is no public evaluation endpoint or evaluation cap increase in production settings.

## Deployment and remaining requirements

The release is the reviewed `02fc3f2` application snapshot plus the authenticated Worker evaluation-report wiring. Concurrent UI redesign edits were isolated from this release. Evaluation scripts/fixtures remain private operator tooling. The additive reporting migration and sanitized aggregate snapshot are separate from public production spending; the owner dashboard labels them as a timestamped snapshot, not live monitoring or a provider bill. No request/fixture content is imported into that reporting table.

Exact deployed versions and completed smoke checks are recorded in `../DEPLOYMENT.md`. Public production AI remains paused in both environment and database. Its existing$5 campaign/$1 daily/10 daily admitted calls/one-in-flight limits remain intact. `/admin` and `/api/admin/*` deny unconfigured/unauthenticated access. Owner login, real Turnstile and public browser end-to-end AI still require the missing scoped Cloudflare control setup and actual successful verification. An operator can keep/pause AI using `AI_ENABLED=false`; once owner authentication exists the D1 budget switch can also pause it without resetting spend.

The user is checking Modal credentials and Baseten access. No new provider request will be made merely because the user said they would check. A later corrected configuration requires deliberate review of the same reservations and paused state, not a new budget or erased history.

Remaining coverage includes severe blur, handwriting, low-light/cropped scans, Vietnamese/other scripts, supplier-varied invoices, discounts/complex rounding, real phones/assistive technology and full public browser AI. Legal coverage is unchanged: narrow conditional IN/GB/SG amounts, other jurisdictions/client routes guidance or review. No filing, government verification, refund receipt or professional sign-off is established.
