import { aiError } from "./pricing.mjs";

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .filter((k) => value[k] !== undefined)
        .map((k) => [k, canonical(value[k])]),
    );
  return value;
}
export async function payloadDigest(secret, value) {
  if (typeof secret !== "string" || secret.length < 32)
    throw aiError(
      "CONTROLS_UNAVAILABLE",
      "AI controls are not configured. Manual entry remains available.",
    );
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const bytes = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(JSON.stringify(canonical(value))),
  );
  return Array.from(new Uint8Array(bytes), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}
export async function reserve(repository, input) {
  let result;
  try {
    result = await repository.reserveAiCall(input);
  } catch {
    throw aiError(
      "STORAGE_UNAVAILABLE",
      "AI spending controls are temporarily unavailable. No provider request was sent.",
    );
  }
  if (!result?.admitted) {
    const reasons = {
      AI_PAUSED: "AI is paused. Manual entry remains available.",
      BUDGET_EXHAUSTED:
        "The campaign allowance has been reached. Manual entry remains available.",
      DAILY_LIMIT:
        "The daily AI allowance has been reached. Try another day or use manual entry.",
      IN_FLIGHT:
        "Another AI operation is running. Wait before starting a new request.",
      ALREADY_PROCESSED:
        "This request was already admitted. It will not be sent again. Review its previous result or enter facts manually.",
      IDEMPOTENCY_CONFLICT:
        "This request identifier was already used for different input. It was not sent again.",
    };
    const code = Object.hasOwn(reasons, result?.reason)
      ? result.reason
      : "BUDGET_EXHAUSTED";
    throw aiError(
      code,
      reasons[code],
      code === "IDEMPOTENCY_CONFLICT" || code === "ALREADY_PROCESSED"
        ? 409
        : 429,
    );
  }
  return result.reservationId;
}
