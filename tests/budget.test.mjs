import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import { createRepository } from "../server/data/repository.mjs";
import { createAiService } from "../server/ai/service.mjs";
import { payloadDigest } from "../server/ai/budget.mjs";

const env = {
  AI_ENABLED: "true",
  META_MODEL_API_KEY: "test-key-not-live",
  SESSION_HMAC_SECRET: "synthetic-secret-private-over-32-bytes",
  TURNSTILE_SITE_KEY: "test-site",
  TURNSTILE_SECRET_KEY: "test-secret",
};
const clock = () => Date.parse("2026-11-01T12:00:00Z");
const request = () => ({
  sessionId: crypto.randomUUID(),
  requestId: crypto.randomUUID(),
  idempotencyKey: crypto.randomUUID(),
  purpose: "intake",
  facts: {
    mode: "before",
    country: "IN",
    businessCountry: "IN",
    legalName: "PRIVACY_CANARY_PRIVATE_LEGAL_NAME",
  },
  history: [{ role: "user", content: "PRIVACY_CANARY_PRIVATE_MESSAGE" }],
});
const reply = {
  question: "How does this support your work?",
  proposals: [],
  missingFields: ["item"],
  sourceIds: [],
};
let fixture;
test.before(() => {
  fixture = new Miniflare(
    convertV4MiniflareOptions({
      modules: true,
      script: 'export default {fetch(){return new Response("test")}}',
      d1Databases: ["DB"],
      compatibilityDate: "2026-10-30",
    }),
  );
});
test.after(async () => fixture?.dispose());
async function setup() {
  const db = await fixture.getD1Database("DB");
  for (const name of [
    "settings",
    "sessions",
    "events",
    "jobs",
    "ai_reservations",
    "feedback",
    "throttles",
    "admin_audit",
  ])
    await db.prepare(`DROP TABLE IF EXISTS ${name}`).run();
  const sql = await readFile(
    new URL("../migrations/0001_operations.sql", import.meta.url),
    "utf8",
  );
  await db.batch(
    sql
      .split(";")
      .map((x) => x.trim())
      .filter(Boolean)
      .map((x) => db.prepare(x)),
  );
  const repository = createRepository(db, { clock });
  await repository.updateSettings({
    actor: "test-owner",
    patch: { aiEnabled: true },
  });
  return { db, repository };
}
function response() {
  return Response.json({
    status: "completed",
    usage: { input_tokens: 100, output_tokens: 30, total_tokens: 130 },
    output: [
      {
        type: "message",
        content: [{ type: "output_text", text: JSON.stringify(reply) }],
      },
    ],
  });
}

test("real D1 service admits only one simultaneous provider operation and prevents replay", async () => {
  const { db, repository } = await setup();
  let calls = 0;
  let release;
  const gate = new Promise((r) => (release = r));
  const fetchImpl = async (url) => {
    calls++;
    if (url.endsWith("/input_tokens"))
      return Response.json({ input_tokens: 200 });
    await gate;
    return response();
  };
  const service = createAiService({ env, repository, clock, fetchImpl });
  const first = request();
  const running = service.chat(first);
  // Wait for a DB row rather than sleeping. The first call is held by the fake provider.
  for (let i = 0; i < 100; i++) {
    if ((await db.prepare("SELECT COUNT(*) n FROM ai_reservations").first()).n)
      break;
    await new Promise((r) => setImmediate(r));
  }
  const denied = service.chat(request());
  await assert.rejects(
    () => denied,
    (e) => e.code === "IN_FLIGHT",
  );
  release();
  await running;
  assert.equal(calls, 2);
  await assert.rejects(
    () => service.chat(first),
    (e) => e.code === "ALREADY_PROCESSED",
  );
  assert.equal(calls, 2);
  await assert.rejects(
    () =>
      service.chat({
        ...first,
        history: [{ role: "user", content: "changed" }],
      }),
    (e) => e.code === "IDEMPOTENCY_CONFLICT",
  );
  assert.equal(calls, 2);
  const rows = await db
    .prepare("SELECT * FROM jobs UNION ALL SELECT * FROM jobs WHERE 0")
    .all();
  const ledger = await db.prepare("SELECT * FROM ai_reservations").all();
  assert.equal(
    JSON.stringify({ rows, ledger }).includes("PRIVACY_CANARY"),
    false,
  );
  assert.equal((await repository.getOverview()).usage.spentMicrousd, 253);
});
test("real D1 cap denial makes no token-count or generation call", async () => {
  const { repository } = await setup();
  await repository.updateSettings({
    actor: "test-owner",
    patch: { campaignCapMicrousd: 30000 },
  });
  let fetched = 0;
  const service = createAiService({
    env,
    repository,
    clock,
    fetchImpl: async () => {
      fetched++;
      throw Error();
    },
  });
  await assert.rejects(
    () => service.chat(request()),
    (e) => e.code === "BUDGET_EXHAUSTED",
  );
  assert.equal(fetched, 0);
});
test("unknown billing is retained and pauses real D1 without exposing provider bodies", async () => {
  const { repository } = await setup();
  let n = 0;
  const service = createAiService({
    env,
    repository,
    clock,
    fetchImpl: async () =>
      ++n === 1
        ? Response.json({ input_tokens: 100 })
        : Response.json({ status: "completed", usage: null, output: [] }),
  });
  await assert.rejects(
    () => service.chat(request()),
    (e) => e.code === "USAGE_UNVERIFIED",
  );
  const overview = await repository.getOverview();
  assert.equal(overview.settings.aiEnabled, false);
  assert.equal(overview.usage.reservedMicrousd, 30100);
  assert.equal(overview.usage.billingUnknown, 1);
  await repository.cleanup();
  await repository.purge({
    actor: "test-owner",
    kind: "jobs",
    confirm: "DELETE",
  });
  assert.equal((await repository.getOverview()).usage.reservedMicrousd, 30100);
});
test("payload HMAC is order-stable and secret-specific without a plain reusable document hash", async () => {
  const a = await payloadDigest(env.SESSION_HMAC_SECRET, { b: 2, a: 1 });
  assert.equal(a, await payloadDigest(env.SESSION_HMAC_SECRET, { a: 1, b: 2 }));
  assert.notEqual(
    a,
    await payloadDigest("another-private-secret-over-32-bytes", { a: 1, b: 2 }),
  );
});
