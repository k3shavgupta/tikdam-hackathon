# Evaluation coverage and limits

This audit describes the first 25-case selected live set. Later synthetic extraction samples are recorded in [RESULTS.md](RESULTS.md) and [COSTS.csv](COSTS.csv); the gaps below refer to the first set unless stated otherwise.

This is a coverage audit of the current fixture set and recorded Meta results. It distinguishes production contract tests, live model samples and unverified workflows.

## What has evidence

| Layer | Evidence | What it establishes |
|---|---|---|
| Offline application scenarios | 1,000 passed; zero network calls | The selected parser, schema, routing and guard expectations hold |
| Manifest integrity | Exact area distribution, unique IDs and input/expectation signatures | Cases were not inflated by renaming identical inputs |
| Image validation | Valid PNG/JPEG/WebP and truncated/corrupt/oversized-image regressions; actual bundled Workers execution | Structural format/dimension guards execute in the deployed runtime family |
| Meta pilot | Two incomplete outputs, followed by a passing minimal-reasoning pilot | The initial output-completeness issue was real and its retest passed |
| Selected Meta set | `coverage-batch-1`: 25 unique fixtures passed | The assertions for 19 chat and 6 extraction operations passed for this synthetic sample |
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

## Gaps and deferred cases

| Gap | Present status |
|---|---|
| Hindi, Japanese, Chinese, Vietnamese and other native-script OCR | Not live evaluated; country selection does not establish language coverage |
| Blurred, low-light, rotated, cropped or handwritten invoices | Not live evaluated in this selected set |
| Multi-rate line items, discounts, tax-inclusive conversions and complex rounding | No live extraction/calculation accuracy claim |
| Credit notes, negative amounts and refund documents | No supported live credit-note workflow claim; current scalar amount schema is nonnegative |
| Real scans and receipts from varied suppliers | Synthetic fixtures only; no private customer documents were uploaded by this workstream |
| Live JPEG and WebP OCR | Structural validation passes locally/Workers; live extraction set uses PNG/PDF only |
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
