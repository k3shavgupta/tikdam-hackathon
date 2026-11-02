# Live app API check — 2 November 2026

Five real Meta `muse-spark-1.3` generations completed through the production Worker request handler and AI service, backed by persistent local D1. All inputs were fictional. This checked API integration, not a browser session. Turnstile responses were simulated privately; public Cloudflare authentication and browser verification remain untested. No production AI switch was changed.

| Flow | Observed result |
| --- | --- |
| Purchase planning | Intake returned a question without confirming protected facts; the plan retained its no-guaranteed-refund limit. |
| PNG invoice | Expected invoice fields and amounts were extracted. The API harness initially passed null fields into assessment, unlike the actual app. After correcting the harness to use the app's field mapping, the saved output passed both unconfirmed and confirmed assessment checks without another generation. |
| PDF invoice | Expected invoice fields and amounts were extracted. No amount was offered before confirmation; confirmation produced the conditional 20.00 GBP result. |
| Purchase explanation | Included the server-calculated 20.00 GBP amount, conditional wording, and no-cash-refund caveat. |
| Client payment | Included the missing-certificate and no-numerical-benefit caveats without an unrelated purchase VAT route. |

The private checks also exercised session creation, missing consent, missing challenge, duplicate-request rejection without another generation, operational events, feedback, denied admin access, and session clearing. The exact 1,000-case offline evaluation passed before the live calls.

Five generations and five token-count requests added an estimated **$0.018033**, calculated conservatively from returned token usage and [Meta's published standard prices](https://dev.meta.ai/docs/pricing-rate-limits). This is an estimate, not an invoice. Existing campaign reservations and limits were preserved.

## Provider access recheck

After the user reported both providers ready, Baseten's model catalogue was reachable and listed `meta-models/muse-spark-open`. One generation attempt still returned HTTP 403. It produced no answer or token usage. Baseten was paused again; the new 30,100 micro-USD reservation remains held alongside the earlier hold. No alternate key or model was used to bypass the denial.

Modal's actual SDK handshake returned `Token ID is malformed`. No compute or deployment was requested. Its previous compute hold remains intact. The user needs to replace the local API token pair; API token IDs start with `ak-` and matching secrets with `as-`. [Modal configuration](https://modal.com/docs/sdk/py/latest/config) distinguishes these from Proxy Tokens used by HTTP endpoints.

The agreed integration roles are Muse for the assistant, Modal for document processing, and Baseten as an optional model provider. Modal and Baseten are not active app integrations yet; successful provider access and bounded live verification remain prerequisites.

## Repeatable private commands

`scripts/evaluation-app-live.mjs` defaults to dry-run. Supply `--state-dir` pointing to the existing private `.local-state` directory and a unique `--run-tag`. `--live` admits at most five generation calls in the existing campaign. `--cases` can select a subset to avoid repeating successful calls. A prior run tag is rejected. Load credentials with Node's `--env-file` from the ignored local file.

`scripts/evaluation-provider-access.mjs` also defaults to dry-run. Use its `--live` mode only after an explicit credential/access repair. It records the recheck, temporarily resumes the relevant evaluation provider, preserves all cost holds, and checks the Baseten catalogue and real Modal authentication. Catalogue success does not prove generation access. Neither script enables public AI.
