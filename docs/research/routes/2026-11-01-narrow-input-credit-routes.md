# Narrow purchase input-tax routes

Source check and implementation review: 1 November 2026. These are candidate allocations for review, not tax-authority verification or a professional eligibility opinion. `tested` describes code scenario tests. It does not mean a government or tax professional has approved a claim.

## Released implementation scope

| Country | Numerical scope | Readiness | Outside this scope |
|---|---|---|---|
| India | Stated invoice GST on ordinary domestic office stationery, 100% business use, standard registration, fully taxable activity, and every statutory check explicitly asserted | Implemented and scenario-tested | Mixed-use allocation, capital assets, reverse charge, imports, NRTP, composition, special schemes and tax-component utilisation |
| UK | Stated invoice VAT multiplied by confirmed business-use share on ordinary domestic operating supplies/services, ordinary VAT registration and wholly taxable activity | Existing calculation reviewed against current official sources; scenario-tested | Flat Rate Scheme, partial exemption, capital assets, vehicles, entertainment, margin schemes, imports and foreign-business refunds |
| Singapore | Stated SGD invoice GST multiplied by confirmed business-use share on ordinary domestic operating supplies/services, ordinary registration and wholly taxable activity | Existing calculation reviewed against current official sources; scenario-tested | OVR pay-only charges, imports, partial exemption, capital assets, employee/special expenses, foreign-currency conversion and foreign-business routes |

All three calculations require confirmed invoice fields, matching legal recipient, supplier details, ordinary supplier regime, a final invoice, payment, no previous claim, matching local currency, arithmetic consistency and an actual valid calendar date between 1 January and 1 November 2026. This time window is a deliberately narrow software limit. It does not describe when the law started or stopped.

Australia, Canada, USA, Indonesia/Bali, Vietnam, mainland China, UAE/Dubai and Japan remain preparation/evidence guidance only. No numeric purchase route has been released for them. Client-payment/withholding workflows remain evidence and reconciliation guidance in every country; no annual tax refund, treaty calculation or withholding entitlement is computed.

## India legal basis and evidence

[CBIC's current section 16 text](https://taxinformation.cbic.gov.in/content-page/explore-act/1000285/1000001) was available through indexed official content; a direct fetch returned an intermittent 502. Relevant provisions are 16(1), 16(2)(a)-(d), its receipt/payment provisos, and 16(4). The implemented checks require receipt, a valid document/charge, communicated unrestricted invoice credit, supplier payment of tax, the return condition and an open claim period. Each is a user/preparer assertion, not a fact established by Tikdam.

Under section 16(4), the ordinary outer date is 30 November after the invoice financial year, or relevant annual-return filing if earlier. For example, a January 2026 invoice belongs to FY 2025-26 and ordinarily points to 30 November 2026. The interface requires actual intended claim/return dates to be checked by a preparer; it does not automatically turn that condition true. Legacy relief, cancelled/revoked registrations and other exceptions are excluded.

[CBIC section 17](https://taxinformation.cbic.gov.in/content-page/explore-act/1000286/1000001) governs attribution and blocked credits. The implementation excludes mixed use and requests an explicit exclusions check, including special uses such as gifts, losses and CSR. It does not implement Rule 42/43 or exceptions to blocked categories.

[GST Portal GSTR-2B guidance](https://tutorial.gst.gov.in/userguide/returns/FAQ_gstr2b.htm) explains reconciliation and warns that its availability flags are not exhaustive legal eligibility checks. GSTR-2B visibility is never treated as proof that the supplier paid the government. [Notification 40/2021, rule 36(4)](https://cbic-gst.gov.in/pdf/central-tax/notfctn-40-central-tax-english-2021.pdf) supplies the reporting/communication condition for covered invoices.

The calculation uses the total correctly charged invoice GST supplied and confirmed by the user. It does not infer a GST rate from a product name, allocate CGST/SGST/IGST ledgers, calculate an electronic cash-ledger refund, file GSTR-3B, or authenticate to GST Portal. GSTIN syntax checks do not prove registration, ownership, checksum validity or return status.

## India UI and input contract

The additive `indiaChecks` object is strict. Every field defaults to `unknown`; none is populated from OCR or a model proposal. The UI must allow users to leave a check unknown, explain that no amount will be shown in that case, and retain manual guidance. Selecting India must not preselect affirmative answers.

```json
{
  "purchaseKind": "unknown",
  "received": "unknown",
  "invoiceValid": "unknown",
  "gstr2bAvailable": "unknown",
  "supplierTaxPaid": "unknown",
  "returnFiled": "unknown",
  "notBlocked": "unknown",
  "domesticForwardCharge": "unknown",
  "claimPeriodOpen": "unknown"
}
```

`purchaseKind` accepts `office_stationery`, `other` or `unknown`. Every other field accepts `yes`, `no` or `unknown`. Human-readable labels and pinpoint provisions are exported as `indiaCheckDefinitions` from the catalogue. A missing, negative or unknown check blocks the numerical route. Ordinary registration and buyer/supplier GSTINs remain separate existing inputs. Confirming the model's transcription does not confirm these statutory conditions.

## UK review

[VAT Act 1994 section 24](https://www.legislation.gov.uk/ukpga/1994/23/section/24) defines business input tax, and [section 26](https://www.legislation.gov.uk/ukpga/1994/23/section/26) governs attribution. [HMRC's business expense guidance](https://www.gov.uk/charge-reclaim-record-vat/reclaim-vat-business-expenses) supports a recorded business-use proportion and valid-invoice evidence. It also identifies exclusions and special regimes. The app's paid-invoice guard is conservative; it does not assert that UK law always postpones input credit until payment. The proper return period and claim time limit still need review. Northern Ireland transactions and cross-border goods require separate analysis.

## Singapore review

[GST Act sections 19 and 20](https://sso.agc.gov.sg/Act/GSTA1993?ProvIds=pr19-) provide the credit mechanism. [IRAS's eight input-tax conditions](https://www.iras.gov.sg/taxes/goods-services-tax-%28gst%29/claiming-gst-%28input-tax%29/conditions-for-claiming-input-tax) cover business purpose, supporting documents, taxable attribution, disallowed expenses and reasonable Missing Trader Fraud checks. The narrow calculation leaves those external factual checks as stated conditions; it does not certify them. Incorrect OVR pay-only GST is directed to supplier correction. A confirmed business share is an input to the candidate allocation, not a substitute for the required attribution method. The proper invoice accounting period and stated SGD GST amount remain essential.

## Verification evidence

Executed `node --test tests/domain.test.mjs`: 23 passed, 0 failed. New positive India behavior was observed failing before implementation, alongside missing-default, statutory-check and coverage tests. Negative tests cover each missing/negative assertion, mixed use, unsupported purchase kinds, foreign establishment, wrong registration, GSTIN syntax, dates outside the implementation window, unconfirmed fields, nonpayment, prior claim and inconsistent totals. The earlier 16 domain tests remain passing.

Source review did not include authority authentication, supplier-data validation, complete national rule packs, expert sign-off, or every subsequent amendment outside the cited narrow route. Keep unsupported cases visible as research/review required.
