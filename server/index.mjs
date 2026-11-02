import express from "express";
import helmet from "helmet";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { countries, getCoverage, indiaCheckDefinitions, clientSources } from "./catalog.mjs";
import { planPurchase, assess } from "./domain.mjs";
import { factsSchema } from "./schema.mjs";
import { createMetaClient } from "./meta.mjs";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export function createApp({
  meta = createMetaClient(),
  configured = false,
} = {}) {
  const app = express();
  app.disable("x-powered-by");
  app.use(
    helmet({
      strictTransportSecurity: false,
      contentSecurityPolicy:
        process.env.NODE_ENV === "production"
          ? {
              directives: {
                defaultSrc: ["'self'"],
                scriptSrc: ["'self'"],
                styleSrc: ["'self'"],
                imgSrc: ["'self'", "blob:", "data:"],
                connectSrc: ["'self'"],
                objectSrc: ["'none'"],
                frameAncestors: ["'none'"],
              },
            }
          : false,
    }),
  );
  app.use("/api", (req, res, next) => {
    res.set("Cache-Control", "no-store");
    const host = req.headers.host || "";
    if (!/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host))
      return res
        .status(403)
        .json({
          error:
            "Use the local app address. Public hosting requires deployment configuration.",
        });
    const origin = req.headers.origin;
    if (origin && origin !== `http://${host}` && origin !== `https://${host}`)
      return res
        .status(403)
        .json({ error: "This request must come from the app." });
    if (req.method === "POST" && !req.is("application/json"))
      return res.status(415).json({ error: "Send JSON from the app." });
    next();
  });
  app.use("/api", express.json({ limit: "9mb", strict: true }));
  const buckets = new Map();
  app.use("/api/extract", (req, res, next) => {
    const now = Date.now(),
      id = req.ip;
    for (const [k, v] of buckets) if (v.until < now) buckets.delete(k);
    const b = buckets.get(id) || { until: now + 60000, n: 0 };
    if (++b.n > 8)
      return res
        .status(429)
        .json({ error: "Wait a minute before another document extraction." });
    buckets.set(id, b);
    next();
  });
  app.get("/api/config", (req, res) =>
    res.json({
      countries: countries.map((c) => ({
        code: c.code,
        name: c.name,
        currency: c.currency,
        tax: c.tax,
        idLabel: c.idLabel,
        sources: c.sources,
        coverage: ["IN", "GB", "SG"].includes(c.code)
          ? "Guidance + limited conditional estimates"
          : "Guidance; estimates need review",
      })),
      modelConfigured: configured,
      coverage: getCoverage(), indiaCheckDefinitions, clientSources: Object.values(clientSources),
      model: process.env.META_MODEL || "muse-spark-1.3",
      provider: "Meta Model API",
      ai: { enabled: false, chatAvailable: false, extractionAvailable: false,
        reason: "AI is paused in the legacy local server. Use the budgeted Workers runtime for live AI; manual checks work here." },
      limits: { fileMB: 6, pdfPages: 10 },
      storage:
        "No bill or profile is saved by this app. Meta processes documents under its service terms.",
    }),
  );
  app.post("/api/plan", (req, res) =>
    res.json(planPurchase(factsSchema.parse(req.body))),
  );
  app.post("/api/assess", (req, res) =>
    res.json(assess(factsSchema.parse(req.body))),
  );
  app.post("/api/extract", async (req, res, next) => {
    try {
      const body = z
        .object({
          consent: z.literal(true),
          file: z
            .object({
              name: z.string().max(180),
              data: z.string().max(8500000),
            })
            .strict(),
        })
        .strict()
        .parse(req.body);
      if (!configured) return res.status(503).json({
        code: "AI_PAUSED", message: "AI is paused. Use the budgeted Workers runtime or enter the invoice manually.",
        error: "AI is paused. Use the budgeted Workers runtime or enter the invoice manually.",
      });
      res.json(await meta.extract(body.file));
    } catch (e) {
      next(e);
    }
  });
  app.use("/api", (req, res) =>
    res.status(404).json({ error: "Unknown API route." }),
  );
  app.use((err, req, res, next) => {
    if (err instanceof z.ZodError)
      return res
        .status(400)
        .json({
          error: "Check the highlighted input values.",
          fields: err.issues.map((x) => ({
            path: x.path.join("."),
            message: x.message,
          })),
        });
    if (err.type === "entity.too.large")
      return res
        .status(413)
        .json({ error: "The file is too large. Use a file up to 6 MB." });
    if (err instanceof SyntaxError)
      return res.status(400).json({ error: "Invalid JSON request." });
    res
      .status(err.status || 400)
      .json({
        error: err.status
          ? err.message
          : "The document or input could not be processed. Check its format and try again.",
      });
  });
  return app;
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const app = createApp(),
    http = createServer(app),
    port = Number(process.env.PORT || 4174);
  if (process.env.NODE_ENV === "production") {
    app.use(express.static(path.join(root, "dist"), { dotfiles: "deny" }));
    app.get("/{*path}", (req, res) =>
      res.sendFile(path.join(root, "dist/index.html")),
    );
  } else {
    const { createServer: createVite } = await import("vite");
    const vite = await createVite({
      root,
      server: { middlewareMode: true, hmr: { server: http } },
      appType: "custom",
    });
    app.use(vite.middlewares);
    app.get("/{*path}", async (req, res, next) => {
      try {
        res
          .type("html")
          .send(
            await vite.transformIndexHtml(
              req.originalUrl,
              await readFile(path.join(root, "index.html"), "utf8"),
            ),
          );
      } catch (e) {
        next(e);
      }
    });
  }
  http.listen(port, "127.0.0.1", () =>
    console.log(`Tikdam: http://127.0.0.1:${port}`),
  );
}
