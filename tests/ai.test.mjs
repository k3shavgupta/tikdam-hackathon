import test from "node:test";
import {readFile} from "node:fs/promises";
import assert from "node:assert/strict";
import { createAiService } from "../server/ai/service.mjs";
import { createChatPayload, parseChatResult } from "../server/ai/schemas.mjs";
import { verifiedPricing } from "../server/ai/pricing.mjs";
import { classifyChatTopic } from "../server/ai/topics.mjs";

test('chat topics use fixed labels without retaining a question or identifier', () => {
  const input={purpose:'intake',facts:{mode:'before'},history:[{role:'user',content:'Is seller GSTIN 22ABCDE1234F1Z5 valid?'}]};
  assert.equal(classifyChatTopic(input),'seller_verification');
  assert.equal(classifyChatTopic({...input,purpose:'explain'}),'result_explanation');
  assert.equal(classifyChatTopic({...input,history:[{role:'user',content:'A private name and number 12345'}]}),'other');
  assert.equal(JSON.stringify(classifyChatTopic(input)).includes('22ABCDE'),false);
});

test("client explanation cannot select purchase VAT guidance", () => {
  const pack = createChatPayload({
    purpose: "explain",
    facts: { mode: "client", country: "GB", businessCountry: "GB", amountReceived: "100", withheld: "20", gross: "120", currency: "GBP" },
    history: [{ role: "user", content: "What caused the client payment gap?" }],
  });
  assert.equal(Object.hasOwn(pack.explanations, "route"), false);
  assert.deepEqual(pack.sources.map((source) => source.id), ["gb-client-1"]);
  assert.throws(() => parseChatResult(JSON.stringify({ explanationIds: ["route"], sourceIds: ["gb-client-1"] }), { purpose: "explain", ...pack }));
  const answer = parseChatResult(JSON.stringify({ explanationIds: ["evidence"], sourceIds: ["gb-client-1"] }), { purpose: "explain", ...pack });
  assert.match(answer.message, /No numerical benefit is determined/);
  assert.doesNotMatch(answer.message, /VAT-registered businesses/);
});

test("source-free countries get general explanations without invented local authority links", () => {
  const pack = createChatPayload({
    purpose: "explain",
    facts: { mode: "purchase", country: "FR", businessCountry: "FR", currency: "EUR", item: "Laptop", category: "equipment" },
    history: [{ role: "user", content: "What evidence do I need?" }],
  });
  assert.deepEqual(pack.sources, []);
  assert.equal(pack.body.input[0].content[0].text.includes('"localSourcesReviewed":false'), true);
  const answer = parseChatResult(JSON.stringify({ explanationIds: ["evidence"], sourceIds: [] }), { purpose: "explain", ...pack });
  assert.match(answer.message, /No numerical benefit is determined/);
  assert.match(answer.message, /not reviewed local tax rules or official sources/);
  assert.deepEqual(answer.sourceIds, []);
  assert.throws(() => parseChatResult(JSON.stringify({ explanationIds: ["result"], sourceIds: ["fr-1"] }), { purpose: "explain", ...pack }));
});

test("purchase intake ignores client-payment clarification fields", () => {
  const pack = createChatPayload({
    purpose: "intake",
    facts: { mode: "before", country: "FR", businessCountry: "FR", item: "Laptop" },
    history: [{ role: "user", content: "What should I prepare before buying?" }],
  });
  const answer = parseChatResult(JSON.stringify({
    question: "Where is the income recipient tax resident?",
    proposals: [],
    missingFields: ["taxResidence", "workCountry", "item"],
    sourceIds: [],
  }), { purpose: "intake", ...pack });
  assert.equal(answer.message, "What are you buying or providing, and how does it support your work?");
  assert.deepEqual(answer.missingFields, ["item"]);
  assert.deepEqual(answer.sourceIds, []);
});

const now = () => Date.parse("2026-11-01T12:00:00Z");
const env = {
  AI_ENABLED: "true",
  AI_EXTRACTION_ENABLED: "true",
  META_MODEL_API_KEY: "synthetic-key",
  SESSION_HMAC_SECRET: "synthetic-private-hmac-secret-over-32-bytes",
  TURNSTILE_SITE_KEY: "public-test",
  TURNSTILE_SECRET_KEY: "private-test",
};
const facts = { mode: "before", country: "IN", businessCountry: "IN" };
const intake = {
  question: "What will you use the purchase for?",
  proposals: [{ field: "item", value: "Stationery" }],
  missingFields: ["item"],
  sourceIds: ["in-1"],
};
function fixture({
  reply = intake,
  usage = { input_tokens: 100, output_tokens: 30, total_tokens: 130 },
  count = 200,
  reserveReason,
  fetchError,
  settings = true,
  pricing = verifiedPricing,
} = {}) {
  const calls = [],
    settlements = [],
    jobs = [],
    settingsChanges = [];
  const repo = {
    getSettings: async () => ({ aiEnabled: settings }),
    reserveAiCall: async (x) => {
      calls.push(["reserve", x]);
      return reserveReason
        ? { admitted: false, reason: reserveReason }
        : { admitted: true, reservationId: x.requestId };
    },
    settleAiCall: async (x) => settlements.push(x),
    recordJob: async (x) => jobs.push(x),
    finishJob: async (x) => jobs.push(x),
    updateSettings: async (x) => settingsChanges.push(x),
  };
  const fetchImpl = async (url, opts) => {
    calls.push([url, JSON.parse(opts.body)]);
    if (fetchError) throw Error("secret upstream failure");
    if (url.endsWith("/input_tokens"))
      return Response.json({
        object: "response.input_tokens",
        input_tokens: count,
      });
    return Response.json({
      status: "completed",
      usage,
      output: [
        {
          type: "message",
          content: [{ type: "output_text", text: JSON.stringify(reply) }],
        },
      ],
    });
  };
  const service = createAiService({
    env,
    repository: repo,
    fetchImpl,
    clock: now,
    pricing,
  });
  const request = {
    sessionId: crypto.randomUUID(),
    idempotencyKey: crypto.randomUUID(),
    requestId: crypto.randomUUID(),
    purpose: "intake",
    facts,
    history: [{ role: "user", content: "I need stationery" }],
  };
  return { service, request, calls, settlements, jobs, settingsChanges, repo };
}
test("AI reserves before token preflight and generation, validates proposals and settles actual usage", async () => {
  const f = fixture();
  const r = await f.service.chat(f.request);
  assert.equal(f.calls[0][0], "reserve");
  assert.equal(f.calls[0][1].ceilingMicrousd, 30100);
  assert.match(f.calls[0][1].payloadHmac, /^[a-f0-9]{64}$/);
  assert.match(f.calls[1][0], /responses\/input_tokens$/);
  assert.match(f.calls[2][0], /responses$/);
  assert.equal(f.calls[2][1].max_output_tokens, 1200);
  assert.equal(f.calls[2][1].store, false);
  assert.equal(f.calls[2][1].tools, undefined);
  assert.deepEqual(r.proposals, { item: "Stationery" });
  assert.equal(r.confirmed, false);
  assert.equal(f.settlements[0].status, "succeeded");
  assert.equal(f.settlements[0].estimatedMicrousd, 253);
  assert.equal(f.jobs.at(-1).status, "succeeded");
});
test("paused or denied budget and idempotency paths never reach provider", async () => {
  for (const reason of [
    "AI_PAUSED",
    "BUDGET_EXHAUSTED",
    "DAILY_LIMIT",
    "IN_FLIGHT",
    "ALREADY_PROCESSED",
    "IDEMPOTENCY_CONFLICT",
  ]) {
    const f = fixture({ reserveReason: reason });
    await assert.rejects(
      () => f.service.chat(f.request),
      (e) => e.code === reason,
    );
    assert.equal(f.calls.filter((x) => x[0] !== "reserve").length, 0);
  }
  const f = fixture({ settings: false });
  await assert.rejects(
    () => f.service.chat(f.request),
    (e) => e.code === "AI_PAUSED",
  );
  assert.equal(f.calls.length, 0);
});
test("chat can be available while invoice extraction remains paused", async () => {
  const f = fixture();
  const service = createAiService({
    env: { ...env, AI_EXTRACTION_ENABLED: "false" },
    repository: f.repo,
    clock: now,
    fetchImpl: async () => { throw Error("provider must not be called"); },
  });
  assert.deepEqual(await service.capabilities(), {
    enabled: true,
    chatAvailable: true,
    extractionAvailable: false,
    reason: null,
  });
  await assert.rejects(() => service.extract({}), (error) => error.code === "AI_PAUSED");
  assert.equal(f.calls.length, 0);
});
test("missing pricing or database controls fail closed", async () => {
  const f = fixture({ pricing: {} });
  assert.equal((await f.service.capabilities()).enabled, false);
  await assert.rejects(
    () => f.service.chat(f.request),
    (e) => e.code === "PRICING_UNVERIFIED",
  );
  assert.equal(f.calls.length, 0);
  const g = fixture();
  g.repo.reserveAiCall = async () => {
    throw Error("database details");
  };
  await assert.rejects(
    () => g.service.chat(g.request),
    (e) => e.code === "STORAGE_UNAVAILABLE",
  );
  assert.equal(g.calls.length, 0);
});
test("oversized preflight never generates and releases only before-send reservation", async () => {
  const f = fixture({ count: 20001 });
  await assert.rejects(
    () => f.service.chat(f.request),
    (e) => e.code === "INPUT_TOO_LARGE",
  );
  assert.equal(f.calls.length, 2);
  assert.equal(f.settlements[0].status, "failed_before_send");
});
test("missing or out-of-bounds usage retains billing reservation and pauses AI", async () => {
  for (const usage of [
    null,
    { input_tokens: 201, output_tokens: 1 },
    { input_tokens: 100, output_tokens: 1201 },
  ]) {
    const f = fixture({ usage });
    await assert.rejects(
      () => f.service.chat(f.request),
      (e) => e.code === "USAGE_UNVERIFIED",
    );
    assert.equal(f.settlements[0].status, "billing_unknown");
    assert.equal(f.settingsChanges[0].patch.aiEnabled, false);
  }
});
test("network timeout after generation has unknown billing and is never retried", async () => {
  const f = fixture();
  let n = 0;
  f.repo.getSettings = async () => ({ aiEnabled: true });
  const service = createAiService({
    env,
    repository: f.repo,
    clock: now,
    fetchImpl: async () => {
      n++;
      if (n === 1) return Response.json({ input_tokens: 100 });
      throw Error("upstream private details");
    },
  });
  await assert.rejects(
    () => service.chat(f.request),
    (e) => e.code === "PROVIDER_UNAVAILABLE" && !e.message.includes("private"),
  );
  assert.equal(n, 2);
  assert.equal(f.settlements[0].status, "billing_unknown");
});
test("model statutory confirmation, unknown sources, numbers and arbitrary URLs are rejected after usage settlement", async () => {
  for (const reply of [
    { ...intake, proposals: [{ field: "indiaChecks", value: "yes" }] },
    { ...intake, sourceIds: ["invented"] },
    { ...intake, question: "You can claim 500 rupees?" },
    { ...intake, question: "Visit https://evil.test?" },
  ]) {
    const f = fixture({ reply });
    await assert.rejects(
      () => f.service.chat(f.request),
      (e) => e.code === "MODEL_OUTPUT_INVALID",
    );
    assert.equal(f.settlements[0].status, "succeeded");
    assert.equal(f.jobs.at(-1).status, "failed");
  }
});
test("explanations render only selected server text and source IDs", async () => {
  const f = fixture({
    reply: { explanationIds: ["route"], sourceIds: ["in-1"] },
  });
  const r = await f.service.chat({ ...f.request, purpose: "explain" });
  assert.match(r.message, /GSTR-2B/);
  assert.match(r.message, /not verified tax-authority/);
  assert.deepEqual(r.proposals, {});
});
test("schema rejects oversized history and unsupported private proposals without provider calls", async () => {
  const f = fixture();
  await assert.rejects(() =>
    f.service.chat({
      ...f.request,
      history: [{ role: "user", content: "x".repeat(1001) }],
    }),
  );
  assert.equal(f.calls.length, 0);
});
test("consented image extraction uses the same ledger and never confirms facts", async () => {
  const extraction = {
    invoiceNumber: "INV-1",
    invoiceDate: null,
    supplierName: "Example shop",
    supplierTaxId: null,
    buyerName: null,
    country: "GB",
    currency: "GBP",
    item: "Paper",
    net: "100",
    tax: "20",
    gross: "120",
    amountReceived: null,
    withheld: null,
    documentType: "invoice",
    confidence: "medium",
    uncertainties: ["Buyer needs confirmation"],
  };
  const f = fixture({ reply: extraction });
  const r = await f.service.extract({
    ...f.request,
    consent: true,
    file: {
      name: "private-file-name.png",
      data: "data:image/png;base64,"+(await readFile(new URL("./fixtures/evaluation/fictional-invoice.png",import.meta.url))).toString("base64"),
    },
  });
  assert.equal(r.fields.tax, "20");
  assert.equal(r.confirmed, false);
  assert.equal(r.fields.indiaChecks, undefined);
  assert.equal(f.settlements[0].status, "succeeded");
  assert.equal(JSON.stringify(f.calls[0]).includes("private-file-name"), false);
});
test("image consent and file-signature validation happen before reservation or provider call", async () => {
  const f = fixture();
  await assert.rejects(
    () => f.service.extract({ ...f.request, consent: false, file: {} }),
    (e) => e.code === "CONSENT_REQUIRED",
  );
  await assert.rejects(
    () =>
      f.service.extract({
        ...f.request,
        consent: true,
        file: { name: "x", data: "https://untrusted.test/file" },
      }),
    (e) => e.code === "UNSUPPORTED_MEDIA",
  );
  assert.equal(f.calls.length, 0);
});
test("rendered clarification cannot carry arbitrary prose even when it passes a word filter", async () => {
  const f = fixture({
    reply: {
      ...intake,
      question: "All business purchases qualify automatically?",
      missingFields: ["country"],
    },
  });
  const r = await f.service.chat(f.request);
  assert.equal(
    r.message,
    "Which country charged the tax or made the client payment?",
  );
  assert.equal(r.message.includes("automatically"), false);
});
test("incomplete provider output still accounts for usage but cannot become facts", async () => {
  const f = fixture();
  let n = 0;
  const service = createAiService({
    env,
    repository: f.repo,
    clock: now,
    fetchImpl: async () =>
      ++n === 1
        ? Response.json({ input_tokens: 200 })
        : Response.json({
            status: "incomplete",
            usage: { input_tokens: 100, output_tokens: 30 },
            output: [],
          }),
  });
  await assert.rejects(
    () => service.chat(f.request),
    (e) => e.code === "MODEL_INCOMPLETE",
  );
  assert.equal(f.settlements[0].status, "succeeded");
  assert.equal(f.jobs.at(-1).status, "failed");
});
test("stale price evidence disables capabilities without contacting a provider", async () => {
  const f = fixture({ pricing: { ...verifiedPricing, checked: "2026-08-01" } });
  assert.equal((await f.service.capabilities()).enabled, false);
  await assert.rejects(
    () => f.service.chat(f.request),
    (e) => e.code === "PRICING_STALE",
  );
  assert.equal(f.calls.length, 0);
});

test('small-budget AI requests explicitly choose minimal reasoning for both count and generation',async()=>{
 const f=fixture();await f.service.chat(f.request);
 assert.deepEqual(f.calls[1][1].reasoning,{effort:'minimal'});
 assert.deepEqual(f.calls[2][1].reasoning,{effort:'minimal'});
});

function basetenFixture({response, code=200, customEnv={}}={}) {
 const f=fixture(); const sends=[];
 const service=createAiService({env:{...env,AI_PROVIDER:'baseten',BASETEN_API_KEY:'synthetic-baseten',...customEnv},repository:f.repo,clock:()=>Date.parse('2026-11-03T12:00:00Z'),fetchImpl:async(url,options)=>{
  sends.push({url,body:JSON.parse(options.body),headers:options.headers});
  assert.equal(f.calls[0][0],'reserve');
  return Response.json(response??{choices:[{finish_reason:'stop',message:{content:JSON.stringify(intake)}}],usage:{prompt_tokens:500,completion_tokens:60,total_tokens:560}},{status:code});
 }});
 return {...f,service,sends};
}
test('Baseten chat uses hackathon model, distinct secret, one request and the existing spending ledger',async()=>{
 const f=basetenFixture();const r=await f.service.chat(f.request);
 assert.equal(f.sends.length,1);assert.equal(f.sends[0].url,'https://inference.baseten.co/v1/chat/completions');
 assert.equal(f.sends[0].headers.Authorization,'Bearer synthetic-baseten');assert.equal(f.sends[0].body.model,'meta-models/muse-spark-open-1026');
 assert.equal(f.sends[0].body.max_tokens,1200);assert.equal(f.sends[0].body.tools,undefined);
 assert.equal(f.calls[0][1].ceilingMicrousd,30100);assert.equal(f.calls[0][1].model,r.model);
 assert.equal(r.provider,'Baseten');assert.equal(r.confirmed,false);assert.deepEqual(r.proposals,{item:'Stationery'});
 assert.equal(f.settlements[0].estimatedMicrousd,880);assert.equal(f.jobs.at(-1).status,'succeeded');
 assert.equal((await f.service.capabilities()).extractionAvailable,false);
 await assert.rejects(()=>f.service.extract({}),e=>e.code==='AI_PAUSED');assert.equal(f.sends.length,1);
});
test('Baseten rejection retains allowance, pauses and never falls back to Meta',async()=>{
 const f=basetenFixture({code:403,response:{error:'private-key-error'}});
 await assert.rejects(()=>f.service.chat(f.request),e=>e.code==='PROVIDER_AUTH_REJECTED'&&!e.message.includes('private-key'));
 assert.equal(f.sends.length,1);assert.equal(f.settlements[0].status,'billing_unknown');assert.equal(f.settingsChanges[0].patch.aiEnabled,false);
});
test('Baseten incomplete, unsafe JSON and tool outputs are charged but never accepted',async()=>{
 for(const choice of [
  {finish_reason:'length',message:{content:JSON.stringify(intake)}},
  {finish_reason:'stop',message:{content:'{"eligible":true}'}},
  {finish_reason:'stop',message:{content:JSON.stringify(intake),tool_calls:[{id:'not-allowed'}]}},
  {finish_reason:'stop',message:{content:JSON.stringify(intake),refusal:'refused'}},
 ]){
  const f=basetenFixture({response:{choices:[choice],usage:{prompt_tokens:500,completion_tokens:60,total_tokens:560}}});
  await assert.rejects(()=>f.service.chat(f.request),e=>['MODEL_INCOMPLETE','MODEL_OUTPUT_INVALID'].includes(e.code));
  assert.equal(f.settlements[0].status,'succeeded');assert.equal(f.sends.length,1);
 }
});
test('Baseten missing or excessive usage holds allowance and pauses',async()=>{
 for(const usage of [undefined,{prompt_tokens:20001,completion_tokens:1},{prompt_tokens:500,completion_tokens:1201}]){
  const f=basetenFixture({response:{choices:[{finish_reason:'stop',message:{content:JSON.stringify(intake)}}],usage}});
  await assert.rejects(()=>f.service.chat(f.request),e=>e.code==='USAGE_UNVERIFIED');assert.equal(f.settlements[0].status,'billing_unknown');assert.equal(f.settingsChanges[0].patch.aiEnabled,false);
 }
});
test('Baseten oversized UTF-8 conversation is rejected before reservation or traffic',async()=>{
 const f=basetenFixture();
 await assert.rejects(()=>f.service.chat({...f.request,history:Array.from({length:8},()=>({role:'user',content:'界'.repeat(1000)}))}),e=>e.code==='INPUT_TOO_LARGE');
 assert.equal(f.sends.length,0);assert.equal(f.calls.length,0);
});
test('Baseten wrong model, missing key, unknown provider and mismatched price fail closed',async()=>{
 for(const customEnv of [{BASETEN_MODEL:'meta-models/muse-spark-open'},{BASETEN_API_KEY:''},{AI_PROVIDER:'untrusted'}]){
  const f=basetenFixture({customEnv});assert.equal((await f.service.capabilities()).chatAvailable,false);
  await assert.rejects(()=>f.service.chat(f.request),e=>e.code==='MODEL_NOT_CONFIGURED');assert.equal(f.sends.length,0);
 }
 const f=fixture();const service=createAiService({env:{...env,AI_PROVIDER:'baseten',BASETEN_API_KEY:'test'},repository:f.repo,pricing:verifiedPricing,clock:()=>Date.parse('2026-11-03T12:00:00Z')});
 assert.equal((await service.capabilities()).chatAvailable,false);
});
