import prices from "./pricing.json" with { type: "json" };
import { z } from "zod";

export const verifiedPricing = prices;
export const aiError = (code, message, status = 503) =>
  Object.assign(new Error(message), { code, status });
const integer = z.number().int().safe().nonnegative();
const priceSchema = z
  .object({
    version: z.string().regex(/^[A-Za-z0-9._-]+$/),
    checked: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    model: z.literal("muse-spark-1.3"),
    mode: z.literal("standard"),
    inputUsdPerMillion: z.number().positive(),
    cachedInputUsdPerMillion: z.number().nonnegative(),
    outputUsdPerMillion: z.number().positive(),
    maxInputTokens: integer.positive().max(20000),
    maxOutputTokens: integer.min(16).max(1200),
    preflightRequired: z.literal(true),
    singleIterationOnly: z.literal(true),
    toolsAllowed: z.literal(false),
  })
  .passthrough();

export function validatePricing(pricing, model, clock = () => Date.now()) {
  const parsed = priceSchema.safeParse(pricing);
  if (!parsed.success || parsed.data.model !== model)
    throw aiError(
      "PRICING_UNVERIFIED",
      "AI pricing has not been verified for this model. Manual entry remains available.",
    );
  const age = clock() - Date.parse(parsed.data.checked + "T00:00:00Z");
  if (!Number.isFinite(age) || age < -86400000 || age > 30 * 86400000)
    throw aiError(
      "PRICING_STALE",
      "AI pricing needs a fresh source check before calls can resume.",
    );
  return parsed.data;
}

export function estimateMicrousd(tokens, pricing) {
  const { inputTokens, outputTokens } = z
    .object({ inputTokens: integer, outputTokens: integer })
    .strict()
    .parse(tokens);
  // USD / million tokens equals micro-USD / token. Ignore cache discounts.
  return Math.ceil(
    inputTokens * pricing.inputUsdPerMillion +
      outputTokens * pricing.outputUsdPerMillion,
  );
}

export function validatedUsage(usage, pricing, measuredInputTokens) {
  const parsed = z
    .object({
      input_tokens: integer,
      output_tokens: integer,
      total_tokens: integer.optional(),
    })
    .passthrough()
    .safeParse(usage);
  if (!parsed.success)
    throw aiError(
      "USAGE_UNVERIFIED",
      "Provider usage was incomplete. Its reserved allowance remains held.",
      502,
    );
  const v = parsed.data;
  if (
    v.input_tokens > pricing.maxInputTokens ||
    v.input_tokens > measuredInputTokens ||
    v.output_tokens > pricing.maxOutputTokens ||
    (v.total_tokens !== undefined &&
      v.total_tokens !== v.input_tokens + v.output_tokens)
  )
    throw aiError(
      "USAGE_UNVERIFIED",
      "Provider usage exceeded the verified bounds. AI is paused pending review.",
      502,
    );
  return { inputTokens: v.input_tokens, outputTokens: v.output_tokens };
}
