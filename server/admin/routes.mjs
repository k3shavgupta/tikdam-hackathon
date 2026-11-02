import { z } from "zod";
import {countryCodeSchema} from '../schema.mjs';

const date = z
  .string()
  .refine(
    (s) =>
      /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z)?$/.test(s) &&
      !Number.isNaN(Date.parse(s)) &&
      new Date(s).toISOString().slice(0, 10) === s.slice(0, 10),
  );
const querySchema = z
  .object({
    from: date.optional(),
    to: date.optional(),
    status: z
      .enum(["running", "succeeded", "failed", "billing_unknown", "blocked"])
      .optional(),
    operation: z.enum(["plan", "assess", "extract", "chat"]).optional(),
    country: countryCodeSchema.optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    offset: z.coerce.number().int().min(0).max(100000).optional(),
  })
  .strict();
const settings = z
  .object({
    aiEnabled: z.boolean().optional(),
    campaignCapMicrousd: z.number().int().min(0).max(5000000).optional(),
    dailyCapMicrousd: z.number().int().min(0).max(1000000).optional(),
    dailyCallCap: z.number().int().min(1).max(10).optional(),
    maxInFlight: z.literal(1).optional(),
  })
  .strict()
  .refine((x) => Object.keys(x).length > 0);
const headers = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
};
const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers });
const deny = (code, message, status) =>
  json({ code, message, requestId: crypto.randomUUID() }, status);

export async function handleAdminRequest(
  request,
  { repository, admin, coverage, evaluationReporting } = {},
) {
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/api/admin/")) return null;
  if (!admin?.subject || !admin?.email)
    return deny("ADMIN_REQUIRED", "Administrator access is required.", 403);
  const route = url.pathname.slice("/api/admin/".length);
  const known = [
    "evaluation",
    "overview",
    "jobs",
    "coverage",
    "feedback",
    "settings",
    "purge",
  ];
  if (!known.includes(route)) return null;
  try {
    if (request.method === "GET") {
      const params = querySchema.parse(Object.fromEntries(url.searchParams));
      if (route === "evaluation") return json({snapshot: evaluationReporting ? await evaluationReporting.latest() : null});
      if (route === "overview")
        return json(
          await repository.getOverview({ from: params.from, to: params.to }),
        );
      if (route === "jobs") return json(await repository.listJobs(params));
      if (route === "coverage") return json({ items: coverage ?? [] });
      if (route === "feedback")
        return json(
          await repository.listFeedback({
            limit: params.limit,
            offset: params.offset,
          }),
        );
      return deny("METHOD_NOT_ALLOWED", "Use POST for this action.", 405);
    }
    if (request.method !== "POST" || !["settings", "purge"].includes(route))
      return deny("METHOD_NOT_ALLOWED", "This method is not available.", 405);
    if (request.headers.get("Origin") !== url.origin)
      return deny(
        "ORIGIN_REJECTED",
        "Use this application to change administrator settings.",
        403,
      );
    if (
      !/^application\/json(?:\s*;|$)/i.test(
        request.headers.get("Content-Type") || "",
      )
    )
      return deny("INVALID_CONTENT_TYPE", "Send a JSON request.", 415);
    const raw = await request.text();
    if (raw.length > 4096)
      return deny("BODY_TOO_LARGE", "The request is too large.", 413);
    const body = JSON.parse(raw);
    if (route === "settings")
      return json(
        await repository.updateSettings({
          actor: admin.subject,
          patch: settings.parse(body),
        }),
      );
    const value = z
      .object({
        kind: z.enum(["events", "jobs", "feedback"]),
        confirm: z.literal("DELETE"),
      })
      .strict()
      .parse(body);
    return json(await repository.purge({ ...value, actor: admin.subject }));
  } catch (err) {
    if (err instanceof z.ZodError || err instanceof SyntaxError)
      return deny("INVALID_INPUT", "Check the request values.", 400);
    if (err?.code === "INVALID_INPUT") return deny(err.code, err.message, 400);
    return deny(
      "STORAGE_UNAVAILABLE",
      "Operational records are temporarily unavailable.",
      503,
    );
  }
}
