# Evaluation coverage and limits

This is a coverage audit of the current fixture set and recorded Meta results. It distinguishes production contract tests, live model samples and unverified workflows.

## What has evidence

| Layer | Evidence | What it establishes |
|---|---|---|
| Offline application scenarios | 1,000 passed; zero network calls | The selected parser, schema, routing and guard expectations hold |
| Manifest integrity | Exact area distribution, unique IDs and input/expectation signatures | Cases were not inflated by renaming identical inputs |
| Image validation | Valid PNG/JPEG/WebP and truncated/corrupt/oversized-image regressions; actual bundled Workers execution | Structural format/dimension guards execute in the deployed runtime family |
| Meta pilot | Two incomplete outputs, followed by a passing minimal-reasoning pilot | The initial output-completeness issue was real and its retest passed |
| Selected Meta set | `coverage-batch-1`: 25 unique fixtures passed | The assertions for 19 chat and 6 extraction operations passed for this synthetic sample |
| Extended Meta set | `extended-v1`: 13 additional unique fixtures passed | JPEG/WebP, rotation, negative credit-note rejection, mixed visible tax, foreign currency, document injection, Hindi/Japanese/Chinese, light blur, zero tax and absent facts |
| Provider accounting | Persistent evaluation ledger and separate cost report | Usage estimates/reservations and attempts can be reconciled; provider invoice remains separate |

The image validator checks bounded container structure, checksums where supported, dimensions, payload boundaries and required markers. It does not fully decode every compressed pixel and is not a malware or visual-quality certification.

## Offline cases are not live OCR results

The 300 extraction-area cases primarily exercise schema and transport/document guards. They include valid and invalid scalar values, strict enum/unknown-field behavior, PDF page limits and image structure. Synthetic parser outputs are passed directly into production validators. A Unicode string accepted by a text schema establishes type/length acceptance only. It is not evidence that Muse read that language from an image.

Date syntax acceptance in extraction is separate from deterministic invoice-calendar and transaction-period validation. A syntactically shaped impossible date can be accepted into editable extracted facts and then blocked by the downstream calendar guard. Those tests do not endorse a claim period.

The 50 budget-area scenarios exercise price/usage inputs. Real-D1 reservation, cross-provider aggregate, concurrency, idempotency and attempt-limit tests must also pass. They cannot be replaced with a mocked balance or by summing successful outputs.

## Live sample details

The 25 unique Meta fixtures comprise:

- Eleven English intake questions across IN, GB, AU, CA, US, ID, VN, SG, CN, AE and JP.
- Six server-grounded explanations for IN, GB, SG, US, CA and JP.
- One client-payment explanation and one protected-field prompt-injection case.
- Five PDFs: ordinary invoice, missing tax breakdown, quote, ambiguous date and two separate invoices.
- One clear English PNG invoice with fixed invoice number/date/country/currency/net/tax/gross/document-type assertions.

The ordinary PDF/PNG checks compare specific known values. Missing tax fields, ambiguous date and multiple-invoice cases check explicit null expectations. Proposal/source/confirmation invariants apply to conversation output. Assertions are narrower than every possible response property; a pass must not be presented as a measured universal OCR accuracy percentage.

The first two incomplete pilots are retained in the history. The subsequent successful IN pilot repeats a fixture, so it increases executed attempts but not the 25 unique selected-fixture count. A later repeat run also must not increase unique coverage.

## Additional testing requested on 2 November

The user requested more testing after the original clean batches. `extended.mjs` adds thirteen unique invoice cases without changing the exact1,000-case manifest. All thirteen passed the specified live assertions. Its fourteen supplemental offline tests validate uniqueness and actual upload/file bounds. Language images were rendered with a local Unicode font and visually inspected; money values and IDs remain explicit known ground truth. This is a small synthetic sample, not a country-format or multilingual benchmark.

## Gaps and deferred cases

| Gap | Present status |
|---|---|
| Native-script OCR | One synthetic Hindi, Japanese and Chinese image each passed selected amount/ID assertions; Vietnamese and broader language/format coverage remain untested |
| Degraded and rotated input | One light-blur image and one rotated native PDF passed; low-light, crop, severe blur and handwriting remain untested |
| Complex amounts | One mixed-rate visible aggregate and one zero-tax invoice passed; discounts, tax-inclusive conversions, detailed line reconciliation and complex rounding remain untested |
| Credit notes | One negative credit note returned unknown document type and null amounts; supported credit-note/refund accounting is not implemented |
| Real scans and receipts from varied suppliers | Synthetic fixtures only; no private customer documents were uploaded by this workstream |
| JPEG/WebP | One fictional image of each format passed selected live amount/ID assertions; broader scan quality remains untested |
| All eleven country-specific legal calculations | Not implemented or validated; numerical coverage remains narrow IN/GB/SG conditional input-tax cases |
| Withholding/treaty refund amounts | Client evidence guidance does not establish final annual entitlement or refund |
| Real phones/tablets, assistive technology and full manual browser flow | No real-device verification from this workstream |
| Public browser end-to-end AI | Private model-service execution is separate from sessions, Turnstile, Access and public deployment controls |
| Owner sign-in | Built auth guards or unauthenticated denial are not evidence of a completed real owner login |
| Modal processing quality | Metadata/initialization alone is not a completed PDF/image preparation job |
| Baseten comparison quality | Endpoint discovery or a rejected model request is not a successful cross-provider comparison |

Do not fill these gaps with guessed claims to make coverage appear complete. Expand only if there is a useful test objective, current source support where relevant, and remaining reserved budget. The authorized maximum is not a requirement to exhaust provider credits.

## Release and stopping boundary

Application defects found by this work must be repaired with reproducible regressions. A generation being charged, a job succeeding or the model producing valid JSON does not establish tax correctness. Claimed amounts remain deterministic and conditional, using user assertions rather than verified government records. No automatic tax filing or authority acceptance is tested.

Stop live expansion after the required reviewed clean batches and critical selected coverage, or earlier at a budget, billing-uncertainty, security or access boundary. Record the actual stopping evidence in `RESULTS.md`; a single broad run tag does not prove two reviews. Remaining limitations should remain visible in product copy, deployment notes and any hackathon demo.
