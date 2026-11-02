import {countryRegions} from './country-regions.mjs';

const source = (title, url, provision = null) => ({
  title, url, checked: "2026-11-01", ...(provision ? { provision } : {}),
});
export const reviewedCountries = [
  {
    code: "IN",
    name: "India",
    currency: "INR",
    tax: "GST",
    idLabel: "GSTIN",
    billing:
      "Give the seller the actual recipient’s name, address and GSTIN, if registered. Ask for the applicable GST components and place of supply to be shown correctly.",
    local:
      "Check GST input-credit conditions and reconcile the invoice with GSTR-2B. Credit visibility alone does not establish eligibility.",
    foreign:
      "Check Indian registration and nonresident-taxpayer restrictions. A foreign incorporation certificate alone does not create a GST refund right.",
    warning:
      "Composition, blocked credits, mixed use and the place of supply need separate checks.",
    sources: [
      source(
        "GST Portal: GSTR-2B and ITC",
        "https://tutorial.gst.gov.in/userguide/returns/FAQ_gstr2b.htm",
      ),
      source(
        "CBIC: invoice particulars (verify current amendments)",
        "https://cbic-gst.gov.in/gst-invoice-rules.html",
      ),
      source(
        "CBIC: conditions and time limits for input GST credit",
        "https://taxinformation.cbic.gov.in/content-page/explore-act/1000285/1000001",
        "CGST Act section 16(1), 16(2)(a)-(d), payment provisos and 16(4)",
      ),
      source(
        "CBIC: apportionment and blocked input credits",
        "https://taxinformation.cbic.gov.in/content-page/explore-act/1000286/1000001",
        "CGST Act section 17(1), 17(2), 17(5)",
      ),
    ],
  },
  {
    code: "GB",
    name: "United Kingdom",
    currency: "GBP",
    tax: "VAT",
    idLabel: "VAT number",
    billing:
      "Ask for the correct buyer name/address, supplier VAT number, invoice number, supply date, item details and VAT breakdown. Keep the final VAT invoice, not just a quote.",
    local:
      "Ordinary VAT-registered businesses can claim qualifying business VAT through their VAT return, subject to the applicable rules.",
    foreign:
      "Consider HMRC Notice 723A overseas-business refund conditions, including establishment, local supplies, registration and reciprocal treatment.",
    warning:
      "Flat Rate Scheme, partial exemption, vehicles, entertainment and Northern Ireland need separate treatment.",
    sources: [
      source(
        "HMRC: business VAT reclaim",
        "https://www.gov.uk/charge-reclaim-record-vat/reclaim-vat-business-expenses",
      ),
      source(
        "HMRC: VAT invoices",
        "https://www.gov.uk/hmrc-internal-manuals/compliance-operational-guidance/cog941020",
      ),
      source(
        "HMRC: overseas-business refunds",
        "https://www.gov.uk/guidance/refunds-of-uk-vat-for-non-uk-businesses-or-eu-vat-for-uk-businesses",
      ),
      source(
        "UK legislation: business input tax",
        "https://www.legislation.gov.uk/ukpga/1994/23/section/24",
        "Value Added Tax Act 1994 section 24(1), (5)",
      ),
      source(
        "UK legislation: attribution of input tax",
        "https://www.legislation.gov.uk/ukpga/1994/23/section/26",
        "Value Added Tax Act 1994 section 26(1)-(3)",
      ),
    ],
  },
  {
    code: "AU",
    name: "Australia",
    currency: "AUD",
    tax: "GST",
    idLabel: "ABN / GST registration",
    billing:
      "Ask for a tax invoice showing the supplier’s identity and ABN, date, purchase details and GST. Confirm when buyer identity or ABN must appear.",
    local:
      "Check creditable purpose, GST registration, invoice requirements and the relevant business activity statement.",
    foreign:
      "Check eligibility for standard GST or GST-only registration. Simplified registration is a different regime and must not be assumed to allow credits.",
    warning:
      "ABN and GST registration are different. Private use and input-taxed activity can restrict credits.",
    sources: [
      source(
        "ATO: tax invoice requirements",
        "https://www.ato.gov.au/api/public/content/0-1e92db95-a75c-4f4e-a3d4-39f43b1a3b25",
      ),
      source(
        "ATO: GST registration and credits",
        "https://community.ato.gov.au/s/article/a07RF00000ekjCh/when-you-need-to-register-for-gst",
      ),
    ],
  },
  {
    code: "CA",
    name: "Canada",
    currency: "CAD",
    tax: "GST/HST",
    idLabel: "GST/HST registration number",
    billing:
      "Request the supporting supplier and buyer details, registration number, description and GST/HST information appropriate to the invoice value. Record the province.",
    local:
      "Review GST/HST input-tax credits for commercial activities, with separate capital-property and provincial-tax rules.",
    foreign:
      "Nonresident ordinary GST/HST registration and ITC conditions need checking. An overseas business trip alone does not establish a refund.",
    warning:
      "QST/PST are separate. Capital assets cannot always be calculated using a simple business-use percentage.",
    sources: [
      source(
        "CRA: ITCs and document requirements",
        "https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses/calculate-prepare-report/input-tax-credit.html",
      ),
      source(
        "CRA: nonresident businesses",
        "https://www.canada.ca/en/revenue-agency/services/forms-publications/publications/rc4027/doing-business-canada-gst-hst-information-non-residents.html",
      ),
    ],
  },
  {
    code: "US",
    name: "United States",
    currency: "USD",
    tax: "Sales tax",
    idLabel: "Applicable state tax details",
    billing:
      "Record the state/locality, actual buyer and delivery location. Ask the seller about a legally applicable exemption before purchase; do not use a resale certificate for ordinary own-business use.",
    local:
      "Check state-specific exemptions or tax-paid-in-error correction. An income-tax expense deduction is a different benefit.",
    foreign:
      "Check the actual state and export/delivery evidence. Texas export rules are an example and do not apply nationwide.",
    warning:
      "No nationwide VAT input-credit calculation. State and transaction details are required.",
    sources: [
      source(
        "Texas: sales-tax refunds (Texas only)",
        "https://comptroller.texas.gov/taxes/sales/refunds/",
      ),
      source("IRS: business expenses", "https://www.irs.gov/publications/p334"),
    ],
  },
  {
    code: "ID",
    name: "Indonesia · Bali",
    currency: "IDR",
    tax: "VAT / PPN",
    idLabel: "Applicable NPWP / tax details",
    billing:
      "Ask whether the seller can issue the appropriate Faktur Pajak to the actual purchaser and verify the current recipient details with the seller. Separate national VAT from local levies.",
    local:
      "Review PKP/VAT-entrepreneur status and input VAT requirements under current Indonesian law.",
    foreign:
      "A general foreign-company visitor refund is not verified here. Tourist departure refunds are a separate scheme with their own conditions.",
    warning:
      "Current Coretax rules, taxpayer regime and local Bali levies require specific review.",
    sources: [
      source(
        "DGT: collection of VAT (overview)",
        "https://pajak.go.id/index.php/en/collection-value-added-tax",
      ),
      source(
        "DGT: separate tourist scheme",
        "https://pajak.go.id/tax-refund-tourists",
      ),
    ],
  },
  {
    code: "VN",
    name: "Vietnam",
    currency: "VND",
    tax: "VAT",
    idLabel: "Applicable Vietnamese tax code",
    billing:
      "Confirm the actual buyer and required tax code with the supplier, request the applicable valid e-invoice, and retain payment evidence. Verify current invoice requirements before paying.",
    local:
      "Review credit-method eligibility and the current amended VAT rules. A full numerical rule pack is pending.",
    foreign:
      "Foreign-contractor and local-registration treatment require separate analysis. No general foreign-business invoice refund is verified here.",
    warning:
      "2025–26 changes require current native-language legal review before determining entitlement.",
    sources: [
      source(
        "Government: 2026 tax amendments",
        "https://vanban.chinhphu.vn/?docid=218095&pageid=27160",
      ),
      source(
        "Government: VAT implementation amendments",
        "https://vanban.chinhphu.vn/?classid=1&docid=218020&orggroupid=2&pageid=27160",
      ),
    ],
  },
  {
    code: "SG",
    name: "Singapore",
    currency: "SGD",
    tax: "GST",
    idLabel: "GST registration number",
    billing:
      "Provide the actual buyer’s details and ask for the applicable tax invoice. If buying from an OVR vendor as a GST-registered customer, provide registration evidence to avoid an incorrect GST charge.",
    local:
      "Check the IRAS input-tax conditions, taxable business activity, valid invoice and correct accounting period.",
    foreign:
      "Ordinary registration/local agency and overseas-vendor registration are different routes. OVR simplified pay-only registration does not permit input-tax claims.",
    warning:
      "Incorrectly charged OVR GST should be referred to the supplier for a refund, not claimed as input tax.",
    sources: [
      source(
        "IRAS: input-tax conditions",
        "https://www.iras.gov.sg/taxes/goods-services-tax-%28gst%29/claiming-gst-%28input-tax%29/conditions-for-claiming-input-tax",
        "IRAS input-tax conditions 1-8; GST (General) Regulations 26 and 27",
      ),
      source(
        "IRAS: overseas businesses",
        "https://www.iras.gov.sg/taxes/goods-services-tax-%28gst%29/gst-and-digital-economy/overseas-businesses",
      ),
      source(
        "Singapore legislation: input-tax credit",
        "https://sso.agc.gov.sg/Act/GSTA1993?ProvIds=pr19-",
        "Goods and Services Tax Act 1993 sections 19 and 20",
      ),
    ],
  },
  {
    code: "CN",
    name: "China · mainland",
    currency: "CNY",
    tax: "VAT",
    idLabel: "Applicable taxpayer identifier",
    billing:
      "Ask a local adviser and supplier which fapiao and purchaser details apply to the actual taxpayer and expense. Do not assume an ordinary receipt supports an input VAT credit.",
    local:
      "Review general/small-scale taxpayer status, valid documentation and the VAT law effective in 2026. Detailed rules are pending.",
    foreign:
      "A general foreign-company business-visitor refund has not been verified. Tourist personal-use goods are a separate route.",
    warning:
      "Native-language rule review and provider/market availability checks are required before release.",
    sources: [
      source(
        "STA: 2026 VAT implementation",
        "https://www.chinatax.gov.cn/eng/c101269/c5246628/content.html",
      ),
      source(
        "STA: tourist goods (separate route)",
        "https://www.chinatax.gov.cn/eng/c101276/c102444/c5240902/content.html",
      ),
    ],
  },
  {
    code: "AE",
    name: "UAE · Dubai",
    currency: "AED",
    tax: "VAT",
    idLabel: "TRN, if applicable",
    billing:
      "Request a valid tax invoice with the actual buyer, supplier TRN, dates, purchase details and the applicable VAT amounts. Include the recipient TRN where required.",
    local:
      "Check correctly charged VAT, taxable-person status, supporting invoice, taxable business use and payment conditions.",
    foreign:
      "Consider the foreign-business visitor scheme, including reciprocity, establishment/local-business restrictions and evidence.",
    warning:
      "Free-zone/company registration alone does not establish a VAT reclaim; local fees are not automatically recoverable VAT.",
    sources: [
      source(
        "FTA: business visitor refunds",
        "https://tax.gov.ae/en/taxes/Vat/refunds/business.visitors.aspx",
      ),
      source(
        "FTA: tax-invoice guidance",
        "https://tax.gov.ae/ftatacsoft5cms/DataFolder/Files/Pdf/2022/Get%20to%20know%20your%20Tax%20Obligations.pdf",
      ),
    ],
  },
  {
    code: "JP",
    name: "Japan",
    currency: "JPY",
    tax: "Consumption tax",
    idLabel: "Applicable registration details",
    billing:
      "Confirm whether the supplier issues qualified invoices and what records your business needs. Ask for the invoice and item/tax details appropriate to your actual taxpayer.",
    local:
      "Check taxable-business status, calculation method, qualified invoice records and transitional rules.",
    foreign:
      "Taxable-business registration/filing is separate from tourist shopping refunds. A generic foreign-company visitor route is not verified here.",
    warning:
      "Exempt businesses, simplified calculation, transitional dates and tax-agent requirements need review.",
    sources: [
      source(
        "NTA: purchase tax credits",
        "https://www.nta.go.jp/english/taxes/consumption_tax/pdf/2025/general_02.pdf",
      ),
      source(
        "NTA: treaty withholding refunds",
        "https://www.nta.go.jp/english/taxes/withholing/Information/13002.htm",
      ),
    ],
  },
];
for (const country of reviewedCountries) {
  country.sources = country.sources.map((s, index) => ({ id: `${country.code.toLowerCase()}-${index + 1}`, ...s }));
}
const reviewedCodes = new Set(reviewedCountries.map(country => country.code));
export const countries = [
  ...reviewedCountries,
  ...countryRegions.filter(([code]) => !reviewedCodes.has(code)).map(([code, name]) => ({
    code, name, currency: '', tax: 'Local rules not reviewed', idLabel: 'Tax identifier, if applicable',
    billing: 'Ask the seller which final invoice or receipt is appropriate for the actual purchaser. Confirm the buyer details, supply date, item, currency, and any tax shown with a local professional before paying.',
    local: 'Tikdam has not reviewed this country or territory’s tax registration, input-credit, deduction, or refund rules. Keep the purchase evidence and check the current local rules with a qualified adviser.',
    foreign: 'Cross-border registration, place of supply, tax recovery, and refund routes have not been reviewed here. Confirm the applicable countries and current rules with a qualified adviser.',
    warning: 'No country-specific tax eligibility, rate, filing route, or refund amount is validated for this location.',
    sources: [],
  })),
].sort((a, b) => a.name.localeCompare(b.name, 'en'));

export const indiaCheckDefinitions = [
  { key: "received", label: "The actual buyer has received all stationery on this invoice.", provision: "CGST Act 16(2)(b) and receipt-in-lots proviso" },
  { key: "invoiceValid", label: "The invoice and GST charge have been checked as legally valid for the actual recipient.", provision: "CGST Act 16(2)(a); applicable invoice rules" },
  { key: "gstr2bAvailable", label: "This invoice matches the recipient's GSTR-2B and its credit is not restricted.", provision: "CGST Act 16(2)(aa), 16(2)(ba); rule 36(4)" },
  { key: "supplierTaxPaid", label: "The supplier's tax-payment condition has been checked separately. GSTR-2B alone does not prove payment.", provision: "CGST Act 16(2)(c)" },
  { key: "returnFiled", label: "The relevant section 39 return condition has been checked and met.", provision: "CGST Act 16(2)(d)" },
  { key: "notBlocked", label: "Section 17 blocked-credit and special-use exclusions have been checked and do not apply, including gifts, lost goods and CSR.", provision: "CGST Act 17(5)" },
  { key: "domesticForwardCharge", label: "This is an ordinary domestic forward-charge stationery purchase, with no import, reverse charge or special scheme.", provision: "Implementation scope; CGST Act 16 and 17" },
  { key: "claimPeriodOpen", label: "The intended claim period is open under section 16(4), including the earlier annual-return filing limit. A preparer has checked the actual dates.", provision: "CGST Act 16(4)" },
];

export function getCoverage() {
  return countries.map((country) => {
    const numerical = ["IN", "GB", "SG"].includes(country.code);
    const reviewed = reviewedCodes.has(country.code);
    return {
      code: country.code,
      name: country.name,
      currency: country.currency,
      purchaseEstimate: numerical ? "conditional_narrow" : reviewed ? "research_pending" : "not_reviewed",
      clientEstimate: reviewed ? "research_pending" : "not_reviewed",
      readiness: numerical ? "tested" : reviewed ? "guidance" : "unreviewed",
      routeId: numerical ? `${country.code.toLowerCase()}-ordinary-input-credit` : reviewed ? `${country.code.toLowerCase()}-guidance` : 'generic-evidence-preparation',
      routeVersion: reviewed ? `tikdam-${country.code.toLowerCase()}-2026-11-01.2` : 'tikdam-generic-2026-11-02.1',
      sourceChecked: reviewed ? "2026-11-01" : null,
      sourceReview: numerical ? "official_sources_checked_for_narrow_route" : reviewed ? "initial_catalogue_only" : 'not_reviewed',
      transactionWindow: numerical ? { from: "2026-01-01", through: "2026-11-01" } : null,
      scope: country.code === "IN"
        ? "Domestic ordinary registered recipient, fully taxable activity, 100% business stationery, all statutory checks explicitly asserted. Candidate invoice GST only."
        : numerical
          ? "Ordinary domestic operating purchases, standard registration, fully taxable activity, confirmed business share and valid invoice. Candidate input tax only."
          : reviewed ? "Preparation and evidence guidance. No numerical eligibility route released." : "General invoice and evidence preparation only. Local tax rules and eligibility have not been reviewed.",
      verifiedGovernmentData: false,
      professionalSignOff: false,
      sources: country.sources,
    };
  });
}
export const clientSources = {
  IN: source(
    "Income Tax Department: TDS by tax period",
    "https://www.incometax.gov.in/iec/foportal/help/all-topics/e-filing-services/tds-compliance",
  ),
  GB: source(
    "HMRC: foreign tax credit relief (where applicable)",
    "https://www.gov.uk/tax-foreign-income/taxed-twice",
  ),
  AU: source(
    "ATO: foreign-resident withholding",
    "https://www.ato.gov.au/api/public/content/0-5f26059c-ce5e-49af-b962-f133352869dd",
  ),
  CA: source(
    "CRA: services provided in Canada withholding",
    "https://www.canada.ca/en/revenue-agency/services/forms-publications/publications/ic75-6/required-withholding-amounts-paid-non-residents-providing-services-canada.html",
  ),
  US: source(
    "IRS: where personal-service income is sourced",
    "https://www.irs.gov/individuals/international-taxpayers/source-of-income-personal-service-income",
  ),
  ID: source(
    "DGT: nonresident withholding (current procedure review needed)",
    "https://pajak.go.id/index.php/id/pemotongan-pajak-penghasilan-pasal-26",
  ),
  VN: source(
    "Vietnam MOF: foreign-contractor overview (dated)",
    "https://fia.mof.gov.vn/en/Single/MenuID/793a43ff-0059-4504-b747-934193322015",
  ),
  SG: source(
    "IRAS: nonresident-company payments",
    "https://www.iras.gov.sg/taxes/withholding-tax/payments-to-non-resident-company/payments-that-are-subject-to-withholding-tax",
  ),
  CN: source(
    "STA: treaty benefits and overpayment",
    "https://www.chinatax.gov.cn/eng/c102962/c102967/c102997/c103016/c5245833/content.html",
  ),
  AE: source(
    "FTA: withholding FAQ",
    "https://tax.gov.ae/en/faq.aspx?keyword=Does+the+UAE+CT+regime+have+withholding+tax%3F",
  ),
  JP: source(
    "NTA: treaty withholding refund",
    "https://www.nta.go.jp/english/taxes/withholing/Information/13002.htm",
  ),
};
for (const [code, s] of Object.entries(clientSources)) s.id = `${code.toLowerCase()}-client-1`;
