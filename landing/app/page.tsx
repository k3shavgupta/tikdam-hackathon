"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  CircleHelp,
  FileCheck2,
  Globe2,
  Menu,
  MessageCircleMore,
  ReceiptText,
  SearchCheck,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";

type CaseId = "stationery" | "phone" | "missing" | "personal" | "wrong" | "uk";
type Verdict =
  | "Conditional"
  | "Not eligible"
  | "Insufficient information"
  | "Unsupported";
type DemoCase = {
  id: CaseId;
  title: string;
  jurisdiction: string;
  item: string;
  user: string;
  reply: string;
  verdict: Verdict;
  amount: string;
  amountLabel: string;
  explanation: string;
  assumptions: string[];
  conditions: string[];
  documents: string[];
  source?: { label: string; url: string };
};

const cases: Record<CaseId, DemoCase> = {
  stationery: {
    id: "stationery",
    title: "Work stationery",
    jurisdiction: "India",
    item: "Office stationery",
    user: "I bought office stationery for ₹1,180. The invoice shows ₹180 GST. It's all for my business.",
    reply:
      "Got it. Are you GST registered, and do you have a valid tax invoice in your business name?",
    verdict: "Conditional",
    amount: "₹180",
    amountLabel: "Illustrative candidate input tax, not cash saved",
    explanation:
      "The bill's stated GST may be a candidate input tax credit if every applicable condition is met. Tikdam has not verified your registration, supplier, return, or invoice.",
    assumptions: [
      "₹180 GST is shown on the example invoice",
      "100% business use is asserted",
      "Ordinary office stationery only",
    ],
    conditions: [
      "Confirm GST registration and taxable activity",
      "Confirm recipient details and valid tax invoice",
      "Review receipt, supplier reporting, payment, time limits and blocked credits",
    ],
    documents: [
      "Tax invoice",
      "Proof of receipt and payment",
      "Business-use record",
    ],
    source: {
      label: "CBIC, CGST Act sections 16 and 17 (2021 text; check amendments)",
      url: "https://cbic-gst.gov.in/pdf/CGST-Act-Updated-31082021.pdf",
    },
  },
  phone: {
    id: "phone",
    title: "Mixed-use phone",
    jurisdiction: "India",
    item: "Phone, 60% work use",
    user: "Can I buy a phone and use it 60% for work?",
    reply:
      "Mixed business and personal use needs a separate attribution review. What is the invoice tax, and how will you document work use?",
    verdict: "Conditional",
    amount: "No amount",
    amountLabel: "Current calculator does not cover this case",
    explanation:
      "Business use alone does not establish a claim. The current India numerical route is limited to ordinary office stationery with 100% business use.",
    assumptions: [
      "60% work use is your estimate",
      "No invoice or registration facts supplied",
    ],
    conditions: [
      "Check item-specific treatment and any blocked-credit rules",
      "Confirm registration, taxable activity, and the tax period",
    ],
    documents: ["Tax invoice", "Work-use log", "Proof of payment"],
    source: {
      label: "CBIC, CGST Act sections 16 and 17 (2021 text; check amendments)",
      url: "https://cbic-gst.gov.in/pdf/CGST-Act-Updated-31082021.pdf",
    },
  },
  missing: {
    id: "missing",
    title: "Missing details",
    jurisdiction: "India",
    item: "Camera",
    user: "I bought a camera. Can I claim something?",
    reply:
      "First, which tax regime are you asking about, what did the invoice show, and what share is for business?",
    verdict: "Insufficient information",
    amount: "No amount",
    amountLabel: "Ask the next useful question first",
    explanation:
      "A purchase category is not enough to determine eligibility or an amount. The demo stops here instead of guessing.",
    assumptions: [
      "No price, tax amount, business use, or registration supplied",
    ],
    conditions: [
      "Provide the purchase date and invoice",
      "Specify the intended tax benefit and business use",
    ],
    documents: ["Purchase invoice", "Business-use record"],
  },
  personal: {
    id: "personal",
    title: "Personal purchase",
    jurisdiction: "India",
    item: "Desk, personal use",
    user: "I bought a desk only for my personal room. Can I claim business GST credit?",
    reply:
      "This purchase has no business use. The business-use condition for input tax credit is not met in this example.",
    verdict: "Not eligible",
    amount: "₹0",
    amountLabel: "No candidate business input credit",
    explanation:
      "A purchase used only for personal purposes does not meet the stated business-use condition. This says nothing about other tax questions or a different purchase.",
    assumptions: [
      "0% business use",
      "India GST input credit is the benefit being asked about",
    ],
    conditions: ["Recheck only if the actual use or facts differ"],
    documents: ["Keep the invoice with your records"],
    source: {
      label: "CBIC, CGST Act sections 16 and 17 (2021 text; check amendments)",
      url: "https://cbic-gst.gov.in/pdf/CGST-Act-Updated-31082021.pdf",
    },
  },
  wrong: {
    id: "wrong",
    title: "Wrong routing",
    jurisdiction: "Canada",
    item: "Laptop",
    user: "I'm in Canada. Can I claim this laptop?",
    reply:
      "This preview has no Canadian laptop rule. Choose a covered case or review it with a local professional.",
    verdict: "Unsupported",
    amount: "No amount",
    amountLabel: "No cross-country guess",
    explanation:
      "Tikdam will not apply an Indian or UK rule to a Canadian purchase. This is a routing example, not a Canadian tax answer.",
    assumptions: ["Canada was selected"],
    conditions: ["Choose a supported scenario to continue"],
    documents: ["Keep your invoice for local review"],
  },
  uk: {
    id: "uk",
    title: "UK laptop preview",
    jurisdiction: "United Kingdom",
    item: "Laptop, 50% work use",
    user: "I'm a sole trader. I bought a £600 laptop and use it half for work.",
    reply:
      "HMRC's AIA example reduces a £600 laptop's capital allowance by 50% for private use. Your tax saving depends on your full tax position.",
    verdict: "Conditional",
    amount: "£300",
    amountLabel: "Illustrative allowance, not tax saved",
    explanation:
      "This is a static HMRC example used to preview a second jurisdiction. It is not a live Tikdam calculator result or an entitlement decision.",
    assumptions: [
      "£600 purchase price",
      "50% business use",
      "Sole trader in HMRC's example",
    ],
    conditions: [
      "Confirm the purchase qualifies for AIA",
      "Review tax year, records, and other allowances",
    ],
    documents: [
      "Purchase invoice",
      "Business-use record",
      "Tax return working papers",
    ],
    source: {
      label: "HMRC, Annual Investment Allowance",
      url: "https://www.gov.uk/capital-allowances/annual-investment-allowance",
    },
  },
};

const nav = [
  { href: "#how", label: "How it works" },
  { href: "#demo", label: "Demo" },
  { href: "#jurisdictions", label: "Jurisdictions" },
  { href: "#faq", label: "FAQ" },
];

function Logo({ light = false }: { light?: boolean }) {
  return (
    <span className={`logo ${light ? "logo-light" : ""}`}>
      <svg viewBox="0 0 32 32" fill="none" aria-hidden="true">
        <path
          d="M5 3h22a2 2 0 0 1 2 2v19l-4 5-5-3-4 3-4-3-5 3-4-5V5a2 2 0 0 1 2-2Z"
          fill="#B6F09C"
          stroke="#121212"
          strokeWidth="2.2"
          strokeLinejoin="round"
        />
        <path
          d="M9 10h14M16 10v9l-3 3-3-3m6 0 2 2 6-7"
          stroke="#121212"
          strokeWidth="2.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span>
        tikdam<span className="logo-dot">.</span>
      </span>
    </span>
  );
}

function Reveal({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y: 24 }}
      whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.18 }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

function DemoReceipt({
  item,
  compact = false,
}: {
  item: DemoCase;
  compact?: boolean;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      key={item.id + String(compact)}
      className={`receipt ${compact ? "receipt-compact" : ""}`}
      initial={reduce ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      <div className="receipt-top">
        <span>
          <ReceiptText size={17} aria-hidden="true" /> Tikdam check
        </span>
        <span>Example only</span>
      </div>
      <div className="receipt-meta">
        <span>Jurisdiction</span>
        <strong>{item.jurisdiction}</strong>
        <span>Item</span>
        <strong>{item.item}</strong>
      </div>
      <div className="receipt-dash" />
      <div className="chat-line chat-user">
        <span className="chat-avatar">You</span>
        <p>{item.user}</p>
      </div>
      <div className="chat-line chat-bot">
        <span className="chat-avatar">
          <Logo />
        </span>
        <p>{item.reply}</p>
      </div>
      <div className="receipt-dash" />
      <div className="receipt-result">
        <span
          className={`verdict verdict-${item.verdict.toLowerCase().replaceAll(" ", "-")}`}
        >
          {item.verdict}
        </span>
        <p className="receipt-amount">{item.amount}</p>
        <p className="amount-label">{item.amountLabel}</p>
        <p className="receipt-explanation">{item.explanation}</p>
      </div>
      {!compact && (
        <>
          <div className="receipt-dash" />
          <div className="receipt-details">
            <div>
              <h4>Assumptions</h4>
              <ul>
                {item.assumptions.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            </div>
            <div>
              <h4>Check before claiming</h4>
              <ul>
                {item.conditions.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </div>
            <div>
              <h4>Keep this proof</h4>
              <ul>
                {item.documents.map((d) => (
                  <li key={d}>
                    <Check size={15} aria-hidden="true" />
                    {d}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="receipt-source">
            {item.source ? (
              <a href={item.source.url} target="_blank" rel="noreferrer">
                Read source: {item.source.label}{" "}
                <ArrowUpRight size={16} aria-hidden="true" />
              </a>
            ) : (
              <span>No country rule or source is applied to this example.</span>
            )}
          </div>
        </>
      )}
      <div className="receipt-teeth" aria-hidden="true" />
    </motion.div>
  );
}

export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [selected, setSelected] = useState<CaseId>("stationery");
  const item = cases[selected];
  const chooseJurisdiction = (value: string) =>
    setSelected(
      value === "India"
        ? "stationery"
        : value === "United Kingdom"
          ? "uk"
          : "wrong",
    );

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="site-header">
        <div className="container nav-shell">
          <a className="logo-link" href="#top" aria-label="Tikdam, back to top">
            <Logo />
          </a>
          <nav className="desktop-nav" aria-label="Main navigation">
            {nav.map((link) => (
              <a key={link.href} href={link.href}>
                {link.label}
              </a>
            ))}
          </nav>
          <a className="button button-lime nav-cta" href="/app">
            Open app <ArrowUpRight size={17} aria-hidden="true" />
          </a>
          <button
            className="menu-button"
            type="button"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            aria-controls="mobile-navigation"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            {menuOpen ? <X size={23} /> : <Menu size={23} />}
          </button>
        </div>
        {menuOpen && (
          <nav
            id="mobile-navigation"
            className="mobile-nav"
            aria-label="Mobile navigation"
          >
            {nav.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
              >
                {link.label}
                <ArrowUpRight size={17} aria-hidden="true" />
              </a>
            ))}
            <a href="/app" onClick={() => setMenuOpen(false)}>
              Open app <ArrowUpRight size={17} aria-hidden="true" />
            </a>
          </nav>
        )}
      </header>

      <main id="main">
        <section id="top" className="hero">
          <div className="container hero-grid">
            <div className="hero-copy">
              <div className="hero-kicker">
                <span className="kicker-line" /> Your pre-purchase reality check
              </div>
              <h1>
                Buying a laptop?
                <br />
                <span className="hero-underlined">Check the tax benefit</span>
                <br />
                BEFORE you pay<span className="hero-period">.</span>
              </h1>
              <p className="hero-sub">
                For freelancers, creators, and small businesses. Tikdam helps
                you see what might qualify, what it might mean, and what proof
                to keep.
              </p>
              <div className="hero-actions">
                <a className="button button-ink" href="/app">
                  Check my purchase <ArrowRight size={18} aria-hidden="true" />
                </a>
                <a className="text-link" href="#how">
                  See how it works{" "}
                  <ArrowDownRight size={18} aria-hidden="true" />
                </a>
              </div>
              <div className="hero-badges">
                <span className="sticker sticker-lime">No login</span>
                <span className="sticker sticker-white">Source-backed</span>
                <span className="sticker sticker-coral">
                  Muse Spark architecture
                </span>
              </div>
            </div>
            <div className="hero-visual">
              <span className="visual-scribble" aria-hidden="true">
                check first ↘
              </span>
              <div className="hero-receipt-wrap">
                <DemoReceipt item={cases.phone} compact />
              </div>
              <div className="visual-note">
                A question before
                <br />a purchase.
              </div>
            </div>
          </div>
        </section>

        <div
          className="marquee"
          aria-label="Purchase examples: phone, laptop, camera, software, desk, microphone"
        >
          <div className="marquee-track" aria-hidden="true">
            {Array.from({ length: 2 }, (_, i) => (
              <span key={i}>
                PHONE <b>✳</b> LAPTOP <b>✳</b> CAMERA <b>✳</b> SOFTWARE{" "}
                <b>✳</b> DESK <b>✳</b> MICROPHONE <b>✳</b>
              </span>
            ))}
          </div>
        </div>

        <section
          className="section questions"
          aria-labelledby="questions-title"
        >
          <div className="container">
            <Reveal className="section-head">
              <span className="section-index">The check</span>
              <h2 id="questions-title">
                Three answers.
                <br />
                One less expensive guess.
              </h2>
              <p>
                Start before checkout. Leave with a clearer question for your
                books or adviser.
              </p>
            </Reveal>
            <div className="question-grid">
              <Reveal className="question-card">
                <div className="question-icon">
                  <SearchCheck size={30} strokeWidth={1.8} aria-hidden="true" />
                </div>
                <span className="question-number">01</span>
                <h3>Could it qualify?</h3>
                <p>
                  See the conditions that matter for your purchase and
                  jurisdiction.
                </p>
                <span className="question-end">Eligibility</span>
              </Reveal>
              <Reveal className="question-card">
                <div className="question-icon">
                  <CircleHelp size={30} strokeWidth={1.8} aria-hidden="true" />
                </div>
                <span className="question-number">02</span>
                <h3>What might it mean?</h3>
                <p>
                  Get a bounded estimate only where a reviewed rule and your
                  facts allow one.
                </p>
                <span className="question-end">Estimate</span>
              </Reveal>
              <Reveal className="question-card">
                <div className="question-icon">
                  <FileCheck2 size={30} strokeWidth={1.8} aria-hidden="true" />
                </div>
                <span className="question-number">03</span>
                <h3>What should you keep?</h3>
                <p>
                  Know which bill, record, or follow-up detail may be needed
                  later.
                </p>
                <span className="question-end">Evidence</span>
              </Reveal>
            </div>
          </div>
        </section>

        <section
          id="demo"
          className="section demo-section"
          aria-labelledby="demo-title"
        >
          <div className="container">
            <Reveal className="demo-heading">
              <div>
                <span className="section-index">Try a case</span>
                <h2 id="demo-title">
                  The answer looks
                  <br />
                  better with the <em>receipts.</em>
                </h2>
              </div>
              <p>
                Tap a case and watch the preview change. This front-end
                illustration uses fixed examples. It does not call Meta or the
                live tax engine.
              </p>
            </Reveal>
            <div className="demo-grid">
              <div className="demo-controls">
                <label className="selector-label" htmlFor="jurisdiction">
                  Selected jurisdiction
                </label>
                <div className="select-wrap">
                  <Globe2 size={19} aria-hidden="true" />
                  <select
                    id="jurisdiction"
                    value={item.jurisdiction}
                    onChange={(event) => chooseJurisdiction(event.target.value)}
                  >
                    <option>India</option>
                    <option>United Kingdom</option>
                    <option>Canada</option>
                  </select>
                  <ChevronDown size={17} aria-hidden="true" />
                </div>
                <div className="coverage-key">
                  <span>
                    <i className="key-dot key-active" /> India: narrow active
                    route
                  </span>
                  <span>
                    <i className="key-dot key-preview" /> UK: preview example
                  </span>
                  <span>
                    <i className="key-dot key-off" /> Other cases: unsupported
                  </span>
                </div>
                <p className="case-label">Pick a test case</p>
                <div className="case-list">
                  {(
                    [
                      "stationery",
                      "phone",
                      "missing",
                      "personal",
                      "wrong",
                      "uk",
                    ] as CaseId[]
                  ).map((id, n) => (
                    <button
                      className={`case-button ${selected === id ? "case-button-active" : ""}`}
                      key={id}
                      type="button"
                      onClick={() => setSelected(id)}
                      aria-pressed={selected === id}
                    >
                      <span className="case-num">0{n + 1}</span>
                      <span>
                        {cases[id].title}
                        <small>{cases[id].jurisdiction}</small>
                      </span>
                      <ArrowUpRight size={18} aria-hidden="true" />
                    </button>
                  ))}
                </div>
                <p className="demo-hint">
                  <ShieldCheck size={18} aria-hidden="true" /> A result can say
                  “I don’t have enough information.”
                </p>
              </div>
              <div className="demo-display">
                <div className="demo-display-head">
                  <span>Interactive preview</span>
                  <span className="demo-live-dot">Fixed example</span>
                </div>
                <p className="sr-only" aria-live="polite">
                  {item.title}: {item.verdict}. {item.amountLabel}.
                </p>
                <DemoReceipt item={item} />
                <div className="status-legend">
                  <span>
                    <i className="legend-green" /> Eligible
                  </span>
                  <span>
                    <i className="legend-amber" /> Conditional
                  </span>
                  <span>
                    <i className="legend-red" /> Not eligible
                  </span>
                  <span>
                    <i className="legend-ink" /> Unsupported
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section
          id="how"
          className="section how-section"
          aria-labelledby="how-title"
        >
          <div className="container">
            <Reveal className="how-heading">
              <span className="section-index">Under the hood</span>
              <h2 id="how-title">
                A little chat.
                <br />A lot of checking.
              </h2>
            </Reveal>
            <div className="flow-grid">
              <Reveal className="flow-step">
                <span>1</span>
                <MessageCircleMore size={29} aria-hidden="true" />
                <h3>Muse Spark understands</h3>
                <p>It asks for the purchase facts that are missing.</p>
              </Reveal>
              <Reveal className="flow-step">
                <span>2</span>
                <Sparkles size={29} aria-hidden="true" />
                <h3>Inputs get structured</h3>
                <p>Your answers become fields the rule engine can validate.</p>
              </Reveal>
              <Reveal className="flow-step">
                <span>3</span>
                <SearchCheck size={29} aria-hidden="true" />
                <h3>Calculator decides</h3>
                <p>
                  Versioned, country-specific code owns the rules and
                  arithmetic.
                </p>
              </Reveal>
              <Reveal className="flow-step">
                <span>4</span>
                <ReceiptText size={29} aria-hidden="true" />
                <h3>Sources explain</h3>
                <p>The result shows assumptions, limits, and source links.</p>
              </Reveal>
            </div>
            <Reveal className="trust-statement">
              <span className="trust-star" aria-hidden="true">
                ✳
              </span>
              <p>
                AI explains. Calculator calculates.
                <br />
                <strong>AI never invents tax rates.</strong>
              </p>
              <span className="trust-stamp">That’s the deal.</span>
            </Reveal>
          </div>
        </section>

        <section
          id="jurisdictions"
          className="section jurisdictions"
          aria-labelledby="jurisdictions-title"
        >
          <div className="container">
            <Reveal className="section-head section-head-split">
              <div>
                <span className="section-index">Coverage</span>
                <h2 id="jurisdictions-title">
                  Different countries.
                  <br />
                  Different rules.
                </h2>
              </div>
              <p>
                The picker is a route, not a promise of coverage. Tikdam names
                the boundary before it gives a number.
              </p>
            </Reveal>
            <div className="jurisdiction-grid">
              <Reveal className="jurisdiction-card active-country">
                <div className="country-top">
                  <span>India</span>
                  <span className="country-chip">Narrow active route</span>
                </div>
                <p>
                  Current numerical candidate checks cover ordinary office
                  stationery under specific GST conditions. A phone or laptop
                  needs separate review.
                </p>
                <a href="#demo" onClick={() => setSelected("stationery")}>
                  Explore the India example{" "}
                  <ArrowUpRight size={17} aria-hidden="true" />
                </a>
              </Reveal>
              <Reveal className="jurisdiction-card preview-country">
                <div className="country-top">
                  <span>United Kingdom</span>
                  <span className="country-chip">Preview</span>
                </div>
                <p>
                  A narrow laptop allowance example illustrates the second
                  jurisdiction. It is static and does not represent the current
                  app’s calculation scope.
                </p>
                <a href="#demo" onClick={() => setSelected("uk")}>
                  Explore the UK preview{" "}
                  <ArrowUpRight size={17} aria-hidden="true" />
                </a>
              </Reveal>
              <Reveal className="jurisdiction-card unsupported-country">
                <div className="country-top">
                  <span>Elsewhere</span>
                  <span className="country-chip">Unsupported case</span>
                </div>
                <p>
                  When no reviewed rule fits, the result says unsupported. No
                  Indian rule gets reused for another country.
                </p>
                <a href="#demo" onClick={() => setSelected("wrong")}>
                  See an unsupported route{" "}
                  <ArrowUpRight size={17} aria-hidden="true" />
                </a>
              </Reveal>
            </div>
          </div>
        </section>

        <section
          className="section hackathon"
          aria-labelledby="hackathon-title"
        >
          <div className="container hackathon-grid">
            <Reveal>
              <span className="section-index">
                Built for the Meta Hackathon
              </span>
              <h2 id="hackathon-title">
                A smarter question
                <br />
                before a costly click.
              </h2>
              <p className="hackathon-intro">
                Tikdam combines conversational intake with controlled tax logic.
                The landing preview shows the idea; the existing application has
                its own documented coverage and limits.
              </p>
              <div className="tech-tags">
                <span>Meta Model API</span>
                <span>Muse Spark</span>
                <span>Versioned rules</span>
                <span>Source links</span>
              </div>
            </Reveal>
            <Reveal className="build-notes">
              <div>
                <span className="build-marker">Existing app</span>
                <h3>Indian prototype, now broader but still bounded</h3>
                <p>
                  The current app has a narrow India GST amount route and
                  guarded international guidance. The public AI switch is off
                  pending its controls.
                </p>
              </div>
              <div>
                <span className="build-marker build-marker-lime">
                  Hackathon work
                </span>
                <h3>Routing, review, and Meta integration</h3>
                <p>
                  Country routing, a bounded Meta adapter, evidence checks, and
                  explicit unsupported outcomes are part of the event-period
                  application work.
                </p>
              </div>
              <a href="/app">
                Open the current app{" "}
                <ArrowUpRight size={17} aria-hidden="true" />
              </a>
            </Reveal>
          </div>
        </section>

        <section id="faq" className="section faq" aria-labelledby="faq-title">
          <div className="container faq-grid">
            <Reveal>
              <span className="section-index">Good to ask</span>
              <h2 id="faq-title">
                Small print.
                <br />
                Big clarity.
              </h2>
              <p>
                These are the questions a tax product should answer before it
                earns your trust.
              </p>
            </Reveal>
            <div className="faq-list">
              <details>
                <summary>
                  Does Tikdam file or approve a claim?<span>+</span>
                </summary>
                <p>
                  No. It helps you prepare an estimate and evidence for review.
                  A tax authority or professional has not approved the result.
                </p>
              </details>
              <details>
                <summary>
                  Does the AI calculate the tax benefit?<span>+</span>
                </summary>
                <p>
                  No. The intended architecture uses Muse Spark to clarify and
                  explain. Validated, versioned application rules decide whether
                  a calculation is possible and do the arithmetic.
                </p>
              </details>
              <details>
                <summary>
                  Why do some results show no amount?<span>+</span>
                </summary>
                <p>
                  A missing fact, unsupported purchase, or unreviewed country
                  rule can make a number misleading. The result explains which
                  detail or rule is missing.
                </p>
              </details>
              <details>
                <summary>
                  Is this landing demo connected to my tax records?
                  <span>+</span>
                </summary>
                <p>
                  No. It is a fixed front-end preview. The example buttons
                  change local UI state and send nothing to a tax authority or
                  Meta.
                </p>
              </details>
            </div>
          </div>
        </section>

        <aside className="disclaimer" aria-label="Important disclaimer">
          <div className="container disclaimer-inner">
            <ShieldCheck size={28} aria-hidden="true" />
            <p>
              <strong>Estimates for review only.</strong> Not tax advice.
              Consult a qualified professional. Tikdam does not file taxes or
              verify your records with a tax authority.
            </p>
          </div>
        </aside>
      </main>

      <footer className="footer">
        <div className="container footer-top">
          <div>
            <Logo light />
            <p>
              Check before you buy.
              <br />
              Know what to keep.
            </p>
          </div>
          <a className="button button-lime" href="/app">
            Open app <ArrowUpRight size={18} aria-hidden="true" />
          </a>
        </div>
        <div className="container footer-bottom">
          <span>© 2026 Tikdam</span>
          <a href="/brand/tikdam-logos.zip" download>Download logos</a>
          <a href="#top">Back to top ↑</a>
        </div>
      </footer>
    </>
  );
}
