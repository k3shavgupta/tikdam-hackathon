import { z } from "zod";
import {
  validateFile,
  createExtractionPayload,
  parseExtraction,
} from "../meta.mjs";
import { chatRequest, createChatPayload, parseChatResult } from "./schemas.mjs";
import {
  verifiedPricing,
  verifiedBasetenPricing,
  validatePricing,
  estimateMicrousd,
  validatedUsage,
  aiError,
} from "./pricing.mjs";
import { payloadDigest, reserve } from "./budget.mjs";
import { providerInfo, BASETEN_MODEL } from './provider.mjs';
import { classifyChatTopic } from './topics.mjs';

const identity = z
  .object({
    sessionId: z.string().uuid(),
    requestId: z.string().uuid(),
    idempotencyKey: z.string().uuid(),
  })
  .strip();
const integer = z.number().int().safe().nonnegative();

export function createAiService({
  env = {},
  repository,
  fetchImpl = fetch,
  clock = () => Date.now(),
  pricing,
} = {}) {
  const {id: providerId, provider, model} = providerInfo(env);
  const baseten = providerId === 'baseten';
  const endpoint = baseten ? 'https://inference.baseten.co/v1/chat/completions' : 'https://api.meta.ai/v1/responses';
  const key = baseten ? env.BASETEN_API_KEY || '' : env.META_MODEL_API_KEY || env.MODEL_API_KEY || "";
  pricing ??= baseten ? verifiedBasetenPricing : verifiedPricing;
  function configuration() {
    if ((env.AI_PROVIDER && !['meta','baseten'].includes(env.AI_PROVIDER)) || (baseten && model !== BASETEN_MODEL))
      throw aiError('MODEL_NOT_CONFIGURED', 'The selected AI provider or model is not supported.');
    if (env.AI_ENABLED !== "true")
      throw aiError(
        "AI_PAUSED",
        "AI is paused to preserve credits. Manual entry and source-linked checks remain available.",
      );
    if (!key)
      throw aiError(
        "MODEL_NOT_CONFIGURED",
        `${provider} is not configured. Manual entry remains available.`,
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
        extractionAvailable: !baseten && env.AI_EXTRACTION_ENABLED === "true",
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
        // workerd supports manual or follow. Reject 3xx via response.ok below.
        redirect: 'manual',
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
        `${provider} did not respond. This request was not automatically retried.`,
        502,
      );
    }
    if (!response.ok)
      throw aiError(
        [401,403].includes(response.status)
          ? "PROVIDER_AUTH_REJECTED"
          : response.status === 429
            ? "PROVIDER_LIMIT"
            : "PROVIDER_UNAVAILABLE",
        `${provider} could not complete this operation. Use manual entry; the request was not automatically retried.`,
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
        `${provider} returned an unreadable response. Use manual entry.`,
        502,
      );
    }
  }
  async function perform({ operation, input, payload, parse, mode, country, topic }) {
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
    const body = baseten ? {
      model,
      max_tokens: verified.maxOutputTokens,
      reasoning_effort: 'low',
      messages: [
        {role: 'system', content: payload.instructions + ' Return only JSON matching the supplied schema. No markdown fences.'},
        {role: 'user', content: JSON.stringify({input: payload.input, jsonSchema: payload.text.format.schema})},
      ],
    } : {
      ...payload,
      model,
      store: false,
      reasoning: {effort: "minimal"},
      max_output_tokens: verified.maxOutputTokens,
    };
    // No media or arbitrary tools are accepted by the Baseten chat adapter.
    // The byte ceiling includes the entire rendered request and framing slack.
    if (baseten && new TextEncoder().encode(JSON.stringify(body)).length + 4096 > verified.maxInputTokens)
      throw aiError('INPUT_TOO_LARGE', 'This conversation exceeds the small-budget input limit. Use a shorter conversation.', 413);
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
        provider: providerId,
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
        ...(topic ? { topic } : {}),
        ...(mode ? { mode } : {}),
        ...(country ? { country } : {}),
      });
      recorded = true;
      const preflight = baseten ? {input_tokens: verified.maxInputTokens} : await requestJson(
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
      const upstream = await requestJson(endpoint, body);
      const choice = baseten ? upstream.choices?.[0] : null;
      const result = baseten ? {
        status: choice?.finish_reason === 'stop' ? 'completed' : 'incomplete',
        usage: {input_tokens: upstream.usage?.prompt_tokens, output_tokens: upstream.usage?.completion_tokens, total_tokens: upstream.usage?.total_tokens},
        output: upstream.choices?.length === 1 && !choice?.message?.tool_calls?.length && !choice?.message?.function_call && !choice?.message?.refusal
          ? [{type: 'message', content: [{type: 'output_text', text: typeof choice?.message?.content === 'string' ? choice.message.content : ''}]}]
          : [{type: 'unsupported'}],
      } : upstream;
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
      if (baseten || env.AI_EXTRACTION_ENABLED !== "true")
        throw aiError(
          "AI_PAUSED",
          "Invoice extraction is paused. Enter the invoice details manually.",
        );
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
        topic: classifyChatTopic(value),
        parse: (text) => ({
          ...parseChatResult(text, { purpose: value.purpose, ...pack }),
          provider,
          model,
          confirmed: false,
        }),
      });
    },
  };
}
