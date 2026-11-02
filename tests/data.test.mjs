import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import { createRepository } from "../server/data/repository.mjs";

let fixture;
test.before(async () => {
  fixture = new Miniflare(
    convertV4MiniflareOptions({
      modules: true,
      script: 'export default {fetch(){return new Response("test")}}',
      d1Databases: ["DB"],
      compatibilityDate: "2026-10-30",
    }),
  );
});
test.after(async () => {
  await fixture?.dispose();
});
let serial = 0;
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
    await db.prepare(`DROP TABLE IF EXISTS "${name}"`).run();
  const sql = await readFile(
    new URL("../migrations/0001_operations.sql", import.meta.url),
    "utf8",
  );
  const migrate = async () =>
    db.batch(
      sql
        .split(";")
        .map((x) => x.trim())
        .filter(Boolean)
        .map((x) => db.prepare(x)),
    );
  await migrate();
  let now = Date.parse("2026-11-01T10:00:00Z");
  const repository = createRepository(db, { clock: () => now });
  return { db, repository, migrate, advance: (ms) => (now += ms) };
}
const actor = "verified-owner";
const tokenUsage = { inputTokens: 100, outputTokens: 20 };
function call(extra = {}) {
  const id = crypto.randomUUID();
  return {
    requestId: id,
    sessionId: "session-a",
    idempotencyKey: crypto.randomUUID(),
    payloadHmac: "a".repeat(64),
    operation: "chat",
    model: "verified-test-model",
    ceilingMicrousd: 150000,
    utcDay: "2026-11-01",
    pricingVersion: "test-v1",
    ...extra,
  };
}

test("migration is repeatable without resetting paused settings or retained allowance", async () => {
  const { repository: r, migrate } = await setup();
  assert.deepEqual(await r.getSettings(), {
    aiEnabled: false,
    campaignCapMicrousd: 5000000,
    dailyCapMicrousd: 1000000,
    dailyCallCap: 10,
    maxInFlight: 1,
  });
  assert.equal((await r.reserveAiCall(call())).reason, "AI_PAUSED");
  await r.updateSettings({
    actor,
    patch: { aiEnabled: true, campaignCapMicrousd: 900000 },
  });
  const admitted = await r.reserveAiCall(call());
  assert.equal(admitted.admitted, true);
  await r.settleAiCall({
    reservationId: admitted.reservationId,
    status: "succeeded",
    tokens: tokenUsage,
    estimatedMicrousd: 100000,
  });
  await migrate();
  assert.equal((await r.getSettings()).campaignCapMicrousd, 900000);
  assert.equal((await r.getOverview({})).usage.spentMicrousd, 100000);
});

test("concurrent D1 admissions reserve atomically and enforce idempotency and in-flight limits", async () => {
  const { repository: r } = await setup();
  await r.updateSettings({ actor, patch: { aiEnabled: true } });
  const requests = Array.from({ length: 12 }, () => call());
  const results = await Promise.all(requests.map((x) => r.reserveAiCall(x)));
  assert.equal(results.filter((x) => x.admitted).length, 1);
  const index = results.findIndex((x) => x.admitted);
  const reservation = results[index];
  assert.equal(
    (await r.reserveAiCall(requests[index])).reason,
    "ALREADY_PROCESSED",
  );
  assert.equal(
    (await r.reserveAiCall({ ...requests[index], payloadHmac: "b".repeat(64) }))
      .reason,
    "IDEMPOTENCY_CONFLICT",
  );
  await r.settleAiCall({
    reservationId: reservation.reservationId,
    status: "succeeded",
    tokens: tokenUsage,
    estimatedMicrousd: 80000,
  });
  await r.settleAiCall({
    reservationId: reservation.reservationId,
    status: "succeeded",
    tokens: tokenUsage,
    estimatedMicrousd: 80000,
  });
  assert.equal((await r.getOverview({})).usage.spentMicrousd, 80000);
});

test("near-cap race cannot spend the same remaining allowance twice", async () => {
  const { repository: r } = await setup();
  await r.updateSettings({
    actor,
    patch: {
      aiEnabled: true,
      campaignCapMicrousd: 250000,
      dailyCapMicrousd: 250000,
    },
  });
  const first = await r.reserveAiCall(call({ ceilingMicrousd: 100000 }));
  await r.settleAiCall({
    reservationId: first.reservationId,
    status: "succeeded",
    tokens: tokenUsage,
    estimatedMicrousd: 100000,
  });
  const race = await Promise.all([
    r.reserveAiCall(call()),
    r.reserveAiCall(call()),
  ]);
  assert.equal(race.filter((x) => x.admitted).length, 1);
  await r.settleAiCall({
    reservationId: race.find((x) => x.admitted).reservationId,
    status: "billing_unknown",
  });
  assert.equal(
    (await r.reserveAiCall(call({ ceilingMicrousd: 1 }))).admitted,
    false,
  );
  const usage = (await r.getOverview({})).usage;
  assert.equal(usage.spentMicrousd, 100000);
  assert.equal(usage.reservedMicrousd, 150000);
  assert.equal(usage.billingUnknown, 1);
});

test("unknown usage never releases a reservation and settlement cannot exceed the ceiling", async () => {
  const { repository: r } = await setup();
  await r.updateSettings({ actor, patch: { aiEnabled: true } });
  const admitted = await r.reserveAiCall(call());
  await assert.rejects(
    () =>
      r.settleAiCall({
        reservationId: admitted.reservationId,
        status: "succeeded",
        estimatedMicrousd: 10,
      }),
    /usage/i,
  );
  assert.equal((await r.getOverview({})).usage.reservedMicrousd, 150000);
  await assert.rejects(
    () =>
      r.settleAiCall({
        reservationId: admitted.reservationId,
        status: "succeeded",
        tokens: tokenUsage,
        estimatedMicrousd: 150001,
      }),
    /ceiling/i,
  );
  await r.settleAiCall({
    reservationId: admitted.reservationId,
    status: "billing_unknown",
  });
  await assert.rejects(
    () =>
      r.settleAiCall({
        reservationId: admitted.reservationId,
        status: "failed_before_send",
      }),
    /settled/i,
  );
});

test("campaign allowance survives midnight, purge, cleanup and stale supplied days are rejected", async () => {
  const { repository: r, advance } = await setup();
  await r.updateSettings({
    actor,
    patch: {
      aiEnabled: true,
      campaignCapMicrousd: 200000,
      dailyCapMicrousd: 200000,
    },
  });
  const admitted = await r.reserveAiCall(call());
  await r.settleAiCall({
    reservationId: admitted.reservationId,
    status: "succeeded",
    tokens: tokenUsage,
    estimatedMicrousd: 150000,
  });
  for (const kind of ["jobs", "events", "feedback"])
    await r.purge({ actor, kind, confirm: "DELETE" });
  advance(100 * 86400000);
  await r.cleanup();
  assert.equal((await r.getOverview({})).usage.spentMicrousd, 150000);
  await assert.rejects(() => r.reserveAiCall(call()), /day/i);
  assert.equal(
    (
      await r.reserveAiCall(
        call({ utcDay: "2027-02-09", ceilingMicrousd: 60000 }),
      )
    ).admitted,
    false,
  );
});

test("strict caps and daily call counts persist and cannot be raised or cleared by settings", async () => {
  const { repository: r } = await setup();
  await r.updateSettings({
    actor,
    patch: { aiEnabled: true, dailyCallCap: 1 },
  });
  const first = await r.reserveAiCall(call());
  await r.settleAiCall({
    reservationId: first.reservationId,
    status: "failed_before_send",
  });
  assert.equal((await r.reserveAiCall(call())).reason, "DAILY_LIMIT");
  await assert.rejects(
    () => r.updateSettings({ actor, patch: { dailyCallCap: 2 } }),
    /increase/i,
  );
  await assert.rejects(() =>
    r.updateSettings({ actor, patch: { campaignCapMicrousd: 5000001 } }),
  );
  await assert.rejects(() =>
    r.updateSettings({ actor, patch: { reset: true } }),
  );
});

test("sessions expire, event IDs deduplicate, and unsafe metadata fails validation", async () => {
  const { repository: r, db, advance } = await setup();
  const id = crypto.randomUUID();
  await r.createSession({ id, expiresAt: "2026-11-01T22:00:00.000Z" });
  assert.ok(await r.getSession(id));
  const event = {
    id: crypto.randomUUID(),
    sessionId: id,
    event: "workflow_started",
    mode: "purchase",
    country: "IN",
  };
  await r.recordEvent(event);
  await r.recordEvent(event);
  assert.equal((await r.getOverview({})).totals.started, 1);
  await assert.rejects(() =>
    r.recordEvent({ ...event, invoiceNumber: "PRIVATE-CANARY" }),
  );
  await assert.rejects(() =>
    r.recordJob({
      id: crypto.randomUUID(),
      sessionId: id,
      operation: "extract",
      mode: "purchase",
      country: "IN",
      status: "running",
      fileName: "PRIVATE-CANARY",
    }),
  );
  const rows = await db.prepare("SELECT * FROM events").all();
  assert.equal(JSON.stringify(rows).includes("PRIVATE-CANARY"), false);
  advance(13 * 3600000);
  assert.equal(await r.getSession(id), null);
});

test("shared throttles count concurrent attempts atomically without keeping raw client addresses", async () => {
  const { repository: r } = await setup();
  const results = await Promise.all(
    Array.from({ length: 10 }, () =>
      r.consumeThrottle({
        key: "digest:" + "c".repeat(64),
        limit: 3,
        windowSeconds: 60,
      }),
    ),
  );
  assert.equal(results.filter((x) => x.allowed).length, 3);
  await assert.rejects(() =>
    r.consumeThrottle({ key: "192.168.1.10", limit: 3, windowSeconds: 60 }),
  );
});

test("job lists filter safely, enforce pagination and never expose invoice data", async () => {
  const { repository: r } = await setup();
  const id = crypto.randomUUID();
  await r.recordJob({
    id,
    sessionId: "opaque-session",
    operation: "assess",
    mode: "purchase",
    country: "GB",
    status: "running",
  });
  await r.finishJob({ id, status: "succeeded", durationMs: 12 });
  const jobs = await r.listJobs({ country: "GB", limit: 10 });
  assert.equal(jobs.total, 1);
  assert.equal(jobs.items[0].status, "succeeded");
  assert.equal((await r.getOverview({})).totals.completed, 1);
  await assert.rejects(() => r.listJobs({ limit: 1000 }));
  await assert.rejects(() => r.listJobs({ country: "GB' OR 1=1" }));
});

test("overview pricing versions come from the all-time ledger and jobs expose only their recorded version", async () => {
  const { repository: r } = await setup();
  await r.updateSettings({ actor, patch: { aiEnabled: true } });
  const requests = [
    call({ pricingVersion: "verified-price-v2" }),
    call({ pricingVersion: "verified-price-v1" }),
    call({ pricingVersion: "verified-price-v2" }),
  ];
  for (const request of requests) {
    const reservation = await r.reserveAiCall(request);
    assert.equal(reservation.admitted, true);
    await r.settleAiCall({ reservationId: reservation.reservationId, status: "succeeded", tokens: tokenUsage, estimatedMicrousd: 100 });
    await r.recordJob({ id: request.requestId, sessionId: request.sessionId, operation: "chat", model: request.model, status: "running" });
    await r.finishJob({ id: request.requestId, status: "succeeded", tokens: tokenUsage, estimatedMicrousd: 100 });
  }
  const manualId = crypto.randomUUID();
  await r.recordJob({ id: manualId, operation: "plan", status: "running" });
  await r.finishJob({ id: manualId, status: "succeeded" });
  // This date filter excludes the jobs, but cannot hide retained campaign costs
  // or change the price versions used for the all-time spending total.
  const overview = await r.getOverview({ from: "2026-11-02", to: "2026-11-03" });
  assert.equal(overview.usage.scope, "campaign_all_time");
  assert.deepEqual(overview.usage.pricingVersions, ["verified-price-v1", "verified-price-v2"]);
  assert.equal(overview.usage.spentMicrousd, 300);
  assert.equal(overview.totals.completed, 0);
  const jobs = await r.listJobs({ limit: 10 });
  for (const request of requests) {
    assert.equal(jobs.items.find(job => job.id === request.requestId).pricingVersion, request.pricingVersion);
  }
  assert.equal(jobs.items.find(job => job.id === manualId).pricingVersion, null);
  await assert.rejects(() => r.recordJob({ id: crypto.randomUUID(), operation: "chat", status: "running", pricingVersion: "CLIENT-PRIVATE-CANARY" }));
  assert.equal(JSON.stringify({overview,jobs}).includes("CLIENT-PRIVATE-CANARY"), false);
  assert.equal(JSON.stringify(jobs).includes("payloadHmac"), false);
});

test("five-dollar campaign race remains bounded across multiple UTC days and independent repository instances", async () => {
  const { repository: r, db, advance } = await setup();
  await r.updateSettings({ actor, patch: { aiEnabled: true } });
  for (let day = 1; day <= 5; day++) {
    const cost = day === 5 ? 800000 : 1000000;
    const v = await r.reserveAiCall(
      call({ utcDay: `2026-11-0${day}`, ceilingMicrousd: cost }),
    );
    assert.equal(v.admitted, true);
    await r.settleAiCall({
      reservationId: v.reservationId,
      status: "succeeded",
      tokens: tokenUsage,
      estimatedMicrousd: cost,
    });
    if (day < 5) advance(86400000);
  }
  const other = createRepository(db, {
    clock: () => Date.parse("2026-11-05T10:00:00Z"),
  });
  const results = await Promise.all([
    r.reserveAiCall(call({ utcDay: "2026-11-05" })),
    other.reserveAiCall(call({ utcDay: "2026-11-05" })),
  ]);
  assert.equal(results.filter((x) => x.admitted).length, 1);
  const u = (await r.getOverview({})).usage;
  assert.equal(u.spentMicrousd, 4800000);
  assert.equal(u.reservedMicrousd, 150000);
  assert.equal(u.remainingMicrousd, 50000);
});

test("retention deletes expired metadata and feedback but preserves cost and audit evidence", async () => {
  const { repository: r, db, advance } = await setup();
  await r.updateSettings({ actor, patch: { aiEnabled: true } });
  await r.addFeedback({
    id: crypto.randomUUID(),
    sessionId: "opaque-session",
    text: "Synthetic feedback only",
    mode: "before",
    country: "IN",
  });
  const jobId = crypto.randomUUID();
  await r.recordJob({
    id: jobId,
    operation: "plan",
    mode: "before",
    country: "IN",
    status: "running",
  });
  await r.finishJob({ id: jobId, status: "succeeded" });
  const reservation = await r.reserveAiCall(call());
  await r.settleAiCall({
    reservationId: reservation.reservationId,
    status: "billing_unknown",
  });
  advance(31 * 86400000);
  await r.cleanup();
  assert.equal((await r.listJobs({})).total, 0);
  assert.equal((await r.listFeedback({})).total, 1);
  advance(60 * 86400000);
  await r.cleanup();
  assert.equal((await r.listFeedback({})).total, 0);
  assert.equal((await r.getOverview({})).usage.reservedMicrousd, 150000);
  assert.ok(
    (await db.prepare("SELECT COUNT(*) n FROM admin_audit").first()).n > 0,
  );
});
