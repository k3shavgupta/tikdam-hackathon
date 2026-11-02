import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeCountry, planPurchase, assess } from "../server/domain.mjs";
import { factsSchema } from "../server/schema.mjs";
import * as catalogue from "../server/catalog.mjs";
const facts = {
  mode: "purchase",
  country: "GB",
  businessCountry: "GB",
  legalName: "North Studio Ltd",
  buyerName: "North Studio Ltd",
  registration: "standard",
  taxId: "GB123456789",
  supplierName: "Paper Works",
  supplierTaxId: "GB987654321",
  invoiceNumber: "PW-01",
  invoiceDate: "2026-10-20",
  item: "Office stationery",
  category: "ordinary",
  currency: "GBP",
  net: "100",
  tax: "20",
  gross: "120",
  businessUse: 100,
  invoiceConfirmed: true,
  documentType: "invoice",
  taxableActivity: "fully",
  supplierRegime: "ordinary",
  paid: "yes",
  priorClaim: "no",
  amountReceived: "",
  withheld: "",
  certificate: false,
};
test("Bali and Dubai map to national jurisdictions", () => {
  assert.equal(normalizeCountry("Bali"), "ID");
  assert.equal(normalizeCountry("Dubai"), "AE");
  assert.equal(normalizeCountry("Canada"), "CA");
});
test("before buying gives seller-ready truthful details and source links", () => {
  const p = planPurchase(facts);
  assert.ok(p.sellerRequest.includes("North Studio Ltd"));
  assert.ok(p.checklist.some((x) => x.id === "buyer"));
  assert.ok(p.sources.length);
  assert.equal(p.guaranteedRefund, false);
});
test("foreign-established taxpayer gets a separate route", () => {
  const p = planPurchase({ ...facts, country: "AE", businessCountry: "GB" });
  assert.equal(p.route.type, "foreign_business");
  assert.match(p.route.text, /reciproc/i);
});
test("unregistered taxpayer is not promised input credits", () => {
  const p = planPurchase({ ...facts, registration: "none" });
  assert.match(p.warnings.join(" "), /registration|registered/i);
});
test("supported UK ordinary expense gets conditional credit, never cash refund", () => {
  const r = assess(facts);
  assert.equal(r.status, "conditional");
  assert.equal(r.benefit.amount, "20.00");
  assert.equal(r.benefit.type, "input_credit");
  assert.equal(r.cashRefund, null);
});
test("wrong invoice owner prevents amount", () => {
  const r = assess({ ...facts, buyerName: "Someone Else Ltd" });
  assert.equal(r.benefit.amount, null);
  assert.ok(r.issues.some((x) => x.code === "buyer_mismatch"));
});
test("unconfirmed extraction cannot produce a credit", () => {
  const r = assess({ ...facts, invoiceConfirmed: false });
  assert.equal(r.benefit.amount, null);
  assert.ok(r.issues.some((x) => x.code === "confirm_fields"));
});
test("bad invoice arithmetic stops a monetary claim", () => {
  const r = assess({ ...facts, gross: "140" });
  assert.equal(r.benefit.amount, null);
  assert.ok(r.issues.some((x) => x.code === "invoice_total"));
});
test("OVR Singapore GST goes to supplier correction", () => {
  const r = assess({
    ...facts,
    country: "SG",
    businessCountry: "SG",
    currency: "SGD",
    supplierRegime: "simplified",
  });
  assert.equal(r.benefit.type, "supplier_correction");
  assert.equal(r.benefit.amount, null);
});
test("Canadian capital assets are not blindly prorated", () => {
  const r = assess({
    ...facts,
    country: "CA",
    businessCountry: "CA",
    currency: "CAD",
    category: "equipment",
    businessUse: 40,
  });
  assert.equal(r.benefit.amount, null);
  assert.equal(r.status, "review_required");
});
test("all-country guidance does not imply all-country calculators", () => {
  for (const c of ["IN", "AU", "CA", "US", "ID", "VN", "CN", "AE", "JP"]) {
    const r = assess({ ...facts, country: c, businessCountry: c });
    assert.equal(r.benefit.amount, null);
    assert.ok(r.sources.length);
  }
});
test("worldwide selection prepares evidence without inventing local tax rules", () => {
  for (const {code, currency} of catalogue.countries) {
    const input = factsSchema.parse({...facts,country:code,businessCountry:code,currency:currency||''});
    const plan = planPurchase(input);
    const result = assess(input);
    assert.equal(plan.country,code);
    assert.equal(result.country,code);
    if (plan.readiness==='unreviewed') {
      assert.deepEqual(plan.sources,[]);
      assert.equal(result.benefit.amount,null);
      assert.equal(result.benefit.type,'local_tax_review');
      assert.ok(result.issues.some(issue=>issue.code==='coverage'));
      assert.deepEqual(result.sources,[]);
    }
  }
  assert.equal(factsSchema.safeParse({...facts,country:'XX'}).success,false);
  const client=assess(factsSchema.parse({...facts,mode:'client',country:'BR',businessCountry:'BR',currency:'BRL',amountReceived:'108',withheld:'12'}));
  assert.equal(client.benefit.type,'payment_reconciliation');
  assert.equal(client.benefit.amount,null);
  assert.deepEqual(client.sources,[]);
  assert.ok(client.issues.some(issue=>issue.code==='coverage'));
});
test("client shortfall is not assumed to be refundable withholding", () => {
  const r = assess({
    ...facts,
    mode: "client",
    amountReceived: "108",
    withheld: "12",
    certificate: false,
  });
  assert.equal(r.benefit.amount, null);
  assert.ok(r.issues.some((x) => x.code === "withholding_evidence"));
  assert.equal(r.cashRefund, null);
});
test("prior claim and reduced-exempt activity stop estimates", () => {
  for (const override of [
    { priorClaim: "yes" },
    { taxableActivity: "mixed" },
    { registration: "simplified" },
    { category: "vehicle" },
  ])
    assert.equal(assess({ ...facts, ...override }).benefit.amount, null);
});
test("unsupported currency and date cannot borrow UK assumptions", () => {
  assert.equal(assess({ ...facts, currency: "USD" }).benefit.amount, null);
  assert.equal(
    assess({ ...facts, invoiceDate: "2025-01-01" }).benefit.amount,
    null,
  );
});
test("client invoice produces a certificate request and separates the payment gap from tax", () => {
  const r = assess({
    ...facts,
    mode: "client",
    amountReceived: "108",
    withheld: "12",
    certificate: true,
    workCountry: "GB",
    taxResidence: "GB",
  });
  assert.match(r.clientRequest, /withholding|deduction/i);
  assert.match(r.clientRequest, /PW-01/);
  assert.equal(r.reconciliation.gap, "12.00");
  assert.equal(r.reconciliation.unexplained, "0.00");
  assert.equal(r.cashRefund, null);
  assert.deepEqual(r.sources.map((source) => source.id), ["gb-client-1"]);
});
test("calendar-invalid date does not pass a supported estimate", () => {
  assert.equal(
    assess({ ...facts, invoiceDate: "2026-02-31" }).benefit.amount,
    null,
  );
});

const indiaChecks = {
  purchaseKind: "office_stationery",
  received: "yes",
  invoiceValid: "yes",
  gstr2bAvailable: "yes",
  supplierTaxPaid: "yes",
  returnFiled: "yes",
  notBlocked: "yes",
  domesticForwardCharge: "yes",
  claimPeriodOpen: "yes",
};
const indiaFacts = {
  ...facts,
  country: "IN",
  businessCountry: "IN",
  taxId: "09ABCDE1234F1Z5",
  supplierTaxId: "09PQRSX6789L1Z2",
  currency: "INR",
  net: "1000",
  tax: "180",
  gross: "1180",
  indiaChecks,
};

test("India requires explicit checks before showing an invoice-tax allocation", () => {
  const parsed = factsSchema.parse(indiaFacts);
  const r = assess(parsed);
  assert.equal(r.status, "conditional");
  assert.equal(r.benefit.type, "input_credit");
  assert.equal(r.benefit.amount, "180.00");
  assert.equal(r.cashRefund, null);
  assert.equal(r.verification, "user_assertions_only");
  assert.match(r.conditions.join(" "), /GSTR-2B.*not.*prove|not.*GSTR-2B/i);
  assert.ok(r.sources.some((s) => s.provision?.includes("16")));
});

test("missing India checks default to unknown and never silently confirm eligibility", () => {
  const { indiaChecks: ignored, ...withoutChecks } = indiaFacts;
  const parsed = factsSchema.parse(withoutChecks);
  assert.equal(parsed.indiaChecks.gstr2bAvailable, "unknown");
  const r = assess(parsed);
  assert.equal(r.benefit.amount, null);
  assert.ok(r.issues.some((i) => i.code === "india_gstr2bAvailable"));
});

test("each missing or negative statutory India check blocks the numerical route", () => {
  for (const key of Object.keys(indiaChecks).filter((k) => k !== "purchaseKind")) {
    for (const value of ["no", "unknown"]) {
      const r = assess({ ...indiaFacts, indiaChecks: { ...indiaChecks, [key]: value } });
      assert.equal(r.benefit.amount, null, key + ":" + value);
      assert.ok(r.issues.some((i) => i.code === "india_" + key));
    }
  }
});

test("India does not apply a universal mixed-use ratio or support other purchase kinds", () => {
  for (const override of [
    { businessUse: 40 },
    { indiaChecks: { ...indiaChecks, purchaseKind: "other" } },
    { indiaChecks: { ...indiaChecks, purchaseKind: "unknown" } },
    { category: "equipment" },
    { businessCountry: "GB" },
    { registration: "simplified" },
  ]) {
    assert.equal(assess({ ...indiaFacts, ...override }).benefit.amount, null);
  }
});

test("India checks GSTIN syntax and preserves the supported transaction-date window", () => {
  for (const override of [
    { taxId: "" },
    { supplierTaxId: "GB123456789" },
    { invoiceDate: "2026-11-02" },
    { invoiceDate: "2025-10-20" },
    { invoiceConfirmed: false },
    { paid: "no" },
    { priorClaim: "yes" },
    { gross: "1200" },
  ]) {
    assert.equal(assess({ ...indiaFacts, ...override }).benefit.amount, null);
  }
});

test("India claim-period guidance identifies the earlier annual-return limit", () => {
  const r = assess({ ...indiaFacts, invoiceDate: "2026-01-20" });
  assert.match(r.conditions.join(" "), /30 November 2026/);
  assert.match(r.conditions.join(" "), /annual return.*earlier|earlier.*annual return/i);
});

test("coverage distinguishes tested narrow routes from guidance and withholding research", () => {
  assert.equal(typeof catalogue.getCoverage, "function");
  const coverage = catalogue.getCoverage();
  assert.equal(coverage.length, 250);
  const india = coverage.find((c) => c.code === "IN");
  assert.equal(india.purchaseEstimate, "conditional_narrow");
  assert.equal(india.clientEstimate, "research_pending");
  assert.equal(india.verifiedGovernmentData, false);
  assert.equal(coverage.find((c) => c.code === "CA").purchaseEstimate, "research_pending");
  for (const country of coverage.filter(country=>country.readiness!=='unreviewed')) {
    assert.ok(country.sources.length);
    assert.ok(country.routeVersion);
    assert.equal(country.sourceChecked, "2026-11-01");
  }
  const france=coverage.find(country=>country.code==='FR');
  assert.equal(france.readiness,'unreviewed');
  assert.equal(france.sourceChecked,null);
  assert.deepEqual(france.sources,[]);
});
