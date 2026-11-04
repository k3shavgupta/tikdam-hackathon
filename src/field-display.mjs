export const modes = [
  ["before", "Before you buy", "Get the invoice right from the start.", "↗"],
  ["purchase", "Review a bill", "Read it, check it, find your next step.", "▤"],
  ["client", "Check a client payment", "Understand tax deducted from your pay.", "⇄"],
];

export const categories = [
  ["other", "Choose a category"],
  ["ordinary", "Ordinary operating supplies / services"],
  ["equipment", "Equipment / capital asset"],
  ["vehicle", "Vehicle"],
  ["travel", "Travel / accommodation"],
  ["entertainment", "Meals / entertainment"],
];

const labels = {
  mode: "What would you like help with?",
  businessCountry: "Business established in",
  item: "What is the purchase or service?",
  category: "Category",
  businessUse: "Business use (%)",
  currency: "Currency (three-letter code)",
  taxResidence: "Income recipient’s tax residence",
  workCountry: "Where was the work performed?",
  legalName: "Your legal name / business name",
  billingAddress: "Billing address",
  supplierTaxId: "Supplier tax identifier",
  invoiceNumber: "Invoice number",
  invoiceDate: "Invoice date",
  net: "Net amount",
  tax: "Tax shown on invoice",
  gross: "Total amount",
  amountReceived: "Amount received",
  withheld: "Tax reportedly withheld",
  documentType: "Document type",
  invoiceConfirmed: "Invoice details confirmed",
  taxableActivity: "Business activity",
  supplierRegime: "Supplier’s tax regime",
  paid: "Has this invoice been paid?",
  priorClaim: "Already claimed or refunded?",
  certificate: "Withholding certificate",
  region: "State / province / locality",
  indiaChecks: "India stationery checks",
};

export function fieldLabel(key, facts, countries = []) {
  const country = countries.find(row => row.code === facts.country);
  const contextual = {
    country: facts.mode === "client" ? "Client / source country" : "Purchase / tax country",
    buyerName: facts.mode === "client" ? "Customer named on invoice" : "Buyer named on invoice",
    supplierName: facts.mode === "client" ? "Issuer / your business" : "Supplier name",
    registration: `Registration in ${country?.name || "purchase country"}`,
    taxId: country?.idLabel || "Tax details",
  };
  return contextual[key] || labels[key] || key.replace(/([A-Z])/g, " $1").replace(/_/g, " ").replace(/^./, letter => letter.toUpperCase());
}

export function fieldValue(key, value, countries = []) {
  if (["country", "businessCountry", "taxResidence", "workCountry"].includes(key)) {
    if (value === "unknown") return key === "workCountry" ? "Not sure / multiple countries" : "Not sure";
    return countries.find(country => country.code === value)?.name || String(value);
  }
  if (key === "mode") return modes.find(([id]) => id === value)?.[1] || String(value);
  if (key === "category") return categories.find(([id]) => id === value)?.[1] || String(value);
  if (key === "businessUse") return `${value}%`;
  return typeof value === "object" ? JSON.stringify(value) : String(value);
}
