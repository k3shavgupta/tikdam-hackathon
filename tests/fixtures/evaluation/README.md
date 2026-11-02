# Synthetic evaluation fixtures

These files contain fictional businesses, identifiers and invoices. They are not valid tax invoices and are not evidence of any government registration or tax entitlement.

`manifest.mjs` exports exactly 1,000 distinct offline scenarios, `runScenario(scenario)`, `liveCases`, `buildLiveCases()`, `purchaseFacts(code)` and `extracted(overrides)`.

| Area | Cases | What is tested offline |
|---|---:|---|
| Extraction | 300 | Scalar/enum/date syntax, unknown output properties, PDF page/transport bounds, image/file validation |
| Intake | 250 | Allowed proposals across countries, protected-field rejection, history role/size/count bounds |
| Explanation | 150 | Server-owned explanation selection across workflows/countries and unknown-ID rejection |
| Routing | 150 | Country/special-regime boundaries, India assertions, dates, identity, currency, and geographic aliases |
| Security | 100 | Origin/host/path guards, unknown facts, invented sources, duplicate cookies and HMAC limits |
| Budget | 50 | Token-price arithmetic, unusable provider usage and pricing-evidence age bounds |

These are application contract and boundary tests. Extraction parser tests do not measure OCR quality. Budget cases here do not replace the separate real-D1 concurrency/attempt-ledger tests. The manifest test also verifies unique IDs, unique input/expectation signatures and the exact distribution.

`buildLiveCases()` returns 25 selected cases: 19 conversations/explanations, five native PDF cases and one rendered invoice PNG. PDF ground truth is generated directly from the text drawn by pdf-lib. The image visibly contains the supplied fictional text. Expected amount comparisons may normalize decimal strings, so `100` and `100.00` are equivalent. Unknown or ambiguous evidence has explicit null expectations.

The five PDF cases cover an ordinary invoice, absent tax breakdown, quote, ambiguous date and separate invoices across pages. The two-invoice PDF uses distinct per-page identifiers and totals. PDF object streams are disabled so metadata preparation tests can inspect it without assuming a specific compressor.

The live selection is English text. It does not claim validated multilingual OCR, scan/rotation robustness, or every target-country invoice format. Those remain expansion cases if budget and current results justify them.

`fictional-invoice.png`, `fictional-small.jpg` and `fictional-small.webp` are valid synthetic image fixtures generated locally with Pillow and a system font. They require no generation API. They also serve positive image-validation tests; malformed signatures alone must not pass as a valid image.

Run from `hackathon/`:

```sh
node scripts/evaluation-offline.mjs
node --test tests/evaluation/scenarios.test.mjs
```

The offline runner writes a safe case-ID report under ignored `.local-state/evaluation/offline-results.json`. It makes no provider calls. Live requests remain the lead runner's responsibility and must pass the persistent campaign budget guard.
