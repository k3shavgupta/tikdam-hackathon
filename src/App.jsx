import React, { useState, useEffect, useRef } from "react";
import {api as requestApi, ensureSession, sendEvent, resetSession} from "./api.mjs";
import {AssistantPanel} from "./components/AssistantPanel.jsx";
import {FeedbackPanel} from "./components/FeedbackPanel.jsx";
import {TurnstileChallenge} from "./components/TurnstileChallenge.jsx";
const defaults = {
  mode: "before",
  country: "IN",
  businessCountry: "IN",
  taxResidence: "unknown",
  workCountry: "unknown",
  legalName: "",
  billingAddress: "",
  taxId: "",
  registration: "unknown",
  item: "",
  category: "other",
  businessUse: 100,
  buyerName: "",
  supplierName: "",
  supplierTaxId: "",
  invoiceNumber: "",
  invoiceDate: "",
  currency: "INR",
  net: "",
  tax: "",
  gross: "",
  amountReceived: "",
  withheld: "",
  documentType: "unknown",
  invoiceConfirmed: false,
  taxableActivity: "unknown",
  supplierRegime: "unknown",
  paid: "unknown",
  priorClaim: "unknown",
  certificate: false,
  region: "",
  indiaChecks: {purchaseKind:"unknown",received:"unknown",invoiceValid:"unknown",gstr2bAvailable:"unknown",supplierTaxPaid:"unknown",returnFiled:"unknown",notBlocked:"unknown",domesticForwardCharge:"unknown",claimPeriodOpen:"unknown"},
};
const modes = [
  ["before", "Before you buy", "Get the invoice right from the start.", "↗"],
  ["purchase", "Review a bill", "Read it, check it, find your next step.", "▤"],
  [
    "client",
    "Check a client payment",
    "Understand tax deducted from your pay.",
    "⇄",
  ],
];
const api = (path, body, options) => requestApi("/api/"+path, body, options);
function Field({ label, children, hint, wide = false }) {
  return (
    <label className={"field " + (wide ? "wide" : "")}>
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
function Sources({ sources = [] }) {
  if (!sources.length) return <p className="source-gap">No country-specific tax source has been reviewed for this location.</p>;
  return (
    <details className="sources">
      <summary>
        Official sources <span>{sources.length} references</span>
      </summary>
      <ul>
        {sources.map((s, i) => (
          <li key={i}>
            <a href={s.url} target="_blank" rel="noreferrer">
              {s.title} ↗
            </a>
            <small>
              Checked {s.checked}. Read the source and applicable period.
            </small>
          </li>
        ))}
      </ul>
    </details>
  );
}
export default function App() {
  const [config, setConfig] = useState(null),
    [facts, setFacts] = useState(defaults),
    [page, setPage] = useState("work"),
    [result, setResult] = useState(null),
    [busy, setBusy] = useState(""),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [file, setFile] = useState(null),
    [preview, setPreview] = useState(null),
    [consent, setConsent] = useState(false),
    [extraction, setExtraction] = useState(null),
    [sample, setSample] = useState(false),
    [challengeToken,setChallengeToken] = useState(""),
    [challengeReset,setChallengeReset] = useState(0),
    [sessionVersion,setSessionVersion] = useState(0);
  const fileRef = useRef(null),
    heading = useRef(null),
    generation = useRef(0);
  useEffect(() => {
    api("config")
      .then((c)=>{setConfig(c);ensureSession().catch(()=>{});})
      .catch(() =>
        setError("The app server is unavailable. Refresh after restarting it."),
      );
  }, []);
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );
  useEffect(() => {
    if (result || page !== "work")
      heading.current?.focus({ preventScroll: true });
  }, [result, page]);
  const country = config?.countries.find((c) => c.code === facts.country);
  function edit(key, value) {
    generation.current++;
    setBusy("");
    setFacts((f) => {
      const next = {...f, [key]: value, invoiceConfirmed: key === "invoiceConfirmed" ? value : false};
      if (key === 'country') {
        next.currency = config?.countries.find(c => c.code === value)?.currency || '';
        if (f.businessCountry === f.country) next.businessCountry = value;
      }
      return next;
    });
    setResult(null);
    setError("");
    setNotice("");
  }
  function applyProposals(proposals){
    const allowed=new Set(["mode","country","businessCountry","item","category","businessUse","currency","taxResidence","workCountry"]);
    generation.current++;
    setFacts(f=>({...f,...Object.fromEntries(Object.entries(proposals).filter(([k])=>allowed.has(k))),invoiceConfirmed:false}));
    setResult(null);setNotice("Suggested fields applied. Review them before continuing.");
  }
  function selectMode(mode) {
    sendEvent("workflow_started",mode,facts.country);
    generation.current++;
    setBusy("");
    setFacts((f) => ({ ...f, mode, invoiceConfirmed: false }));
    setResult(null);
    setPage("work");
    setError("");
    setNotice("");
  }
  function clear() {
    resetSession().catch(()=>{});
    setSessionVersion(x=>x+1);
    setChallengeToken("");setChallengeReset(x=>x+1);
    generation.current++;
    setBusy("");
    setFacts(defaults);
    setFile(null);
    setPreview(null);
    setExtraction(null);
    setResult(null);
    setSample(false);
    setConsent(false);
    setError("");
    setNotice("");
    if (fileRef.current) fileRef.current.value = "";
    setPage("work");
  }
  async function run() {
    setError("");
    setBusy("Checking");
    const token = generation.current;
    try {
      await ensureSession().catch(()=>{});
      const answer = await api(
        facts.mode === "before" ? "plan" : "assess",
        facts,
      );
      if (token === generation.current) {
        setResult(answer);
        window.scrollTo({ top: 0, behavior: "instant" });
      }
    } catch (e) {
      if (token === generation.current) setError(e.message);
    } finally {
      if (token === generation.current) setBusy("");
    }
  }
  async function chooseFile(f) {
    setChallengeToken("");setChallengeReset(x=>x+1);
    generation.current++;
    setBusy("");
    setResult(null);
    setError("");
    setExtraction(null);
    setSample(false);
    setConsent(false);
    setFacts((prev) => ({
      ...defaults,
      country: prev.country,
      businessCountry: prev.businessCountry,
      mode: prev.mode,
      legalName: prev.legalName,
      billingAddress: prev.billingAddress,
      taxId: prev.taxId,
      registration: prev.registration,
      currency: prev.currency,
    }));
    if (!f) {
      setFile(null);
      setPreview(null);
      return;
    }
    if (
      !["image/png", "image/jpeg", "image/webp", "application/pdf"].includes(
        f.type,
      ) ||
      f.size > 6 * 1024 * 1024
    ) {
      setFile(null);
      setPreview(null);
      setError(
        "Choose a PNG, JPEG, WebP or PDF up to 6 MB. PDFs can contain up to 10 pages.",
      );
      return;
    }
    setFile(f);
    setPreview(f.type.startsWith("image/") ? URL.createObjectURL(f) : null);
  }
  async function extract() {
    setError("");
    if (!file || !consent) return;
    const token = ++generation.current;
    setBusy("Reading bill");
    try {
      const data = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(Error("Could not read this file."));
        reader.readAsDataURL(file);
      });
      const answer = await api("extract", {
        file: { name: file.name, data },
        consent: true,
      }, {paid:true,challengeToken});
      if (token !== generation.current) return;
      setExtraction(answer);
      setFacts((f) => {
        const next = { ...f, invoiceConfirmed: false };
        for (const [k, v] of Object.entries(answer.fields))
          if (v !== null && Object.hasOwn(next, k)) next[k] = v;
        return next;
      });
      setNotice(
        "Muse read the document. Review every field below, especially the buyer, dates and tax amounts.",
      );
    } catch (e) {
      if (token === generation.current) setError(e.message);
    } finally {
      setChallengeToken("");setChallengeReset(x=>x+1);
      if (token === generation.current) setBusy("");
    }
  }
  function loadSample() {
    sendEvent("example_loaded",facts.mode,facts.country);
    generation.current++;
    setFile(null);
    setPreview(null);
    setConsent(false);
    setExtraction(null);
    setError("");
    setResult(null);
    setSample(true);
    setFacts({
      ...defaults,
      mode: facts.mode === "before" ? "purchase" : facts.mode,
      country: "GB",
      businessCountry: "GB",
      currency: "GBP",
      legalName: "North Studio Ltd",
      billingAddress: "10 Sample Lane, London",
      buyerName: "North Studio Ltd",
      taxId: "GB123456789",
      registration: "standard",
      supplierName: "Paper Works (example)",
      supplierTaxId: "GB987654321",
      invoiceNumber: "EXAMPLE-001",
      invoiceDate: "2026-10-20",
      item: "Office stationery",
      category: "ordinary",
      businessUse: 100,
      documentType: "invoice",
      net: "100",
      tax: "20",
      gross: "120",
      taxableActivity: "fully",
      supplierRegime: "ordinary",
      paid: "yes",
      priorClaim: "no",
    });
    setNotice(
      "Synthetic example loaded. These are preset facts, not an OCR result.",
    );
  }
  async function copy(text) {
    try {
      await navigator.clipboard.writeText(text);
      setNotice("Copied.");
    } catch {
      setNotice("Clipboard unavailable. Select the request text to copy it.");
    }
  }
  function download() {
    sendEvent("pack_downloaded",facts.mode,facts.country);
    const pack = {
      preparedAt: new Date().toISOString(),
      state: "prepared_not_submitted",
      example: sample,
      modelExtraction: extraction
        ? {
            provider: extraction.provider,
            model: extraction.model,
            confidence: extraction.confidence,
            uncertainties: extraction.uncertainties,
          }
        : null,
      ...result,
    };
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(pack, null, 2)], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "tikdam-review-pack.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice(
      "Review pack downloaded. It contains the entered invoice details; store it carefully.",
    );
  }
  const input = (key, placeholder = "", type = "text") => (
    <input
      type={type}
      value={facts[key]}
      placeholder={placeholder}
      onChange={(e) => edit(key, e.target.value)}
      maxLength={type === "text" ? 200 : undefined}
      step={type === "number" ? "any" : undefined}
      min={type === "number" ? 0 : undefined}
    />
  );
  const select = (key, options) => (
    <select value={facts[key]} onChange={(e) => edit(key, e.target.value)}>
      {options.map(([v, l]) => (
        <option key={v} value={v}>
          {l}
        </option>
      ))}
    </select>
  );
  function profile() {
    return (
      <aside className="profile">
        <div className="section-heading">
          <span className="iconbox">◎</span>
          <div>
            <h2>Your business</h2>
            <p>The taxpayer that owns this purchase or income.</p>
          </div>
        </div>
        <div className="fields">
          <Field label="Your legal name / business name" wide>
            {input("legalName", "Your actual legal name or entity")}
          </Field>
          <Field label="Business established in" wide>
            {select(
              "businessCountry",
              (config?.countries || []).map((c) => [c.code, c.name]),
            )}
          </Field>
          <Field
            label={`Registration in ${country?.name || "purchase country"}`}
            wide
            hint="Company registration and tax registration are separate."
          >
            {select("registration", [
              ["unknown", "Not sure yet"],
              ["standard", "Ordinary VAT / GST / tax registration"],
              ["none", "Not registered for this tax"],
              ["simplified", "Simplified / pay-only / special regime"],
            ])}
          </Field>
          {facts.mode === "client" && (
            <>
              <Field label="Income recipient’s tax residence" wide>
                {select("taxResidence", [
                  ["unknown", "Not sure"],
                  ...config.countries.map((c) => [c.code, c.name]),
                ])}
              </Field>
              <Field label="Where was the work performed?" wide>
                {select("workCountry", [
                  ["unknown", "Not sure / multiple countries"],
                  ...config.countries.map((c) => [c.code, c.name]),
                ])}
              </Field>
            </>
          )}
          <Field label={country?.idLabel || "Tax details"} wide>
            {input("taxId", "If applicable")}
          </Field>
          <Field label="Billing address" wide>
            <textarea
              value={facts.billingAddress}
              onChange={(e) => edit("billingAddress", e.target.value)}
              rows={2}
              maxLength={500}
              placeholder="The actual buyer’s address"
            />
          </Field>
        </div>
        <div className="profile-note">
          <span>ⓘ</span>
          <p>
            Use the real purchaser’s details. An invoice in a different
            company’s name can require correction.
          </p>
        </div>
        <small className="privacy">
          Your bill and profile stay in this session. Clear them when you’re
          done.
        </small>
      </aside>
    );
  }
  return (
    <>
      <a className="skip" href="#main">
        Skip to Tikdam
      </a>
      <div className="build-note">
        <span>Tikdam V1</span>
        <span>
          Select from {config?.countries.length || 250} countries and territories. Local tax guidance is reviewed for 11; conditional estimates cover narrow scenarios in India, the UK and Singapore.
        </span>
      </div>
      <header>
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setPage("work");
          }}
        >
          tikdam<span>.</span>
        </a>
        <nav>
          <button onClick={() => setPage("coverage")}>
            Coverage & sources
          </button>
          <button onClick={() => setPage("privacy")}>Your data</button>
          <button className="reset" onClick={clear}>
            Clear session
          </button>
        </nav>
      </header>
      <main id="main">
        {!config ? (
          <div className="loading">{error || "Loading Tikdam…"}</div>
        ) : (
          <>
            {page === "coverage" ? (
              <>
                <div className="intro compact">
                  <h1 tabIndex={-1} ref={heading}>
                    Know what’s covered.
                  </h1>
                  <p>
                    Guidance is different from a complete tax calculator. Check
                    the route, scenario and effective period.
                  </p>
                </div>
                <div className="coverage-grid">
                  {config.countries.filter(c => c.sources.length).map((c) => (
                    <article key={c.code}>
                      <div className="country-code">{c.code}</div>
                      <h2>{c.name}</h2>
                      <p>{c.coverage}</p>
                      <small>
                        Basic billing guidance and source-linked next steps.
                        Cross-border and specialist categories need review.
                      </small>
                      <Sources sources={c.sources} />
                    </article>
                  ))}
                </div>
                <p>Other countries and territories are selectable for general invoice and evidence preparation. Tikdam has not reviewed their local tax rules or validated a numerical claim.</p>
                <button className="primary" onClick={() => setPage("work")}>
                  Back to my check
                </button>
              </>
            ) : page === "privacy" ? (
              <article className="privacy-page">
                <h1 tabIndex={-1} ref={heading}>
                  Your invoice, your choice.
                </h1>
                <p>
                  Tikdam keeps no stored copy of bills or profiles on this
                  server. The working session lives in your browser memory and
                  clears on reload or “Clear session”. We retain minimal operational metadata, such as workflow country, processing status, timestamps and model usage, with daily cleanup eligibility after 30 days. Explicit feedback becomes eligible for cleanup after 90 days. Processing a backlog can take longer. A minimal spending ledger is retained to enforce the campaign budget. It contains no invoice contents. Cloudflare and Meta have their own service terms.
                </p>
                <h2>When you ask Muse to read a bill</h2>
                <p>
                  After you select the consent checkbox and press “Read with
                  Muse”, the file is sent through Tikdam's server to Meta
                  Model API for processing. This app uses standard Muse Spark
                  and requests no stored response. Meta’s own service terms and
                  data handling still apply; “no stored response” is not a
                  promise about all provider logs or retention.
                </p>
                <p>
                  Manual entry and pre-purchase checklists do not send your
                  invoice to Meta. A downloaded review pack contains the invoice
                  facts you entered and should be kept securely.
                </p>
                <p>Asking the assistant sends the conversation and entered form facts to Meta only after your consent and an explicit request. Invoice selection alone does not upload a file. Clearing the session resets browser fields and the anonymous session cookie; retained operational records follow the periods above. Feedback is optional. Avoid private identifiers in feedback.</p>
                <a
                  href="https://dev.meta.ai/legal/terms-of-service"
                  target="_blank"
                  rel="noreferrer"
                >
                  Meta Model API terms ↗
                </a>
                <button className="primary" onClick={() => setPage("work")}>
                  Back to my check
                </button>
              </article>
            ) : (
              <>
                {result ? (
                  <div className="intro compact">
                    <div>
                      <h1>A clearer next step.</h1>
                      <p>Review the route, the evidence and what to do next.</p>
                    </div>
                  </div>
                ) : (
                  <section className="landing-hero" aria-labelledby="landing-title">
                    <div className="hero-copy">
                      <h1 id="landing-title">Check the bill first.</h1>
                      <p className="hero-lede">
                        Tikdam helps businesses anywhere review purchase invoices and organise the evidence.
                        Local tax guidance is available for 11 jurisdictions; most locations need a local rules review.
                      </p>
                      <button
                        className="primary hero-action"
                        onClick={() => {
                          selectMode("purchase");
                          document.getElementById("workflow")?.scrollIntoView?.({behavior:window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth"});
                        }}
                      >
                        Review a purchase bill <span aria-hidden="true">↗</span>
                      </button>
                      <p className="hero-scope">
                        India’s conditional estimate currently covers ordinary office stationery
                        under specific conditions. Tikdam does not check GST portals or file a claim.
                      </p>
                    </div>
                    <div className="invoice-illustration">
                      <div className="invoice-heading">
                        <span>Purchase review</span>
                        <span>Example · GST / IN</span>
                      </div>
                      <p className="invoice-title">One bill.<br/>Several checks.</p>
                      <div className="invoice-questions">
                        <div><span>Buyer</span><strong>Whose name is on it?</strong><small>Buyer and GSTIN</small></div>
                        <div><span>Purchase</span><strong>What was bought?</strong><small>Purchase and business use</small></div>
                        <div><span>Evidence</span><strong>What can you confirm?</strong><small>Evidence and return checks</small></div>
                      </div>
                      <p className="invoice-foot">Your answers guide the review. Government records are not verified here.</p>
                    </div>
                  </section>
                )}
                {!result && (
                  <section id="workflow" className="workflow-start" aria-labelledby="workflow-title">
                    <div className="workflow-heading">
                      <h2 id="workflow-title">Choose what you need to do</h2>
                      <div className="model-status">
                        <span className={config.modelConfigured ? "connected-dot" : "offline-dot"} />
                        <div>
                          {config.modelConfigured ? "Muse Spark available" : "Manual checks available"}
                          <small>{config.modelConfigured ? "Documents sent only with your permission" : "AI bill reading is paused. You can still enter details manually."}</small>
                        </div>
                      </div>
                    </div>
                    <div className="mode-tabs" role="group" aria-label="Choose your task">
                    {modes.map(([id, title, desc, icon]) => (
                      <button
                        key={id}
                        className={facts.mode === id ? "selected" : ""}
                        aria-pressed={facts.mode === id}
                        onClick={() => selectMode(id)}
                      >
                        <span className="mode-icon">{icon}</span>
                        <span>
                          <strong>{title}</strong>
                          <small>{desc}</small>
                        </span>
                        <span className="radio-dot" />
                      </button>
                    ))}
                    </div>
                  </section>
                )}
                {result ? (
                  <div className="result-layout">
                    <article className="result-main">
                      <div className="result-top">
                        <span
                          className={
                            "status " +
                            (result.status === "conditional"
                              ? "conditional"
                              : "")
                          }
                        >
                          {facts.mode === "before"
                            ? "Before you buy"
                            : result.status === "conditional"
                              ? "Conditional estimate"
                              : "Review needed"}
                        </span>
                        <button onClick={() => setResult(null)}>
                          Edit answers
                        </button>
                      </div>
                      {sample && (
                        <div className="example-note">
                          Synthetic example · not an OCR result
                        </div>
                      )}
                      <h2 tabIndex={-1} ref={heading}>
                        {facts.mode === "before"
                          ? "Get the billing right."
                          : result.title}
                      </h2>
                      <p>
                        {facts.mode === "before"
                          ? result.route.text
                          : result.plan.route.text}
                      </p>
                      {facts.mode !== "before" && (
                        <div className="benefit-box">
                          <small>{result.benefit.label}</small>
                          <strong>
                            {result.benefit.amount !== null
                              ? `${result.benefit.currency} ${result.benefit.amount}`
                              : "Amount not determined"}
                          </strong>
                          <p>
                            {result.benefit.amount !== null
                              ? "A potential offset in a return, subject to conditions. This is not a promised cash refund."
                              : "Resolve the conditions below before expecting a credit or cash payment."}
                          </p>
                          {result.calculation && (
                            <div className="formula">{result.calculation}</div>
                          )}
                        </div>
                      )}
                      {facts.mode === "before" ? (
                        <div className="checklist">
                          {result.checklist.map((x, i) => (
                            <section key={x.id}>
                              <span>{i + 1}</span>
                              <div>
                                <h3>{x.title}</h3>
                                <p>{x.text}</p>
                              </div>
                            </section>
                          ))}
                        </div>
                      ) : (
                        <>
                          {result.reconciliation && (
                            <div className="payment-gap">
                              <h3>Invoice to payment</h3>
                              <p>
                                Invoice less received: {facts.currency}{" "}
                                {result.reconciliation.gap}
                                <br />
                                Reported tax withheld: {facts.currency}{" "}
                                {result.reconciliation.reportedWithholding}
                                <br />
                                Difference still to explain: {
                                  facts.currency
                                }{" "}
                                {result.reconciliation.unexplained}
                              </p>
                              <small>
                                Payment differences are not proof of tax or
                                refund entitlement.
                              </small>
                            </div>
                          )}
                          <h3>What needs your attention</h3>
                          {result.issues.length ? (
                            <ul className="issues">
                              {result.issues.map((x) => (
                                <li key={x.code}>{x.text}</li>
                              ))}
                            </ul>
                          ) : (
                            <ul className="issues conditions">
                              {result.conditions?.map((x) => (
                                <li key={x}>{x}</li>
                              ))}
                            </ul>
                          )}
                          <h3>How to move the claim forward</h3>
                          <ol className="next-steps">
                            {result.nextSteps.map((x) => (
                              <li key={x}>{x}</li>
                            ))}
                          </ol>
                          <details className="more">
                            <summary>
                              Invoice preparation & evidence checklist
                            </summary>
                            {result.plan.checklist.map((x) => (
                              <p key={x.id}>
                                <strong>{x.title}. </strong>
                                {x.text}
                              </p>
                            ))}
                          </details>
                        </>
                      )}
                      <Sources sources={result.sources} />
                      <button className="primary" onClick={download}>
                        Download review pack <span>↓</span>
                      </button>
                      <p className="small-muted">
                        Prepared for review. No claim has been filed or paid.
                      </p>
                    </article>
                    <aside className="result-aside">
                      <div className="paper">
                        <span className="paper-label">
                          {facts.mode === "client"
                            ? "For your client"
                            : "For your seller"}
                        </span>
                        <h3>
                          {facts.mode === "client"
                            ? "Request deduction evidence."
                            : facts.mode === "before"
                              ? "Ask before checkout."
                              : "Request the right document."}
                        </h3>
                        <textarea
                          aria-label="Document evidence request"
                          readOnly
                          value={
                            facts.mode === "client"
                              ? result.clientRequest
                              : (facts.mode === "before" ? result : result.plan)
                                  .sellerRequest
                          }
                          rows={14}
                        />
                        <button
                          className="secondary filled"
                          onClick={() =>
                            copy(
                              facts.mode === "client"
                                ? result.clientRequest
                                : (facts.mode === "before"
                                    ? result
                                    : result.plan
                                  ).sellerRequest,
                            )
                          }
                        >
                          {facts.mode === "client"
                            ? "Copy certificate request"
                            : "Copy invoice request"}
                        </button>
                      </div>
                      <div className="caution">
                        <h3>Keep these in mind</h3>
                        <ul>
                          {(facts.mode === "client"
                            ? [
                                "Collect the deduction certificate before expecting a tax credit.",
                                "Review source-country relief and residence-country tax together.",
                                "Do not assume every payment shortfall is tax withheld.",
                              ]
                            : (facts.mode === "before" ? result : result.plan)
                                .warnings
                          ).map((x) => (
                            <li key={x}>{x}</li>
                          ))}
                        </ul>
                      </div>
                    </aside>
                  </div>
                ) : (
                  <div className="workspace">
                    <section className="work-main">
                      <div className="section-heading">
                        <span className="iconbox">
                          {facts.mode === "before" ? "↗" : "▤"}
                        </span>
                        <div>
                          <h2>
                            {facts.mode === "before"
                              ? "A few facts before you buy"
                              : facts.mode === "client"
                                ? "Check the invoice and payment"
                                : "Start with your bill"}
                          </h2>
                          <p>
                            {facts.mode === "before"
                              ? "We’ll turn them into a checklist for you and your seller."
                              : "Upload a document or enter its details yourself."}
                          </p>
                        </div>
                      </div>
                      {facts.mode !== "before" && (
                        <>
                          <div
                            className="upload"
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => {
                              e.preventDefault();
                              chooseFile(e.dataTransfer.files[0]);
                            }}
                          >
                            {preview ? (
                              <img
                                src={preview}
                                className="bill-preview"
                                alt="Selected bill preview"
                              />
                            ) : (
                              <div className="document-icon">▤</div>
                            )}
                            <h3>{file ? file.name : "Drop a bill here"}</h3>
                            <p>
                              PNG, JPEG, WebP or PDF · up to 6 MB · PDF up to 10
                              pages
                            </p>
                            <input
                              ref={fileRef}
                              type="file"
                              id="bill-file"
                              accept="image/png,image/jpeg,image/webp,application/pdf"
                              className="sr-only"
                              onChange={(e) => chooseFile(e.target.files[0])}
                            />
                            <label
                              className="secondary file-button"
                              htmlFor="bill-file"
                            >
                              {file
                                ? "Choose a different bill"
                                : "Choose a bill"}
                            </label>
                            <button
                              className="text-button"
                              onClick={loadSample}
                            >
                              Use an example
                            </button>
                            <a
                              className="sample-download"
                              href="/example-invoice.pdf"
                              download
                            >
                              Download example PDF
                            </a>
                          </div>
                          {file && (
                            <div className="consent-block">
                              <label className="checkbox">
                                <input
                                  type="checkbox"
                                  checked={consent}
                                  onChange={(e) => setConsent(e.target.checked)}
                                />
                                <span>
                                  Send this bill to Meta Model API so Muse Spark
                                  can extract its visible details.{" "}
                                  <button
                                    className="inline-link"
                                    onClick={() => setPage("privacy")}
                                  >
                                    How data is handled
                                  </button>
                                </span>
                              </label>
                              <button
                                className="primary"
                                disabled={
                                  !consent ||
                                  !config.modelConfigured ||
                                  Boolean(busy) || !challengeToken
                                }
                                onClick={extract}
                              >
                                {busy === "Reading bill"
                                  ? "Reading bill…"
                                  : "Read with Muse"}
                              </button>
                              {consent&&config.modelConfigured&&<TurnstileChallenge siteKey={config.turnstileSiteKey} action="extract" onToken={setChallengeToken} resetKey={challengeReset}/>}
                              {!config.modelConfigured && (
                                <small>
                                  {config.ai?.reason || "AI is paused. Enter invoice details manually."}
                                </small>
                              )}
                            </div>
                          )}
                          {extraction && (
                            <div className="extraction-note">
                              <strong>
                                Extracted with {extraction.model} ·{" "}
                                {extraction.confidence} confidence
                              </strong>
                              <p>
                                Check every field below. Extraction is not an
                                eligibility decision.
                              </p>
                              {extraction.uncertainties.length > 0 && (
                                <ul>
                                  {extraction.uncertainties.map((x) => (
                                    <li key={x}>{x}</li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          )}
                          {sample && (
                            <div className="example-note">
                              Example data · fictional identifiers · not AI
                              extraction
                            </div>
                          )}
                          <div className="divider">
                            <span>Review or enter invoice details</span>
                          </div>
                        </>
                      )}
                      <div className="fields">
                        <Field
                          label={
                            facts.mode === "client"
                              ? "Client / source country"
                              : "Purchase / tax country"
                          }
                        >
                          {select(
                            "country",
                            config.countries.map((c) => [c.code, c.name]),
                          )}
                        </Field>
                        {!country?.sources?.length && <p className="source-gap">Tikdam has not reviewed this location's tax rules. This form prepares evidence only; no credit or refund amount is calculated.</p>}
                        <Field label="What is the purchase or service?">
                          {input("item", "e.g. office supplies or design work")}
                        </Field>
                        <Field label="Category">
                          {select("category", [
                            ["other", "Choose a category"],
                            [
                              "ordinary",
                              "Ordinary operating supplies / services",
                            ],
                            ["equipment", "Equipment / capital asset"],
                            ["vehicle", "Vehicle"],
                            ["travel", "Travel / accommodation"],
                            ["entertainment", "Meals / entertainment"],
                          ])}
                        </Field>
                        <Field label="Business use (%)">
                          {
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={facts.businessUse}
                              onChange={(e) =>
                                edit(
                                  "businessUse",
                                  e.target.value === ""
                                    ? 0
                                    : Number(e.target.value),
                                )
                              }
                            />
                          }
                        </Field>
                        {["US", "CA"].includes(facts.country) && (
                          <Field label="State / province / locality" wide>
                            {input(
                              "region",
                              "Required for location-specific review",
                            )}
                          </Field>
                        )}
                        {facts.mode !== "before" && (
                          <>
                            <Field label="Document type">
                              {select("documentType", [
                                ["unknown", "Not sure"],
                                ["invoice", "Final invoice"],
                                ["quote", "Quote / pro-forma"],
                                ["receipt", "Receipt"],
                              ])}
                            </Field>
                            <Field label="Invoice date">
                              {input("invoiceDate", "", "date")}
                            </Field>
                            <Field label="Invoice number">
                              {input("invoiceNumber")}
                            </Field>
                            <Field
                              label={
                                facts.mode === "client"
                                  ? "Customer named on invoice"
                                  : "Buyer named on invoice"
                              }
                            >
                              {input("buyerName")}
                            </Field>
                            <Field
                              label={
                                facts.mode === "client"
                                  ? "Issuer / your business"
                                  : "Supplier name"
                              }
                            >
                              {input("supplierName")}
                            </Field>
                            <Field label="Supplier tax identifier">
                              {input("supplierTaxId")}
                            </Field>
                            <Field label="Currency (three-letter code)" hint="Use the code shown on your invoice, such as EUR or USD.">
                              <input value={facts.currency} onChange={e => edit('currency', e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3))} maxLength={3} placeholder="e.g. EUR" />
                            </Field>
                            <Field label="Net amount">
                              {input("net", "0.00", "number")}
                            </Field>
                            <Field label="Tax shown on invoice">
                              {input("tax", "0.00", "number")}
                            </Field>
                            <Field label="Total amount">
                              {input("gross", "0.00", "number")}
                            </Field>
                            {facts.mode === "client" ? (
                              <>
                                <Field label="Amount received">
                                  {input("amountReceived", "0.00", "number")}
                                </Field>
                                <Field label="Tax reportedly withheld">
                                  {input("withheld", "0.00", "number")}
                                </Field>
                              </>
                            ) : (
                              <>
                                <Field label="Business activity">
                                  {select("taxableActivity", [
                                    ["unknown", "Not sure"],
                                    ["fully", "Fully taxable activity"],
                                    ["mixed", "Mixed taxable / exempt"],
                                    ["exempt", "Exempt activity"],
                                  ])}
                                </Field>
                                <Field label="Supplier’s tax regime">
                                  {select("supplierRegime", [
                                    ["unknown", "Not sure"],
                                    ["ordinary", "Ordinary registration"],
                                    [
                                      "simplified",
                                      "OVR / simplified / special",
                                    ],
                                  ])}
                                </Field>
                                <Field label="Has this invoice been paid?">
                                  {select("paid", [
                                    ["unknown", "Not sure"],
                                    ["yes", "Yes"],
                                    ["no", "No"],
                                  ])}
                                </Field>
                                <Field label="Already claimed or refunded?">
                                  {select("priorClaim", [
                                    ["unknown", "Not sure"],
                                    ["no", "No"],
                                    ["yes", "Yes / partly"],
                                  ])}
                                </Field>
                              </>
                            )}
                          </>
                        )}
                      </div>
                      {facts.mode === "purchase" && facts.country === "IN" && (
                        <fieldset className="india-checks">
                          <legend>India stationery checks</legend>
                          <p>These are your or your preparer's assertions, not government verification. Answer only after checking the evidence. Unknown answers require review.</p>
                          <Field label="Type of purchase">
                            <select value={facts.indiaChecks.purchaseKind} onChange={e=>edit("indiaChecks",{...facts.indiaChecks,purchaseKind:e.target.value})}>
                              <option value="unknown">Not sure</option><option value="office_stationery">Ordinary office stationery</option><option value="other">Other purchase</option>
                            </select>
                          </Field>
                          {(config.indiaCheckDefinitions||[]).map(check=><Field key={check.key} label={check.label} hint={check.provision} wide>
                            <select value={facts.indiaChecks[check.key]} onChange={e=>edit("indiaChecks",{...facts.indiaChecks,[check.key]:e.target.value})}>
                              <option value="unknown">Not checked / not sure</option><option value="yes">Checked and met</option><option value="no">Not met</option>
                            </select>
                          </Field>)}
                        </fieldset>
                      )}
                      {facts.mode !== "before" && (
                        <div className="confirmations">
                          <label className="checkbox">
                            <input
                              type="checkbox"
                              checked={facts.invoiceConfirmed}
                              onChange={(e) =>
                                edit("invoiceConfirmed", e.target.checked)
                              }
                            />
                            <span>
                              I reviewed these invoice details and corrected any
                              extraction errors.
                            </span>
                          </label>
                          {facts.mode === "client" && (
                            <label className="checkbox">
                              <input
                                type="checkbox"
                                checked={facts.certificate}
                                onChange={(e) =>
                                  edit("certificate", e.target.checked)
                                }
                              />
                              <span>
                                I have the client’s withholding certificate.
                              </span>
                            </label>
                          )}
                        </div>
                      )}
                      <div className="form-end">
                        <button
                          className="primary"
                          onClick={run}
                          disabled={Boolean(busy)}
                        >
                          {busy === "Checking"
                            ? "Checking…"
                            : facts.mode === "before"
                              ? "Build my buying checklist"
                              : "Find my next step"}
                          <span>↗</span>
                        </button>
                        <p>
                          {facts.mode === "before"
                            ? "No invoice needed yet."
                            : "Review facts first. Eligibility depends on the applicable rules."}
                        </p>
                      </div>
                    </section>
                    {profile()}
                  </div>
                )}
                <AssistantPanel key={sessionVersion} facts={facts} result={result} config={config} onPropose={applyProposals}/>
                <FeedbackPanel key={`feedback-${sessionVersion}`} mode={facts.mode} country={facts.country}/>
              </>
            )}
          </>
        )}
        {error && (
          <div className="message error" role="alert">
            {error}
          </div>
        )}
        {notice && (
          <div className="message notice" role="status">
            {notice}
          </div>
        )}
        <footer>
          <span>Clear facts. Better prepared.</span>
          <span>Estimates for review. No automatic filings.</span>
        </footer>
      </main>
    </>
  );
}
