import { z } from "zod";
import {countryCodeSchema} from '../schema.mjs';
import {chatTopics} from '../ai/topics.mjs';

const countries = countryCodeSchema;
const modes = z.enum(["before", "purchase", "client"]);
const id = z
  .string()
  .min(8)
  .max(128)
  .regex(/^[A-Za-z0-9_-]+$/);
const uuid = z.string().uuid();
const actorSchema = z
  .string()
  .min(1)
  .max(256)
  .regex(/^[^\x00-\x1f\x7f]+$/);
const integer = z.number().int().safe().nonnegative();
const tokensSchema = z
  .object({ inputTokens: integer, outputTokens: integer })
  .strict();
const operations = z.enum(["plan", "assess", "extract", "chat"]);
const statuses = z.enum([
  "running",
  "succeeded",
  "failed",
  "billing_unknown",
  "blocked",
]);
const topicSchema = z.enum(chatTopics);
const safeName = z
  .string()
  .min(1)
  .max(120)
  .regex(/^[A-Za-z0-9._:/-]+$/);
const settingsSchema = z
  .object({
    aiEnabled: z.boolean().optional(),
    campaignCapMicrousd: integer.max(5000000).optional(),
    dailyCapMicrousd: integer.max(1000000).optional(),
    dailyCallCap: integer.min(1).max(10).optional(),
    maxInFlight: z.literal(1).optional(),
  })
  .strict()
  .refine((x) => Object.keys(x).length > 0);
const settingsColumns = {
  aiEnabled: "ai_enabled",
  campaignCapMicrousd: "campaign_cap_microusd",
  dailyCapMicrousd: "daily_cap_microusd",
  dailyCallCap: "daily_call_cap",
  maxInFlight: "max_in_flight",
};
const rowSettings = (r) => ({
  aiEnabled: Boolean(r.ai_enabled),
  campaignCapMicrousd: r.campaign_cap_microusd,
  dailyCapMicrousd: r.daily_cap_microusd,
  dailyCallCap: r.daily_call_cap,
  maxInFlight: r.max_in_flight,
});
const error = (message, code = "INVALID_INPUT", status = 400) =>
  Object.assign(new Error(message), { code, status });
const committed =
  "CASE WHEN status='succeeded' THEN estimated_microusd WHEN status IN ('running','billing_unknown') THEN ceiling_microusd ELSE 0 END";
const nowIso = (clock) => new Date(clock()).toISOString();
const isoInput = z
  .string()
  .refine(
    (s) =>
      /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z)?$/.test(s) &&
      !Number.isNaN(Date.parse(s)) &&
      new Date(s).toISOString().slice(0, 10) === s.slice(0, 10),
  );

export function createRepository(db, { clock = () => Date.now() } = {}) {
  if (!db?.prepare || !db?.batch)
    throw error(
      "Operational storage is unavailable.",
      "STORAGE_UNAVAILABLE",
      503,
    );
  const prepare = (sql, params = []) => db.prepare(sql).bind(...params);
  const first = (sql, params = []) => prepare(sql, params).first();
  const all = async (sql, params = []) =>
    (await prepare(sql, params).all()).results;
  const run = (sql, params = []) => prepare(sql, params).run();
  const bounds = ({ from, to } = {}) => {
    if (from !== undefined) isoInput.parse(from);
    if (to !== undefined) isoInput.parse(to);
    const start = from
      ? new Date(from).toISOString()
      : new Date(clock() - 30 * 86400000).toISOString();
    const end = to
      ? to.length === 10
        ? new Date(Date.parse(to) + 86400000 - 1).toISOString()
        : new Date(to).toISOString()
      : nowIso(clock);
    if (start > end) throw error("The date range is reversed.");
    return [start, end];
  };
  async function getSettings() {
    const row = await first("SELECT * FROM settings WHERE id=1");
    if (!row)
      throw error(
        "Budget settings are unavailable.",
        "STORAGE_UNAVAILABLE",
        503,
      );
    return rowSettings(row);
  }
  async function createSession(input) {
    const v = z.object({ id, expiresAt: isoInput }).strict().parse(input);
    const now = nowIso(clock);
    const expiry = new Date(v.expiresAt).toISOString();
    if (expiry <= now || Date.parse(expiry) - clock() > 12 * 3600000)
      throw error("Session expiry must be within twelve hours.");
    await run("INSERT INTO sessions(id,created_at,expires_at) VALUES(?,?,?)", [
      v.id,
      now,
      expiry,
    ]);
    return { id: v.id, expiresAt: expiry };
  }
  async function getSession(sessionId) {
    id.parse(sessionId);
    const r = await first(
      "SELECT id,created_at,expires_at FROM sessions WHERE id=? AND expires_at>?",
      [sessionId, nowIso(clock)],
    );
    return r
      ? { id: r.id, createdAt: r.created_at, expiresAt: r.expires_at }
      : null;
  }
  async function revokeSession(sessionId) {
    await run("DELETE FROM sessions WHERE id=?", [id.parse(sessionId)]);
  }
  async function recordEvent(input) {
    const v = z
      .object({
        id: uuid,
        sessionId: id,
        event: z.enum([
          "workflow_started",
          "example_loaded",
          "pack_downloaded",
        ]),
        mode: modes,
        country: countries,
      })
      .strict()
      .parse(input);
    const now = nowIso(clock);
    const result = await run(
      "INSERT OR IGNORE INTO events(id,session_id,event,mode,country,created_at) SELECT ?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM sessions WHERE id=? AND expires_at>?)",
      [v.id, v.sessionId, v.event, v.mode, v.country, now, v.sessionId, now],
    );
    return { recorded: result.meta.changes > 0 };
  }
  async function recordJob(input) {
    const v = z
      .object({
        id,
        sessionId: id.nullish(),
        operation: operations,
        mode: modes.nullish(),
        country: countries.nullish(),
        model: safeName.nullish(),
        topic: topicSchema.optional(),
        status: statuses,
      })
      .strict()
      .parse(input);
    await run(
      "INSERT INTO jobs(id,session_id,operation,mode,country,model,topic,status,created_at) VALUES(?,?,?,?,?,?,?,?,?)",
      [
        v.id,
        v.sessionId ?? null,
        v.operation,
        v.mode ?? null,
        v.country ?? null,
        v.model ?? null,
        v.topic ?? null,
        v.status,
        nowIso(clock),
      ],
    );
    return { id: v.id };
  }
  async function finishJob(input) {
    const v = z
      .object({
        id,
        status: statuses.exclude(["running"]),
        errorCode: z
          .string()
          .regex(/^[A-Z][A-Z0-9_]{0,79}$/)
          .optional(),
        durationMs: integer.optional(),
        tokens: tokensSchema.optional(),
        estimatedMicrousd: integer.optional(),
      })
      .strict()
      .parse(input);
    await run(
      "UPDATE jobs SET status=?,finished_at=?,duration_ms=?,error_code=?,input_tokens=?,output_tokens=?,estimated_microusd=? WHERE id=? AND status='running'",
      [
        v.status,
        nowIso(clock),
        v.durationMs ?? null,
        v.errorCode ?? null,
        v.tokens?.inputTokens ?? 0,
        v.tokens?.outputTokens ?? 0,
        v.estimatedMicrousd ?? null,
        v.id,
      ],
    );
  }
  async function consumeThrottle(input) {
    const v = z
      .object({
        key: z
          .string()
          .min(16)
          .max(180)
          .regex(/^[A-Za-z0-9_-]+(?::[A-Za-z0-9_-]+)?$/),
        limit: integer.min(1).max(10000),
        windowSeconds: integer.min(1).max(86400),
      })
      .strict()
      .parse(input);
    const windowStart =
      Math.floor(clock() / (v.windowSeconds * 1000)) * v.windowSeconds;
    const row = await first(
      "INSERT INTO throttles(key,window_start,count,expires_at) VALUES(?,?,1,?) ON CONFLICT(key,window_start) DO UPDATE SET count=count+1 WHERE count<? RETURNING count",
      [
        v.key,
        windowStart,
        new Date((windowStart + v.windowSeconds) * 1000).toISOString(),
        v.limit,
      ],
    );
    return {
      allowed: Boolean(row),
      remaining: row ? Math.max(0, v.limit - row.count) : 0,
    };
  }
  async function updateSettings(input) {
    const { actor, patch } = z
      .object({ actor: actorSchema, patch: settingsSchema })
      .strict()
      .parse(input);
    const current = await getSettings();
    for (const k of Object.keys(patch))
      if (k !== "aiEnabled" && patch[k] > current[k])
        throw error("Settings cannot increase an existing limit.");
    const merged = { ...current, ...patch };
    const entries = Object.entries(patch);
    const parameters = entries.map(([k, v]) =>
      k === "aiEnabled" ? Number(v) : v,
    );
    const predicates = entries
      .filter(([k]) => k !== "aiEnabled")
      .map(([k]) => `${settingsColumns[k]}>=?`);
    parameters.push(
      ...entries.filter(([k]) => k !== "aiEnabled").map(([, v]) => v),
    );
    parameters.push(
      merged.campaignCapMicrousd,
      merged.dailyCapMicrousd,
      nowIso(clock).slice(0, 10),
      merged.dailyCallCap,
      nowIso(clock).slice(0, 10),
    );
    const update = prepare(
      `UPDATE settings SET ${entries.map(([k]) => `${settingsColumns[k]}=?`).join(",")} WHERE id=1 ${predicates.length ? " AND " + predicates.join(" AND ") : ""} AND ? >= (SELECT COALESCE(SUM(${committed}),0) FROM ai_reservations) AND ? >= (SELECT COALESCE(SUM(${committed}),0) FROM ai_reservations WHERE utc_day=?) AND ? >= (SELECT COUNT(*) FROM ai_reservations WHERE utc_day=?)`,
      parameters,
    );
    const audit = prepare(
      "INSERT INTO admin_audit(id,actor,action,detail,created_at) SELECT ?,?,?,?,? WHERE changes()>0",
      [
        crypto.randomUUID(),
        actor,
        "settings_changed",
        JSON.stringify(patch),
        nowIso(clock),
      ],
    );
    const results = await db.batch([update, audit]);
    if (!results[0].meta.changes)
      throw error("Limits cannot increase or fall below committed usage.");
    return getSettings();
  }
  async function reserveAiCall(input) {
    const v = z
      .object({
        requestId: id,
        sessionId: id,
        idempotencyKey: uuid,
        payloadHmac: z.string().regex(/^[a-f0-9]{64}$/),
        operation: z.enum(["extract", "chat"]),
        model: safeName,
        ceilingMicrousd: integer.positive().max(5000000),
        utcDay: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        pricingVersion: safeName,
      })
      .strict()
      .parse(input);
    const now = nowIso(clock);
    if (v.utcDay !== now.slice(0, 10))
      throw error("Budget day must match the current UTC day.");
    // Admission and insertion are ONE SQLite write statement. All predicates read
    // the primary database in the same serialized write; no app-level lock/cache.
    const sql = `INSERT INTO ai_reservations(id,session_id,idempotency_key,payload_hmac,operation,model,pricing_version,utc_day,ceiling_microusd,status,created_at)
      SELECT ?,?,?,?,?,?,?,?,?,'running',? FROM settings WHERE id=1 AND ai_enabled=1
      AND (SELECT COALESCE(SUM(${committed}),0) FROM ai_reservations)+?<=campaign_cap_microusd
      AND (SELECT COALESCE(SUM(${committed}),0) FROM ai_reservations WHERE utc_day=?)+?<=daily_cap_microusd
      AND (SELECT COUNT(*) FROM ai_reservations WHERE utc_day=?)<daily_call_cap
      AND (SELECT COUNT(*) FROM ai_reservations WHERE status='running')<max_in_flight
      ON CONFLICT DO NOTHING RETURNING id`;
    const row = await first(sql, [
      v.requestId,
      v.sessionId,
      v.idempotencyKey,
      v.payloadHmac,
      v.operation,
      v.model,
      v.pricingVersion,
      v.utcDay,
      v.ceilingMicrousd,
      now,
      v.ceilingMicrousd,
      v.utcDay,
      v.ceilingMicrousd,
      v.utcDay,
    ]);
    if (row) return { admitted: true, reservationId: row.id, reason: null };
    const existing = await first(
      "SELECT id,payload_hmac FROM ai_reservations WHERE session_id=? AND idempotency_key=?",
      [v.sessionId, v.idempotencyKey],
    );
    if (existing)
      return {
        admitted: false,
        reservationId: existing.id,
        reason:
          existing.payload_hmac === v.payloadHmac
            ? "ALREADY_PROCESSED"
            : "IDEMPOTENCY_CONFLICT",
      };
    const reason = await getBudgetBlockReason(v.ceilingMicrousd,v.utcDay);
    return { admitted: false, reservationId: null, reason: reason || "BUDGET_EXHAUSTED" };
  }
  async function getBudgetBlockReason(ceilingMicrousd, utcDay) {
    const settings = await getSettings();
    if (!settings.aiEnabled)
      return "AI_PAUSED";
    const totals = await first(
      `SELECT COALESCE(SUM(${committed}),0) total,COALESCE(SUM(CASE WHEN utc_day=? THEN ${committed} ELSE 0 END),0) daily,SUM(CASE WHEN utc_day=? THEN 1 ELSE 0 END) calls,SUM(CASE WHEN status='running' THEN 1 ELSE 0 END) running FROM ai_reservations`,
      [utcDay, utcDay],
    );
    return totals.total + ceilingMicrousd > settings.campaignCapMicrousd
        ? "BUDGET_EXHAUSTED"
        : totals.daily + ceilingMicrousd > settings.dailyCapMicrousd ||
            totals.calls >= settings.dailyCallCap
          ? "DAILY_LIMIT"
          : totals.running >= settings.maxInFlight
            ? "IN_FLIGHT"
            : null;
  }
  async function settleAiCall(input) {
    const v = z
      .object({
        reservationId: id,
        status: z.enum(["succeeded", "failed_before_send", "billing_unknown"]),
        tokens: tokensSchema.optional(),
        estimatedMicrousd: integer.optional(),
      })
      .strict()
      .parse(input);
    if (
      v.status === "succeeded" &&
      (!v.tokens || v.estimatedMicrousd === undefined)
    )
      throw error("Validated usage and estimated cost are required.");
    if (
      v.status !== "succeeded" &&
      (v.tokens || v.estimatedMicrousd !== undefined)
    )
      throw error("Only successful usage may be settled to a cost.");
    const result = await run(
      "UPDATE ai_reservations SET status=?,estimated_microusd=?,input_tokens=?,output_tokens=?,finished_at=? WHERE id=? AND status='running' AND (? IS NULL OR ?<=ceiling_microusd)",
      [
        v.status,
        v.estimatedMicrousd ?? null,
        v.tokens?.inputTokens ?? 0,
        v.tokens?.outputTokens ?? 0,
        nowIso(clock),
        v.reservationId,
        v.estimatedMicrousd ?? null,
        v.estimatedMicrousd ?? null,
      ],
    );
    if (result.meta.changes) return { settled: true };
    const row = await first("SELECT * FROM ai_reservations WHERE id=?", [
      v.reservationId,
    ]);
    if (!row) throw error("Unknown reservation.");
    if (v.estimatedMicrousd > row.ceiling_microusd)
      throw error("Estimated cost exceeds the reserved ceiling.");
    if (
      row.status === v.status &&
      (v.status !== "succeeded" ||
        (row.estimated_microusd === v.estimatedMicrousd &&
          row.input_tokens === v.tokens.inputTokens &&
          row.output_tokens === v.tokens.outputTokens))
    )
      return { settled: true };
    throw error("Reservation is already settled.");
  }
  async function getOverview(input = {}) {
    const [from, to] = bounds(input);
    const settings = await getSettings();
    const u = await first(
      "SELECT COALESCE(SUM(CASE WHEN status='succeeded' THEN estimated_microusd ELSE 0 END),0) spent,COALESCE(SUM(CASE WHEN status IN ('running','billing_unknown') THEN ceiling_microusd ELSE 0 END),0) reserved,COALESCE(SUM(input_tokens),0) input,COALESCE(SUM(output_tokens),0) output,COALESCE(SUM(CASE WHEN status='billing_unknown' THEN 1 ELSE 0 END),0) unknown FROM ai_reservations",
    );
    const versions = await all(
      "SELECT DISTINCT pricing_version AS version FROM ai_reservations ORDER BY pricing_version",
    );
    const e = await first(
      "SELECT COUNT(*) n FROM events WHERE event='workflow_started' AND created_at BETWEEN ? AND ?",
      [from, to],
    );
    const j = await first(
      "SELECT COALESCE(SUM(CASE WHEN status='succeeded' AND operation IN ('plan','assess') THEN 1 ELSE 0 END),0) completed,COALESCE(SUM(CASE WHEN status IN ('failed','billing_unknown') THEN 1 ELSE 0 END),0) failed FROM jobs WHERE created_at BETWEEN ? AND ?",
      [from, to],
    );
    const groups = async (field) =>
      all(
        `SELECT ${field} code,COUNT(*) jobs,COALESCE(SUM(CASE WHEN status='succeeded' THEN 1 ELSE 0 END),0) succeeded,COALESCE(SUM(CASE WHEN status IN ('failed','billing_unknown') THEN 1 ELSE 0 END),0) failed FROM jobs WHERE created_at BETWEEN ? AND ? GROUP BY ${field}`,
        [from, to],
      );
    const byChatTopic = await all(
      `SELECT COALESCE(j.topic,'unclassified') AS topic,COUNT(*) AS queries,
        COALESCE(SUM(CASE WHEN r.status='succeeded' THEN r.estimated_microusd ELSE 0 END),0) AS estimatedMicrousd,
        COALESCE(SUM(CASE WHEN r.status IN ('running','billing_unknown') THEN r.ceiling_microusd ELSE 0 END),0) AS heldMicrousd
        FROM jobs j LEFT JOIN ai_reservations r ON r.id=j.id
        WHERE j.operation='chat' AND j.created_at BETWEEN ? AND ?
        GROUP BY COALESCE(j.topic,'unclassified') ORDER BY queries DESC,topic ASC`,
      [from, to],
    );
    return {
      settings,
      usage: {
        scope: "campaign_all_time",
        pricingVersions: versions.map((row) => row.version),
        spentMicrousd: u.spent,
        reservedMicrousd: u.reserved,
        remainingMicrousd: Math.max(
          0,
          settings.campaignCapMicrousd - u.spent - u.reserved,
        ),
        inputTokens: u.input,
        outputTokens: u.output,
        billingUnknown: u.unknown,
      },
      totals: { started: e.n, completed: j.completed, failed: j.failed },
      byCountry: await groups("country"),
      byMode: await groups("mode"),
      byChatTopic,
    };
  }
  async function listJobs(input = {}) {
    const v = z
      .object({
        from: isoInput.optional(),
        to: isoInput.optional(),
        status: statuses.optional(),
        operation: operations.optional(),
        country: countries.optional(),
        limit: integer.min(1).max(100).default(25),
        offset: integer.max(100000).default(0),
      })
      .strict()
      .parse(input);
    const [from, to] = bounds(v);
    const params = [from, to];
    let where = "created_at BETWEEN ? AND ?";
    for (const key of ["status", "operation", "country"])
      if (v[key] !== undefined) {
        where += ` AND ${key}=?`;
        params.push(v[key]);
      }
    const total = await first(
      `SELECT COUNT(*) n FROM jobs WHERE ${where}`,
      params,
    );
    const rows = await all(
      `SELECT id,operation,mode,country,model,topic,status,created_at AS createdAt,finished_at AS finishedAt,duration_ms AS durationMs,error_code AS errorCode,input_tokens AS inputTokens,output_tokens AS outputTokens,estimated_microusd AS estimatedMicrousd,(SELECT pricing_version FROM ai_reservations WHERE ai_reservations.id=jobs.id) AS pricingVersion,(SELECT ceiling_microusd FROM ai_reservations WHERE ai_reservations.id=jobs.id AND status IN ('running','billing_unknown')) AS heldMicrousd FROM jobs WHERE ${where} ORDER BY created_at DESC,id DESC LIMIT ? OFFSET ?`,
      [...params, v.limit, v.offset],
    );
    return { items: rows, total: total.n };
  }
  async function addFeedback(input) {
    const v = z
      .object({
        id,
        sessionId: id,
        text: z.string().trim().min(1).max(1000),
        mode: modes.optional(),
        country: countries.optional(),
      })
      .strict()
      .parse(input);
    await run(
      "INSERT INTO feedback(id,session_id,text,mode,country,created_at) VALUES(?,?,?,?,?,?)",
      [
        v.id,
        v.sessionId,
        v.text,
        v.mode ?? null,
        v.country ?? null,
        nowIso(clock),
      ],
    );
    return { id: v.id };
  }
  async function listFeedback(input = {}) {
    const v = z
      .object({
        limit: integer.min(1).max(100).default(25),
        offset: integer.max(100000).default(0),
      })
      .strict()
      .parse(input);
    const total = await first("SELECT COUNT(*) n FROM feedback");
    const items = await all(
      "SELECT id,text,mode,country,created_at AS createdAt FROM feedback ORDER BY created_at DESC,id DESC LIMIT ? OFFSET ?",
      [v.limit, v.offset],
    );
    return { items, total: total.n };
  }
  async function purge(input) {
    const v = z
      .object({
        actor: actorSchema,
        kind: z.enum(["events", "jobs", "feedback"]),
        confirm: z.literal("DELETE"),
      })
      .strict()
      .parse(input);
    const results = await db.batch([
      prepare(`DELETE FROM ${v.kind}`),
      prepare(
        "INSERT INTO admin_audit(id,actor,action,detail,created_at) VALUES(?,?,?,?,?)",
        [crypto.randomUUID(), v.actor, "records_purged", v.kind, nowIso(clock)],
      ),
    ]);
    return {
      deleted: results[0].meta.changes,
      kind: v.kind,
      retained: "Campaign budget and idempotency records are retained.",
    };
  }
  async function cleanup() {
    const now = nowIso(clock),
      cutoff30 = new Date(clock() - 30 * 86400000).toISOString(),
      cutoff90 = new Date(clock() - 90 * 86400000).toISOString();
    const statements = [
      prepare(
        "DELETE FROM sessions WHERE id IN (SELECT id FROM sessions WHERE expires_at<? LIMIT 500)",
        [now],
      ),
      prepare(
        "DELETE FROM events WHERE rowid IN (SELECT rowid FROM events WHERE created_at<? LIMIT 500)",
        [cutoff30],
      ),
      prepare(
        "DELETE FROM jobs WHERE id IN (SELECT id FROM jobs WHERE created_at<? LIMIT 500)",
        [cutoff30],
      ),
      prepare(
        "DELETE FROM feedback WHERE id IN (SELECT id FROM feedback WHERE created_at<? LIMIT 500)",
        [cutoff90],
      ),
      prepare(
        "DELETE FROM throttles WHERE rowid IN (SELECT rowid FROM throttles WHERE expires_at<? LIMIT 500)",
        [now],
      ),
    ];
    const results = await db.batch(statements);
    return {
      deleted: results.reduce((n, r) => n + r.meta.changes, 0),
      budgetRetained: true,
    };
  }
  return {
    createSession,
    getSession,
    revokeSession,
    recordEvent,
    recordJob,
    finishJob,
    consumeThrottle,
    getSettings,
    updateSettings,
    getBudgetBlockReason,
    reserveAiCall,
    settleAiCall,
    getOverview,
    listJobs,
    addFeedback,
    listFeedback,
    purge,
    cleanup,
  };
}
