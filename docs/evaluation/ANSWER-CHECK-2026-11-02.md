# Answer check — 2 November 2026

This is a private service-level check of Meta `muse-spark-1.3` with fictional facts. Tikdam renders the final text from server-owned, deterministic results and explanations selected by the model. It is not an independent review of each country's tax law, a browser end-to-end test, or evidence that public AI is enabled.

| Case | Observed answer | Check |
| --- | --- | --- |
| India laptop purchase | No numerical benefit; points to GST invoice and GSTR-2B checks; says equipment is outside the ordinary-supplies estimate. | Passed |
| UK confirmed stationery invoice | Conditional potential input-tax credit of 20.00 GBP; says it is not a cash refund. | Passed |
| UK client paid 100 against a 120 invoice | Initially gave the correct no-amount and certificate caveats, but also included an unrelated VAT purchase sentence and VAT sources. After the fix, it gives the payment gap and withholding caveats, with no VAT route. | Passed after fix |

The client-payment defect came from offering the purchase `route` explanation and purchase-tax sources in client mode. Client mode now offers only its client-payment source and cannot select the purchase route. Every explanation includes the server-calculated result and limits, even when the model selects other explanation IDs. The UK client source was changed from a construction-only deduction page to [HMRC guidance on tax paid abroad](https://www.gov.uk/tax-foreign-income/taxed-twice), labelled as applicable only when the facts fit. This does not establish the user's tax residence or entitlement.

Verification after the fix: 1,000/1,000 offline evaluation cases passed with no provider calls; 1,164/1,164 project tests passed. The focused client case was sent once more and passed the no-amount, certificate, and no-VAT-route checks. Four live Meta generations across the three cases cost an estimated **$0.009092** from recorded token usage; the campaign's total estimated Meta spend became **$0.180381**. These are estimates from the [published Meta rates](https://dev.meta.ai/docs/pricing-rate-limits), not invoice proof. Private results and the persistent cost ledger remain under `.local-state/evaluation/` and `.local-state/evaluation-d1/`.

Public AI remains disabled. These checks verify bounded answer behavior on three fictional examples, not factual correctness across all selectable countries.
