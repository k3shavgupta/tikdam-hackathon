"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  CircleHelp,
  FileCheck2,
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
    item: "Phone, about 60% work use",
    user: "I’ll use a new phone about 60% for work. Can I claim 60% of its GST?",
    reply:
      "The 60% estimate is a starting fact, not an eligible amount. Confirm the invoice and registration, then record business use before seeking a credit review.",
    verdict: "Insufficient information",
    amount: "Check first",
    amountLabel: "No phone GST credit estimated",
    explanation:
      "The CGST Act limits mixed-use credit to tax attributable to business use, subject to other eligibility and blocked-credit rules. Tikdam's current amount route covers ordinary office stationery only, so this preview does not calculate a phone claim.",
    assumptions: [
      "60% work use is a self-reported estimate",
      "No invoice, GST amount or registration details supplied",
    ],
    conditions: [
      "Confirm GST registration and taxable activity",
      "Get a tax invoice showing the correct buyer and GST amount",
      "Record actual business use and review apportionment and blocked-credit rules",
    ],
    documents: ["Tax invoice", "Work-use log", "Proof of payment"],
    source: {
      label: "India Code, CGST Act sections 16 and 17 (check amendments for the purchase date)",
      url: "https://www.indiacode.nic.in/indiacode/handle/123456789/15689?view_type=browse",
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
  { href: "#demo", label: "Example cases" },
  { href: "#jurisdictions", label: "Jurisdictions" },
  { href: "#faq", label: "FAQ" },
];

const purchaseExamples = [
  "PHONE",
  "LAPTOP",
  "CAMERA",
  "SOFTWARE",
  "DESK",
  "MICROPHONE",
  "MONITOR",
  "KEYBOARD",
  "PRINTER",
  "WEBCAM",
  "OFFICE CHAIR",
  "HEADPHONES",
  "TABLET",
  "ROUTER",
  "SCANNER",
  "TRIPOD",
  "LIGHTING",
  "EXTERNAL DRIVE",
  "CLOUD STORAGE",
  "WEB HOSTING",
  "DOMAIN NAME",
  "DESIGN TOOLS",
  "DRAWING TABLET",
  "PROJECTOR",
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
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (
      !element ||
      !("IntersectionObserver" in window) ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      element.getBoundingClientRect().top <= window.innerHeight * 0.92
    ) {
      return;
    }

    element.classList.add("reveal-pending");
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          element.classList.add("reveal-visible");
          observer.disconnect();
        }
      },
      { rootMargin: "0px 0px -5% 0px", threshold: 0.01 },
    );
    observer.observe(element);

    return () => {
      observer.disconnect();
      element.classList.remove("reveal-pending", "reveal-visible");
    };
  }, []);

  return <div ref={ref} className={className}>{children}</div>;
}

function DemoReceipt({
  item,
  compact = false,
}: {
  item: DemoCase;
  compact?: boolean;
}) {
  return (
    <div key={item.id + String(compact)} className={`receipt ${compact ? "receipt-compact" : "receipt-demo"}`}>
      <div className="receipt-top">
        <span>
          <ReceiptText size={17} aria-hidden="true" /> Tikdam check
        </span>
        <span>Example only</span>
      </div>
      {compact ? (
        <>
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
        </>
      ) : (
        <>
          <p className="receipt-demo-context">{item.jurisdiction} / {item.item}</p>
          <blockquote className="receipt-demo-question">{item.user}</blockquote>
        </>
      )}
      <div className="receipt-result">
        <span
          className={`verdict verdict-${item.verdict.toLowerCase().replaceAll(" ", "-")}`}
        >
          {item.verdict}
        </span>
        <p className="receipt-amount">{item.amount}</p>
        <p className="amount-label">{item.amountLabel}</p>
      </div>
      {!compact && (
        <>
          <div className="receipt-demo-answer">
            <span>What the preview says</span>
            <p>{item.reply}</p>
          </div>
          <details className="receipt-more">
            <summary>
              {item.source ? "See the checks and source" : "See checks and limits"}
              <ChevronDown size={18} aria-hidden="true" />
            </summary>
            <div className="receipt-more-content">
              <p className="receipt-explanation">{item.explanation}</p>
              <div className="receipt-details">
                <div>
                  <h4>Assumptions</h4>
                  <ul>
                    {item.assumptions.map((a) => <li key={a}>{a}</li>)}
                  </ul>
                </div>
                <div>
                  <h4>Check before claiming</h4>
                  <ul>
                    {item.conditions.map((c) => <li key={c}>{c}</li>)}
                  </ul>
                </div>
                <div>
                  <h4>Keep this proof</h4>
                  <ul>
                    {item.documents.map((d) => (
                      <li key={d}>
                        <Check size={15} aria-hidden="true" /> {d}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              <div className="receipt-source">
                {item.source ? (
                  <a href={item.source.url} target="_blank" rel="noreferrer">
                    Read source: {item.source.label} <ArrowUpRight size={16} aria-hidden="true" />
                  </a>
                ) : (
                  <span>No country rule or source is applied to this example.</span>
                )}
              </div>
            </div>
          </details>
        </>
      )}
      <div className="receipt-teeth" aria-hidden="true" />
    </div>
  );
}

export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [selected, setSelected] = useState<CaseId>("stationery");
  const item = cases[selected];

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
            <a href="/app/sign-in">Sign in</a>
          </nav>
          <a className="button button-lime nav-cta" href="/app">
            Open checker <ArrowUpRight size={17} aria-hidden="true" />
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
              Open checker <ArrowUpRight size={17} aria-hidden="true" />
            </a>
            <a href="/app/sign-in" onClick={() => setMenuOpen(false)}>Sign in <ArrowUpRight size={17} aria-hidden="true" /></a>
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
          role="group"
          aria-label="Examples of purchases people may ask about"
        >
          <div className="marquee-track" aria-hidden="true">
            {[0, 1].map((copy) => (
              <div className="marquee-set" key={copy}>
                {purchaseExamples.map((item) => (
                  <span key={item}>
                    {item} <b>✳</b>
                  </span>
                ))}
              </div>
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
                  See the check.
                  <br />
                  Keep the <em>receipts.</em>
                </h2>
              </div>
              <p>
                Choose an example to see the kind of answer Tikdam gives.
                These are fixed illustrations, not live checks.
              </p>
            </Reveal>
            <div className="demo-grid">
              <div className="demo-controls">
                <h3 className="case-label">Choose an example</h3>
                <div className="case-list">
                  {(["stationery", "phone", "missing"] as CaseId[]).map((id) => (
                    <button
                      className={`case-button ${selected === id ? "case-button-active" : ""}`}
                      key={id}
                      type="button"
                      onClick={() => setSelected(id)}
                      aria-pressed={selected === id}
                    >
                      <span>{cases[id].title}</span>
                      <ArrowUpRight size={18} aria-hidden="true" />
                    </button>
                  ))}
                </div>
                <details className="more-cases">
                  <summary>
                    More examples <span>3</span> <ChevronDown size={18} aria-hidden="true" />
                  </summary>
                  <div className="case-list">
                    {(["personal", "wrong", "uk"] as CaseId[]).map((id) => (
                      <button
                        className={`case-button ${selected === id ? "case-button-active" : ""}`}
                        key={id}
                        type="button"
                        onClick={() => setSelected(id)}
                        aria-pressed={selected === id}
                      >
                        <span>{cases[id].title}<small>{cases[id].jurisdiction}</small></span>
                        <ArrowUpRight size={18} aria-hidden="true" />
                      </button>
                    ))}
                  </div>
                </details>
              </div>
              <div className="demo-display">
                <p className="sr-only" aria-live="polite">
                  {item.title}: {item.verdict}. {item.amountLabel}.
                </p>
                <DemoReceipt item={item} />
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
                  The current checker offers a narrow India GST amount route
                  and general preparation across 250 locations. Public chat
                  requires consent and verification; invoice reading is paused.
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
                Open the full checker{" "}
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
          <nav className="footer-contact" aria-label="Tikdam contact and social links">
            <span>Get in touch</span>
            <a href="mailto:tikdambaithana@gmail.com">tikdambaithana@gmail.com</a>
            <a href="https://www.instagram.com/tikdamxyz/" target="_blank" rel="noopener noreferrer">
              Instagram ↗
            </a>
            <a href="https://x.com/Tikdamxyz" target="_blank" rel="noopener noreferrer">
              X / Twitter ↗
            </a>
          </nav>
          <a className="button button-lime" href="/app">
            Open checker <ArrowUpRight size={18} aria-hidden="true" />
          </a>
        </div>
        <div className="container footer-bottom">
          <span>© 2026 Tikdam</span>
          <span>Built with care, and a paper trail.</span>
          <a href="#top">Back to top ↑</a>
        </div>
      </footer>
    </>
  );
}
