import { z } from "zod";
import {
  validateFile,
  createExtractionPayload,
  parseExtraction,
} from "../meta.mjs";
import { chatRequest, createChatPayload, parseChatResult } from "./schemas.mjs";
import {
  verifiedPricing,
  validatePricing,
  estimateMicrousd,
  validatedUsage,
  aiError,
} from "./pricing.mjs";
import { payloadDigest, reserve } from "./budget.mjs";

const identity = z
  .object({
    sessionId: z.string().uuid(),
    requestId: z.string().uuid(),
    idempotencyKey: z.string().uuid(),
  })
  .strip();
const integer = z.number().int().safe().nonnegative();
const endpoint = "https://api.meta.ai/v1/responses";

export function createAiService({
  env = {},
  repository,
  fetchImpl = fetch,
  clock = () => Date.now(),
  pricing = verifiedPricing,
} = {}) {
  const model = env.META_MODEL || "muse-spark-1.3";
  const key = env.META_MODEL_API_KEY || env.MODEL_API_KEY || "";
  function configuration() {
    if (env.AI_ENABLED !== "true")
      throw aiError(
        "AI_PAUSED",
        "AI is paused to preserve credits. Manual entry and source-linked checks remain available.",
      );
    if (!key)
      throw aiError(
        "MODEL_NOT_CONFIGURED",
        "Meta is not configured. Manual entry remains available.",
      );
    if (
      typeof env.SESSION_HMAC_SECRET !== "string" ||
      env.SESSION_HMAC_SECRET.length < 32 ||
      !env.TURNSTILE_SITE_KEY ||
      !env.TURNSTILE_SECRET_KEY
    )
      throw aiError(
        "CONTROLS_UNAVAILABLE",
        "AI abuse and spending controls are not configured. Manual entry remains available.",
      );
    return validatePricing(pricing, model, clock);
  }
  async function capabilities() {
    try {
      configuration();
      if (!(await repository.getSettings()).aiEnabled)
        throw aiError(
          "AI_PAUSED",
          "AI is paused to preserve credits. Manual entry remains available.",
        );
      return {
        enabled: true,
        chatAvailable: true,
        extractionAvailable: true,
        reason: null,
      };
    } catch (error) {
      return {
        enabled: false,
        chatAvailable: false,
        extractionAvailable: false,
        reason: error.code
          ? error.message
          : "AI controls are unavailable. Manual entry remains available.",
      };
    }
  }
  async function pause() {
    try {
      await repository.updateSettings({
        actor: "system:ai-safety",
        patch: { aiEnabled: false },
      });
    } catch {
      /* Admission still fails closed if the storage itself is unavailable. */
    }
  }
  async function requestJson(url, body, timeoutMs = 45000) {
    let response;
    try {
      response = await fetchImpl(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch {
      throw aiError(
        "PROVIDER_UNAVAILABLE",
        "Meta did not respond. This request was not automatically retried.",
        502,
      );
    }
    if (!response.ok)
      throw aiError(
        response.status === 401
          ? "PROVIDER_AUTH_REJECTED"
          : response.status === 429
            ? "PROVIDER_LIMIT"
            : "PROVIDER_UNAVAILABLE",
        "Meta could not complete this operation. Use manual entry; the request was not automatically retried.",
        502,
      );
    // Bound upstream data while reading; never put its raw body in an error/log.
    try {
      const reader = response.body?.getReader();
      if (!reader) throw Error();
      let count = 0;
      const chunks = [];
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          count += value.byteLength;
          if (count > 512000) {
            await reader.cancel();
            throw Error();
          }
          chunks.push(value);
        }
      } finally {
        reader.releaseLock();
      }
      const bytes = new Uint8Array(count);
      let at = 0;
      for (const c of chunks) {
        bytes.set(c, at);
        at += c.byteLength;
      }
      return JSON.parse(new TextDecoder().decode(bytes));
    } catch {
      throw aiError(
        "PROVIDER_RESPONSE_INVALID",
        "Meta returned an unreadable response. Use manual entry.",
        502,
      );
    }
  }
  async function perform({ operation, input, payload, parse, mode, country }) {
    const verified = configuration();
    identity.parse(input);
    let settings;
    try {
      settings = await repository.getSettings();
    } catch {
      throw aiError(
        "STORAGE_UNAVAILABLE",
        "AI spending controls are temporarily unavailable.",
      );
    }
    if (!settings.aiEnabled)
      throw aiError(
        "AI_PAUSED",
        "AI is paused. Manual entry remains available.",
      );
    const body = {
      ...payload,
      model,
      store: false,
      reasoning: {effort: "minimal"},
      max_output_tokens: verified.maxOutputTokens,
    };
    const ceilingMicrousd = estimateMicrousd(
      {
        inputTokens: verified.maxInputTokens,
        outputTokens: verified.maxOutputTokens,
      },
      verified,
    );
    const reservationId = await reserve(repository, {
      requestId: input.requestId,
      sessionId: input.sessionId,
      idempotencyKey: input.idempotencyKey,
      payloadHmac: await payloadDigest(env.SESSION_HMAC_SECRET, {
        operation,
        body,
      }),
      operation,
      model,
      ceilingMicrousd,
      utcDay: new Date(clock()).toISOString().slice(0, 10),
      pricingVersion: verified.version,
    });
    let generated = false,
      settled = false,
      recorded = false;
    const started = clock();
    let usage, estimatedMicrousd;
    try {
      await repository.recordJob({
        id: input.requestId,
        sessionId: input.sessionId,
        operation,
        model,
        status: "running",
        ...(mode ? { mode } : {}),
        ...(country ? { country } : {}),
      });
      recorded = true;
      const preflight = await requestJson(
        endpoint + "/input_tokens",
        {
          model,
          input: body.input,
          instructions: body.instructions,
          text: body.text,
          reasoning: body.reasoning,
        },
        10000,
      );
      const measured = integer.positive().safeParse(preflight.input_tokens);
      if (!measured.success)
        throw aiError(
          "PREFLIGHT_UNVERIFIED",
          "The provider input count could not be verified. No generation was requested.",
          502,
        );
      if (measured.data > verified.maxInputTokens)
        throw aiError(
          "INPUT_TOO_LARGE",
          "This document or conversation exceeds the small-budget input limit. Use a shorter document or manual entry.",
          413,
        );
      // Recheck pause after preflight. The ledger already reserved the maximum.
      if (!(await repository.getSettings()).aiEnabled)
        throw aiError(
          "AI_PAUSED",
          "AI was paused before generation. No generation was requested.",
        );
      generated = true;
      const result = await requestJson(endpoint, body);
      usage = validatedUsage(result.usage, verified, measured.data);
      estimatedMicrousd = estimateMicrousd(usage, verified);
      await repository.settleAiCall({
        reservationId,
        status: "succeeded",
        tokens: usage,
        estimatedMicrousd,
      });
      settled = true;
      if (result.status !== "completed")
        throw aiError(
          "MODEL_INCOMPLETE",
          "The model response was incomplete. Enter the missing facts manually.",
          502,
        );
      if (
        !Array.isArray(result.output) ||
        result.output.some(
          (item) => !["message", "reasoning"].includes(item.type),
        )
      )
        throw aiError(
          "MODEL_OUTPUT_INVALID",
          "The model returned an unsupported response. Use manual entry.",
          502,
        );
      const text = result.output
        .filter((item) => item.type === "message")
        .flatMap((item) => item.content || [])
        .filter((item) => item.type === "output_text")
        .map((item) => item.text)
        .join("");
      if (!text || text.length > 30000)
        throw aiError(
          "MODEL_OUTPUT_INVALID",
          "The model output could not be verified. Use manual entry.",
          502,
        );
      const parsed = parse(text);
      await repository.finishJob({
        id: input.requestId,
        status: "succeeded",
        durationMs: Math.max(0, clock() - started),
        tokens: usage,
        estimatedMicrousd,
      });
      return {
        ...parsed,
        usage: {
          ...usage,
          estimatedMicrousd,
          pricingVersion: verified.version,
        },
      };
    } catch (error) {
      const known =
        typeof error?.code === "string" && Number.isInteger(error?.status);
      const safe = known
        ? error
        : aiError(
            "STORAGE_UNAVAILABLE",
            "Processing records could not be completed. Use manual entry; the request was not automatically retried.",
          );
      if (!settled) {
        try {
          await repository.settleAiCall({
            reservationId,
            status: generated ? "billing_unknown" : "failed_before_send",
          });
        } catch {
          /* Retain the original running reservation on failure. */
        }
        if (generated) await pause();
      }
      if (recorded) {
        try {
          await repository.finishJob({
            id: input.requestId,
            status: generated && !settled ? "billing_unknown" : "failed",
            errorCode: safe.code,
            durationMs: Math.max(0, clock() - started),
            ...(settled ? { tokens: usage, estimatedMicrousd } : {}),
          });
        } catch {}
      }
      throw safe;
    }
  }
  return {
    capabilities,
    async extract(input) {
      configuration();
      identity.parse(input);
      if (input.consent !== true)
        throw aiError(
          "CONSENT_REQUIRED",
          "Confirm document processing before sending your bill.",
          400,
        );
      let checked;
      try {
        checked = await validateFile(input.file);
      } catch {
        throw aiError(
          "UNSUPPORTED_MEDIA",
          "Choose a readable PNG, JPEG, WebP or unencrypted PDF up to 6 MB and ten pages.",
          400,
        );
      }
      return perform({
        operation: "extract",
        input,
        payload: createExtractionPayload(checked),
        parse(text) {
          try {
            return parseExtraction(text, checked, model);
          } catch {
            throw aiError(
              "MODEL_OUTPUT_INVALID",
              "Invoice extraction could not be verified. Enter the facts manually.",
              502,
            );
          }
        },
      });
    },
    async chat(input) {
      configuration();
      identity.parse(input);
      const value = chatRequest.parse({
        purpose: input.purpose,
        facts: input.facts,
        history: input.history,
      });
      const pack = createChatPayload(value);
      return perform({
        operation: "chat",
        input,
        payload: pack.body,
        mode: value.facts.mode,
        country: value.facts.country,
        parse: (text) => ({
          ...parseChatResult(text, { purpose: value.purpose, ...pack }),
          provider: "Meta Model API",
          model,
          confirmed: false,
        }),
      });
    },
  };
}
