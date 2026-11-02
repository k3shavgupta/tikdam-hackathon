import { z } from "zod";
import {countryRegions} from './country-regions.mjs';
export const countryCodeSchema = z.enum(countryRegions.map(([code]) => code));
const short = z.string().trim().max(200),
  amount = z
    .string()
    .regex(
      /^$|^\d{1,12}(\.\d{1,4})?$/,
      "Enter a positive number without commas.",
    );
const assertion = z.enum(["yes", "no", "unknown"]).default("unknown");
export const indiaChecksSchema = z.object({
  purchaseKind: z.enum(["office_stationery", "other", "unknown"]).default("unknown"),
  received: assertion,
  invoiceValid: assertion,
  gstr2bAvailable: assertion,
  supplierTaxPaid: assertion,
  returnFiled: assertion,
  notBlocked: assertion,
  domesticForwardCharge: assertion,
  claimPeriodOpen: assertion,
}).strict();
export const factsSchema = z
  .object({
    mode: z.enum(["before", "purchase", "client"]),
    country: countryCodeSchema,
    businessCountry: countryCodeSchema,
    taxResidence: short.default("unknown"),
    workCountry: short.default("unknown"),
    legalName: short.default(""),
    billingAddress: z.string().max(500).default(""),
    taxId: short.default(""),
    registration: z
      .enum(["standard", "none", "simplified", "unknown"])
      .default("unknown"),
    item: short.default(""),
    category: z
      .enum([
        "ordinary",
        "equipment",
        "vehicle",
        "travel",
        "entertainment",
        "other",
      ])
      .default("other"),
    businessUse: z.number().min(0).max(100).default(100),
    buyerName: short.default(""),
    supplierName: short.default(""),
    supplierTaxId: short.default(""),
    invoiceNumber: short.default(""),
    invoiceDate: z.string().max(10).default(""),
    currency: z.string().regex(/^$|^[A-Z]{3}$/, 'Enter a three-letter currency code.').default("INR"),
    net: amount.default(""),
    tax: amount.default(""),
    gross: amount.default(""),
    amountReceived: amount.default(""),
    withheld: amount.default(""),
    documentType: z
      .enum(["invoice", "quote", "receipt", "unknown"])
      .default("unknown"),
    invoiceConfirmed: z.boolean().default(false),
    taxableActivity: z
      .enum(["fully", "mixed", "exempt", "unknown"])
      .default("unknown"),
    supplierRegime: z
      .enum(["ordinary", "simplified", "unknown"])
      .default("unknown"),
    paid: z.enum(["yes", "no", "unknown"]).default("unknown"),
    priorClaim: z.enum(["no", "yes", "unknown"]).default("unknown"),
    certificate: z.boolean().default(false),
    region: short.default(""),
    indiaChecks: indiaChecksSchema.prefault({}),
  })
  .strict();
