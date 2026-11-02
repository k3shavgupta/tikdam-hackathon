import Decimal from "decimal.js";
import { countries, reviewedCountries, clientSources, indiaCheckDefinitions } from "./catalog.mjs";
const reviewedCodes = new Set(reviewedCountries.map(country => country.code));
export function normalizeCountry(value) {
  const v = String(value || "")
    .toLowerCase()
    .trim();
  return (
    countries.find(
      (c) =>
        c.code.toLowerCase() === v ||
        c.name.toLowerCase().split(" · ")[0] === v,
    )?.code ||
    {
      bali: "ID",
      dubai: "AE",
      uk: "GB",
      usa: "US",
      china: "CN",
      indonesia: "ID",
      uae: "AE",
    }[v] ||
    null
  );
}
const countryFor = (f) =>
  countries.find((c) => c.code === normalizeCountry(f.country));
export function planPurchase(f) {
  const c = countryFor(f);
  if (!c) throw new Error("Choose a supported jurisdiction.");
  const foreign =
    f.businessCountry && normalizeCountry(f.businessCountry) !== c.code;
  const checklist = [
    {
      id: "buyer",
      title: "Use the actual purchaser’s details",
      text: `Give the seller your legal name${f.legalName ? ` (${f.legalName})` : ""}, billing address and applicable tax details. Do not use another person’s registration or backdate a document.`,
    },
    { id: "seller", title: "Confirm the seller’s invoice", text: c.billing },
    {
      id: "purpose",
      title: "Record the business purpose",
      text: "Describe how the purchase supports your work. Keep a reasonable record of personal versus business use.",
    },
    {
      id: "payment",
      title: "Keep the evidence together",
      text: "Save the final invoice, quote/order, payment record, delivery evidence and any later credit note. A quote alone may not support a claim.",
    },
    {
      id: "route",
      title: "Check the route before paying",
      text: foreign ? c.foreign : c.local,
    },
  ];
  const warnings = [
    c.warning,
    "A correctly named invoice is evidence; it does not create eligibility by itself.",
    "Company registration and VAT/GST registration are different.",
  ];
  if (f.registration !== "standard")
    warnings.unshift(
      "Check the applicable tax registration and regime before expecting an input-tax credit. Registration can create filing and payment obligations.",
    );
  if (f.category !== "ordinary")
    warnings.unshift(
      "Equipment, vehicles, travel, meals and mixed-use assets need category-specific rules.",
    );
  if (foreign)
    warnings.push(
      "Keep incorporation, tax residence, tax registration and the physical location of the purchase separate. Check any import tax at destination.",
    );
  return {
    country: c.code,
    countryName: c.name,
    guaranteedRefund: false,
    readiness: reviewedCodes.has(c.code) ? "guidance" : "unreviewed",
    route: {
      type: foreign ? "foreign_business" : "domestic",
      text: foreign ? c.foreign : c.local,
    },
    checklist,
    warnings,
    sources: c.sources,
    sellerRequest: `Please issue the appropriate invoice to the actual purchaser:\nLegal name: ${f.legalName || "[legal buyer name]"}\nBilling address: ${f.billingAddress || "[billing address]"}\n${c.idLabel}: ${f.taxId || "[applicable details; confirm requirements]"}\nPurchase: ${f.item || "[item/service]"}\n\nPlease confirm before payment which invoice you can issue. ${c.billing}\nPlease show accurate supply/invoice dates, purchase details, and the applicable net, tax and total amounts. Do not add tax that does not legally apply. I understand that an invoice does not itself guarantee a tax credit or refund.`,
  };
}
export function assess(f) {
  const c = countryFor(f);
  if (!c) throw new Error("Choose a supported jurisdiction.");
  const plan = planPurchase(f),
    issues = [];
  const add = (code, text) => issues.push({ code, text });
  const result = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    ruleVersion: reviewedCodes.has(c.code) ? `tikdam-${c.code.toLowerCase()}-2026-11-01.2` : 'tikdam-generic-2026-11-02.1',
    verification: "user_assertions_only",
    country: c.code,
    status: "review_required",
    title: "A route to check, with conditions",
    benefit: {
      type: "input_credit",
      amount: null,
      currency: f.currency || c.currency,
      label: "Potential input-tax credit",
    },
    cashRefund: null,
    issues,
    plan,
    sources: [...plan.sources],
    nextSteps: [],
    facts: f,
  };
  if (f.mode === "client") {
    result.benefit = {
      type: "withholding_review",
      amount: null,
      currency: f.currency || c.currency,
      label: "Withholding credit / refund review",
    };
    result.title = "Check what was deducted before claiming";
    result.sources = [clientSources[c.code], ...plan.sources].filter(Boolean);
    if (!reviewedCodes.has(c.code)) add('coverage', 'Local withholding, credit, and refund rules have not been reviewed for this location. This is an evidence request only.');
    result.clientRequest = `Please provide the payment breakdown and withholding/deduction certificate for invoice ${f.invoiceNumber || "[invoice number]"}, issued by ${f.legalName || "[legal issuer name]"}.\n\nPlease identify the gross invoice amount, amount paid, any tax withheld, tax jurisdiction, deduction date and the taxpayer credited. Please distinguish tax from platform/bank fees, FX, retention and unpaid balances, and provide the relevant certificate or remittance reference.\n\nThis is an evidence request, not a confirmation that a refund is due.`;
    try {
      const gap = new Decimal(f.gross).minus(f.amountReceived);
      result.reconciliation = {
        gap: gap.toFixed(2),
        reportedWithholding: new Decimal(f.withheld).toFixed(2),
        unexplained: gap.minus(f.withheld).toFixed(2),
      };
    } catch {}
    if (!f.workCountry || f.workCountry === "unknown")
      add(
        "work_location",
        "Confirm where the services were actually performed.",
      );
    if (!f.taxResidence || f.taxResidence === "unknown")
      add(
        "tax_residence",
        "Confirm the income recipient’s tax residence separately from incorporation.",
      );
    if (!f.certificate)
      add(
        "withholding_evidence",
        "Get the client’s withholding certificate and confirm the amount was tax, not fees, FX, retention or unpaid debt.",
      );
    add(
      "annual_position",
      "A single client invoice cannot determine an annual income-tax refund. Confirm residence, income type, where the work happened and the tax period.",
    );
    result.nextSteps = [
      "Reconcile gross invoice, taxes, fees and actual payment.",
      "Obtain the deduction certificate and confirm the correct taxpayer.",
      "Review source-country relief and residence-country credits together; do not count the same tax twice.",
    ];
    return result;
  }
  if (!reviewedCodes.has(c.code)) {
    result.title = 'Prepare the evidence; local rules need review';
    result.benefit = {type:'local_tax_review',amount:null,currency:f.currency || '',label:'Local tax treatment not reviewed'};
    add('coverage', 'Tikdam has not reviewed this location’s tax rules. It cannot determine a credit, deduction, refund, or filing route here.');
    if (!f.invoiceConfirmed) add('confirm_fields', 'Review and confirm the invoice details before using them.');
    if (!f.legalName || !f.buyerName) add('buyer_missing', 'Confirm the legal purchaser and the buyer named on the invoice.');
    else if (f.legalName.trim().toLowerCase() !== f.buyerName.trim().toLowerCase()) add('buyer_mismatch', 'The named buyer differs from the legal purchaser. Ask the seller or a local adviser to review it.');
    if (!f.currency) add('currency_missing', 'Record the currency shown on the invoice.');
    result.nextSteps = [
      'Keep the final invoice, payment record, and business-purpose evidence together.',
      'Confirm the correct local tax registration, invoice requirements, and filing route with a qualified local adviser.',
    ];
    return result;
  }
  if (!f.invoiceConfirmed)
    add(
      "confirm_fields",
      "Review and confirm all extracted or manually entered invoice fields.",
    );
  if (!f.legalName || !f.buyerName)
    add(
      "buyer_missing",
      "Confirm the actual taxpayer and the invoice recipient.",
    );
  else if (
    f.legalName.trim().toLowerCase() !== f.buyerName.trim().toLowerCase()
  )
    add(
      "buyer_mismatch",
      "The invoice recipient differs from the legal buyer. Check identity and ask the supplier to correct an error before claiming.",
    );
  for (const key of [
    "supplierName",
    "supplierTaxId",
    "invoiceNumber",
    "invoiceDate",
    "item",
  ])
    if (!f[key])
      add(
        "missing_" + key,
        `Confirm ${key.replace(/([A-Z])/g, " $1").toLowerCase()} or the legally permitted document alternative.`,
      );
  if (f.documentType !== "invoice")
    add(
      "document_type",
      "A quote/pro-forma is preparation evidence, not a final tax invoice.",
    );
  if (f.registration !== "standard")
    add(
      "registration",
      "The estimate supports ordinary tax registration only. Verify unregistered, exempt or simplified regimes separately.",
    );
  if (f.taxableActivity !== "fully")
    add(
      "activity",
      "Mixed, exempt or uncertain activity requires a separate recovery calculation.",
    );
  if (f.category !== "ordinary")
    add(
      "category",
      "This amount estimate covers ordinary operating supplies/services only, not equipment, vehicles, entertainment or other specialist categories.",
    );
  if (f.priorClaim !== "no")
    add(
      "duplicate",
      "Confirm that this tax has not already been claimed or refunded.",
    );
  if (f.paid !== "yes")
    add(
      "payment",
      "Confirm payment status and the applicable accounting/payment conditions.",
    );
  if (f.currency !== c.currency)
    add(
      "currency",
      "Check invoice currency and required conversion rules. No conversion is assumed.",
    );
  if (
    !/^2026-\d\d-\d\d$/.test(f.invoiceDate || "") ||
    f.invoiceDate > "2026-11-01" ||
    Number.isNaN(Date.parse(f.invoiceDate)) ||
    new Date(f.invoiceDate).toISOString().slice(0, 10) !== f.invoiceDate
  )
    add(
      "period",
      "This estimate has a limited 2026 transaction window through 1 November. Review other periods separately.",
    );
  let tax = null;
  try {
    const n = new Decimal(f.net),
      t = new Decimal(f.tax),
      g = new Decimal(f.gross),
      use = new Decimal(f.businessUse);
    if (
      n.lt(0) ||
      t.lte(0) ||
      g.lte(0) ||
      use.lt(0) ||
      use.gt(100) ||
      [n, t, g].some((x) => !x.isFinite())
    )
      throw Error();
    if (n.plus(t).minus(g).abs().gt("0.01"))
      add(
        "invoice_total",
        "Net plus tax does not match the invoice total. Correct the extracted values or ask the supplier.",
      );
    tax = t.times(use).div(100).toFixed(2);
  } catch {
    add(
      "amounts",
      "Enter valid net, tax, total and a business-use share from 0 to 100.",
    );
  }
  if (plan.route.type === "foreign_business")
    add(
      "cross_border",
      "Foreign-business claims require a separate registration, establishment, reciprocity and filing review.",
    );
  if (c.code === "SG" && f.supplierRegime === "simplified") {
    result.benefit.type = "supplier_correction";
    result.benefit.label = "Supplier correction";
    result.title = "Ask the supplier about the GST charge";
    add(
      "supplier_correction",
      "For a GST-registered customer incorrectly charged by an OVR vendor, IRAS directs you to the vendor for a refund, not an input-tax claim.",
    );
  } else if (f.supplierRegime !== "ordinary")
    add(
      "supplier_regime",
      "Confirm the supplier’s tax registration and invoice regime.",
    );
  if (c.code === "IN") {
    const checks = f.indiaChecks || {};
    if (checks.purchaseKind !== "office_stationery")
      add("india_purchaseKind", "The India amount route supports ordinary office stationery only. Other goods/services need separate review.");
    if (Number(f.businessUse) !== 100)
      add("india_businessUse", "The India amount route requires 100% business use. Mixed-use attribution and reversals need a separate rules calculation.");
    const gstinShape = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[A-Z0-9]$/;
    if (!gstinShape.test(String(f.taxId || "").trim()) || !gstinShape.test(String(f.supplierTaxId || "").trim()))
      add("india_gstin", "Check the actual buyer and supplier GSTINs. Format checking does not verify registration, identity or credit entitlement.");
    for (const check of indiaCheckDefinitions)
      if (checks[check.key] !== "yes") add("india_" + check.key, check.label + " " + check.provision + ". Unknown is not confirmation.");
  }
  if (!["IN", "GB", "SG"].includes(c.code))
    add(
      "coverage",
      "Country-specific guidance is available. A numerical eligibility calculator for this scenario has not been validated.",
    );
  if (issues.length === 0) {
    result.status = "conditional";
    result.title = "A potential credit to review";
    result.benefit.amount = tax;
    result.calculation = `Invoice tax ${f.tax} × ${f.businessUse}% business use = ${tax} ${f.currency}`;
    result.conditions = [
      "Based on your confirmed facts, not tax-authority approval.",
      "Claim only correctly charged tax attributable to qualifying taxable activity.",
      "Check all remaining jurisdiction-specific exclusions, filing limits and evidence before including it in a return.",
    ];
    if (c.code === "IN") {
      const year = Number(f.invoiceDate.slice(0, 4));
      const month = Number(f.invoiceDate.slice(5, 7));
      const deadlineYear = month <= 3 ? year : year + 1;
      result.conditions.push(
        "India statutory checks are your assertions. Tikdam has not verified GST registration, returns, receipt, supplier tax payment or statutory entitlement.",
        "GSTR-2B visibility does not by itself prove the supplier tax-payment condition or remove section 17 exclusions.",
        `Section 16(4)'s ordinary outer date for this invoice is 30 November ${deadlineYear}, or the relevant annual return filing date if earlier. Check actual claim dates and applicable exceptions with your preparer. This is not a filing-deadline calculator.`,
        "This is a candidate allocation of the stated invoice GST, not cash payable to you. Tax-component ledger utilisation, SGST/IGST interaction and filing are outside this calculation.",
      );
    } else if (c.code === "SG") {
      result.conditions.push(
        "Check all eight IRAS conditions, including genuine supply, valid invoice, taxable attribution, Regulations 26/27 exclusions and reasonable Missing Trader Fraud checks. Tikdam has not performed those external checks.",
        "Use the correct tax-invoice accounting period and SGD tax amount. Simplified invoices, imports, foreign-currency conversion and special regimes are outside this narrow calculation.",
      );
    } else if (c.code === "GB") {
      result.conditions.push(
        "Keep a valid VAT invoice and evidence of the business-use share. Flat Rate Scheme, partial exemption, margin schemes, imports, capital assets and specialist exclusions require separate review.",
        "The paid-invoice requirement is a conservative implementation limit, not a statement that UK law always requires payment before claiming. Verify the proper VAT period and time limit.",
      );
    }
  }
  result.nextSteps =
    result.benefit.type === "supplier_correction"
      ? [
          "Ask the overseas vendor to check the charge and issue the appropriate correction.",
          "Keep the original invoice and any credit note together.",
        ]
      : [
          "Resolve the listed document and eligibility conditions.",
          "Check the source-linked route and filing period with your tax preparer.",
          "Include only the amount supported by the applicable rules in the appropriate return or claim.",
        ];
  return result;
}
