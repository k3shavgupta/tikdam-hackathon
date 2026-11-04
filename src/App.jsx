import React, { useState, useEffect, useRef } from "react";
import {api as requestApi, ensureSession, sendEvent, resetSession} from "./api.mjs";
import {AssistantPanel} from "./components/AssistantPanel.jsx";
import {FeedbackPanel} from "./components/FeedbackPanel.jsx";
import {TurnstileChallenge} from "./components/TurnstileChallenge.jsx";
import {AccountControls} from './auth/CustomerAuth.jsx';
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
function updateFacts(facts, changes, countries) {
  const next = {...facts, invoiceConfirmed: false};
  if (changes.country && changes.country !== facts.country) {
    // Preserve the established business location and the currency of entered amounts.
    const hasAmounts = ["net", "tax", "gross", "amountReceived", "withheld"].some(key => facts[key] !== "");
    if (!hasAmounts) next.currency = countries.find(country => country.code === changes.country)?.currency || '';
  }
  return {...next, ...changes};
}

export default function App() {
  const [config, setConfig] = useState(null),
    [detailsOpen,setDetailsOpen] = useState(false),
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
    infoHeading = useRef(null),
    resultHeading = useRef(null),
    returnFocus = useRef(null),
    generation = useRef(0);
  function loadConfig() {
    setError("");
    api("config")
      .then((c)=>{setConfig(c);ensureSession().catch(()=>{});})
      .catch(() =>
        setError("Tikdam couldn’t load the checker. Check your connection and try again."),
      );
  }
  useEffect(loadConfig, []);
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );
  useEffect(() => {
    if (page !== "work") infoHeading.current?.focus();
    else if (returnFocus.current) {
      returnFocus.current.focus();
      returnFocus.current = null;
    }
  }, [page]);
  useEffect(() => {
    if (result) resultHeading.current?.focus({preventScroll: true});
  }, [result]);
  function showInfo(event, nextPage) {
    returnFocus.current = event.currentTarget;
    setPage(nextPage);
  }
  const country = config?.countries.find((c) => c.code === facts.country);
  function reviewDetails(){setResult(null);setDetailsOpen(true);}
  useEffect(()=>{if(detailsOpen){const panel=document.getElementById('review-details');panel?.focus({preventScroll:true});panel?.scrollIntoView?.({behavior:'instant',block:'start'});}},[detailsOpen,result]);
  useEffect(()=>{if(result)document.querySelector('.result-main')?.scrollIntoView?.({behavior:'instant',block:'start'});},[result]);
  function edit(key, value) {
    generation.current++;
    setBusy("");
    setFacts(f => updateFacts(f, {[key]: value}, config.countries));
    setResult(null);
    setError("");
    setNotice("");
  }
  function applyProposals(proposals){
    const allowed=new Set(["mode","country","businessCountry","item","category","businessUse","currency","taxResidence","workCountry"]);
    generation.current++;
    const changes=Object.fromEntries(Object.entries(proposals).filter(([key])=>allowed.has(key)));
    setBusy("");
    setError("");
    setFacts(f=>updateFacts(f,changes,config.countries));
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
    resetSession().catch(()=>setError("Your details were cleared here. Reconnect and choose Clear session again to close the server session."));
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
    setDetailsOpen(false);
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
        Skip to purchase check
      </a>
      <header>
        <a
          className="brand"
          href="/"
          aria-label="Tikdam home"
        >
          <img src="/brand/logo.svg" alt="Tikdam" />
        </a>
        <nav>
          <a className="home-link" href="/">Home</a>
          <button onClick={event => showInfo(event, "coverage")}>
            Coverage & sources
          </button>
          <button onClick={event => showInfo(event, "privacy")}>Your data</button>
          <button className="reset" onClick={clear}>
            Clear session
          </button>
          <AccountControls />
        </nav>
      </header>
      <main id="main">
        {!config ? (
          <div className="loading"><p role="status">{error || "Loading Tikdam…"}</p>{error && <button className="secondary" onClick={loadConfig}>Try again</button>}</div>
        ) : (
          <>
            {page === "coverage" ? (
              <>
                <div className="intro compact">
                  <h1 tabIndex={-1} ref={infoHeading}>
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
                <p>Optional accounts are managed by Clerk, which processes your sign-in and account details. Tikdam verifies your account session but does not save checks or conversations to your account yet. Clear session clears your working check; use the account menu to sign out.</p>
                <h1 tabIndex={-1} ref={infoHeading}>
                  Your invoice, your choice.
                </h1>
                <p>
                  Tikdam keeps no stored copy of bills or profiles on this
                  server. The working session lives in your browser memory and
                  clears on reload or “Clear session”. We retain minimal operational metadata, such as workflow country, a broad chat topic label, processing status, timestamps and model usage, with daily cleanup eligibility after 30 days. We do not save chat question text in those records. Explicit feedback becomes eligible for cleanup after 90 days. Processing a backlog can take longer. A minimal spending ledger is retained to enforce the campaign budget. It contains no invoice contents. Cloudflare and the selected AI provider have their own service terms.
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
                <p>Asking the assistant sends recent messages and case details to {config.provider === 'Baseten' ? 'Baseten' : 'Meta'} after you consent and send a message. Tikdam replaces the names, tax identifiers, billing address and invoice number in their form fields with presence indicators before contacting the provider. Free-text messages and purchase descriptions are sent as written. Invoice selection alone does not upload a file. Clearing the session resets browser fields and the anonymous session cookie; retained operational records follow the periods above. Feedback is optional. Avoid private identifiers in feedback.</p>
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
            ) : null}
            <div hidden={page !== "work"}>
              <>
                <div className="intro chat-intro">
                  <div>
                    <div className="eyebrow">
                      <span className="mini-dot" />
                      Your Tikdam check
                    </div>
                    <h1>
                      {result ? (
                        "A clearer next step."
                      ) : (
                        <>
                          Let’s work it out.
                        </>
                      )}
                    </h1>
                    <p>
                      {result
                        ? "Review the route, the evidence and what to do next."
                        : "Tell Tikdam what happened or what you’re planning. We’ll take it one question at a time."}
                    </p>
                    {!result && <p className="app-scope">Choose from {config.countries.length} locations. Local tax guidance is reviewed for 11; numerical checks cover narrow India, UK and Singapore cases.</p>}
                  </div>
                </div>
                <div className="chat-layout">
                  <AssistantPanel key={sessionVersion} facts={facts} result={result} config={config} onPropose={applyProposals} conversational onReview={reviewDetails} context={<div className="chat-context">
                    <label><span>I want to</span><select aria-label="What would you like help with?" value={facts.mode} onChange={event=>selectMode(event.target.value)}>{modes.map(([id,title])=><option key={id} value={id}>{title}</option>)}</select></label>
                    <details className="chat-location"><summary><span>Location</span><strong>{country?.name} {facts.mode==='client'?'payment':'purchase'} · {config.countries.find(c=>c.code===facts.businessCountry)?.name} business</strong><span className="chat-edit-location">Edit</span></summary>
                      <div className="chat-location-fields">
                        <label><span>{facts.mode==='client'?'Payment from':'Purchase in'}</span><select aria-label={facts.mode==='client'?'Payment country':'Purchase country'} value={facts.country} onChange={event=>edit('country',event.target.value)}>{config.countries.map(c=><option key={c.code} value={c.code}>{c.name}</option>)}</select></label>
                        <label><span>Business based in</span><select aria-label="Business country" value={facts.businessCountry} onChange={event=>edit('businessCountry',event.target.value)}>{config.countries.map(c=><option key={c.code} value={c.code}>{c.name}</option>)}</select></label>
                        <small>Changing a location starts a new conversation.</small>
                      </div>
                    </details>
                  </div>}/>
                  <div className="chat-next-step"><span>Ready to check the details?</span><button className="secondary" onClick={reviewDetails} aria-expanded={detailsOpen} aria-controls="review-details">Review details</button>{facts.mode==='before'&&<button className="primary" onClick={run} disabled={Boolean(busy)}>{busy?'Checking…':'Build my buying checklist'}</button>}</div>
                </div>
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
                        <button onClick={reviewDetails}>
                          Edit answers
                        </button>
                      </div>
                      {sample && (
                        <div className="example-note">
                          Synthetic example · not an OCR result
                        </div>
                      )}
                      <h2 tabIndex={-1} ref={resultHeading}>
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
                              : "Review the evidence and next steps below."}
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
                          <h3>Next steps</h3>
                          <ol className="next-steps">
                            {result.nextSteps.map((x) => (
                              <li key={x}>{x}</li>
                            ))}
                          </ol>
                          <details className="more">
                            <summary>
                              {facts.mode === "client" ? "Payment evidence checklist" : "Invoice preparation & evidence checklist"}
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
                  <div className="workspace" id="review-details" tabIndex={-1} hidden={!detailsOpen}>
                    <section className="work-main">
                      <button className="back-to-chat" onClick={()=>{setDetailsOpen(false);document.getElementById('tk-assistant-title')?.focus();}}>Back to conversation ↑</button>
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
                                    onClick={event => showInfo(event, "privacy")}
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
                                  : "Read with Muse"}{" "}
                                <span>✦</span>
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
                                    ...(facts.country === "SG" ? [["ovr", "Overseas Vendor Registration (OVR)"]] : []),
                                    ["simplified", "Other simplified / special regime"],
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
                {result&&<FeedbackPanel key={`feedback-${sessionVersion}`} mode={facts.mode} country={facts.country}/>}
              </>
            </div>
          </>
        )}
        {config && error && (
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
