import { test } from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../server/index.mjs";
import { PDFDocument } from "pdf-lib";
import { validateFile } from "../server/meta.mjs";
async function withServer(fn, options = {}) {
  const app = createApp({ configured: false, ...options });
  const server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  const url = `http://127.0.0.1:${server.address().port}`;
  try {
    await fn(url);
  } finally {
    await new Promise((r) => server.close(r));
  }
}
test("configuration exposes coverage but never secrets", () =>
  withServer(async (url) => {
    const r = await fetch(url + "/api/config");
    const c = await r.json();
    assert.equal(c.countries.length, 11);
    assert.equal(c.modelConfigured, false);
    assert.ok(!JSON.stringify(c).includes("test-key"));
  }));
test("API rejects foreign origin, unsupported country, and unknown invoice fields", () =>
  withServer(async (url) => {
    const request = (body, origin) =>
      fetch(url + "/api/plan", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(origin ? { Origin: origin } : {}),
        },
        body: JSON.stringify(body),
      });
    assert.equal(
      (
        await request(
          { mode: "before", country: "IN", businessCountry: "IN" },
          "https://untrusted.example",
        )
      ).status,
      403,
    );
    assert.equal(
      (await request({ mode: "before", country: "XX", businessCountry: "IN" }))
        .status,
      400,
    );
    assert.equal(
      (
        await request({
          mode: "before",
          country: "IN",
          businessCountry: "IN",
          evil: true,
        })
      ).status,
      400,
    );
    assert.equal(
      (await request({ mode: "before", country: "IN", businessCountry: "IN" }))
        .status,
      200,
    );
  }));
test("model extraction requires explicit upload consent", () =>
  withServer(async (url) => {
    const r = await fetch(url + "/api/extract", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        consent: false,
        file: { name: "bill.png", data: "data:image/png;base64,AAAA" },
      }),
    });
    assert.equal(r.status, 400);
  }));
test("PDF validation accepts a small document and rejects more than ten pages", async () => {
  const pdf = await PDFDocument.create();
  pdf.addPage();
  const data =
    "data:application/pdf;base64," +
    Buffer.from(await pdf.save()).toString("base64");
  assert.equal((await validateFile({ name: "invoice.pdf", data })).pages, 1);
  for (let i = 0; i < 10; i++) pdf.addPage();
  const longData =
    "data:application/pdf;base64," +
    Buffer.from(await pdf.save()).toString("base64");
  await assert.rejects(
    () => validateFile({ name: "long.pdf", data: longData }),
    /10 pages/,
  );
});
test("paused local extraction cannot invoke a provider even when credentials exist", async () => {
  let called = 0;
  await withServer(async (url) => {
    const r = await fetch(url + "/api/extract", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({consent: true, file: {name: "example.png", data: "data:image/png;base64,iVBORw0KGgo="}}),
    });
    assert.equal(r.status, 503);
    assert.equal(called, 0);
  }, {meta: {extract: async () => { called++; return {}; }}});
});
