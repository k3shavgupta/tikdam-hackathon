import test from "node:test";
import assert from "node:assert/strict";
import { handleAdminRequest } from "../server/admin/routes.mjs";
const admin = { subject: "verified-owner", email: "owner@example.test" };
const options = {
  admin,
  coverage: [{ country: "IN", status: "guidance" }],
  repository: {
    getOverview: async () => ({ usage: { spentMicrousd: 0 } }),
    listJobs: async (args) => ({ items: [], total: 0, args }),
    listFeedback: async () => ({ items: [], total: 0 }),
    updateSettings: async (x) => x,
    purge: async (x) => x,
  },
};
const req = (path, body, origin = "https://tikdam.xyz") =>
  new Request(
    "https://tikdam.xyz/api/admin/" + path,
    body === undefined
      ? {}
      : {
          method: "POST",
          headers: { "Content-Type": "application/json", Origin: origin },
          body: JSON.stringify(body),
        },
  );
test("admin API denies absent identity even if a forged email header exists", async () => {
  const response = await handleAdminRequest(
    new Request("https://tikdam.xyz/api/admin/overview", {
      headers: { "Cf-Access-Authenticated-User-Email": "owner@example.test" },
    }),
    { ...options, admin: null },
  );
  assert.equal(response.status, 403);
});
test("admin routes return metadata and bounded pagination only after verified identity", async () => {
  assert.equal(
    (await handleAdminRequest(req("overview"), options)).status,
    200,
  );
  const result = await (
    await handleAdminRequest(req("jobs?limit=10&country=IN"), options)
  ).json();
  assert.equal(result.args.limit, 10);
  assert.equal(
    (await handleAdminRequest(req("jobs?limit=1000"), options)).status,
    400,
  );
  assert.equal(
    (await handleAdminRequest(req("overview?from=garbage"), options)).status,
    400,
  );
  assert.deepEqual(
    await (await handleAdminRequest(req("coverage"), options)).json(),
    { items: options.coverage },
  );
});
test("mutations reject foreign or missing origins, invalid fields, and non-JSON bodies", async () => {
  assert.equal(
    (
      await handleAdminRequest(
        req("settings", { aiEnabled: false }, "https://evil.test"),
        options,
      )
    ).status,
    403,
  );
  const missing = new Request("https://tikdam.xyz/api/admin/settings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  assert.equal((await handleAdminRequest(missing, options)).status, 403);
  assert.equal(
    (await handleAdminRequest(req("settings", { reset: true }), options))
      .status,
    400,
  );
  assert.equal(
    (
      await handleAdminRequest(
        req("purge", { kind: "ledger", confirm: "DELETE" }),
        options,
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await handleAdminRequest(
        req("purge", { kind: "jobs", confirm: "wrong" }),
        options,
      )
    ).status,
    400,
  );
});
test("settings audit identity comes from verified subject and unknown routes are not SPA", async () => {
  const result = await (
    await handleAdminRequest(req("settings", { aiEnabled: false }), options)
  ).json();
  assert.equal(result.actor, admin.subject);
  assert.equal(await handleAdminRequest(req("unknown"), options), null);
});

test('evaluation reporting requires the same verified owner and exposes a nullable snapshot only',async()=>{
 const reporting={latest:async()=>({scope:'evaluation_only',generatedAt:'2026-11-02T00:00:00.000Z'})};
 const denied=await handleAdminRequest(req('evaluation'),{...options,admin:null,evaluationReporting:reporting});assert.equal(denied.status,403);
 const allowed=await handleAdminRequest(req('evaluation'),{...options,evaluationReporting:reporting});assert.equal(allowed.status,200);assert.deepEqual(await allowed.json(),{snapshot:await reporting.latest()});
 const absent=await handleAdminRequest(req('evaluation'),{...options,evaluationReporting:{latest:async()=>null}});assert.deepEqual(await absent.json(),{snapshot:null});
 const mutation=await handleAdminRequest(req('evaluation',{snapshot:{}}),{...options,evaluationReporting:reporting});assert.equal(mutation.status,405);
});
