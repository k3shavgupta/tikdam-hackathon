# Provider verification

Checked during the 1–2 November 2026 evaluation. Campaign ID stays `tikdam-v1-eval-2026-11-01` across restarts. Credential presence is never treated as authentication.

## Meta

The private lead-run harness successfully called `https://api.meta.ai/v1/responses/input_tokens` and `/responses` using standard `muse-spark-1.3`, `store:false`, strict production schemas, no tools, 20,000 input and 1,200 output token bounds. Every actual HTTP attempt is counted before fetch. No SDK retries. Requests use `reasoning.effort=minimal`; initial default/low reasoning runs exhausted the output cap.

Official [pricing](https://dev.meta.ai/docs/pricing-rate-limits) was rechecked: $1.25/M uncached input and $4.25/M output. Estimates ignore cache discounts. [Responses API](https://dev.meta.ai/docs/protocols/responses) documents minimal reasoning. Maximum reservation is 30,100 micro-USD per operation. Cached-token breakdown was not retained in this run; no discount or provider invoice is claimed. Account credit applicability and final billing exports were not independently verified.

Public AI remains disabled. This private service test does not establish public browser extraction, Turnstile or owner login.

## Baseten

The model catalogue request succeeded and listed `meta-models/muse-spark-open`. A single comparison request to `https://inference.baseten.co/v1/chat/completions` returned HTTP403. No generated answer or usage was returned. Baseten is paused, with its entire 30,100 micro-USD reservation held as unknown billing. Do not retry with other keys/models to bypass the denial. The exact account permission or credit restriction remains unknown.

The optional text-only evaluation adapter uses prompt-requested JSON and validates it locally. [Baseten's Model API documentation](https://docs.baseten.co/inference/model-apis/overview) excludes Muse Spark Open from enforced JSON/structured outputs. It is a separate model from Meta's closed API. Its documented uncached input/output rates were checked at $1.25/$4.25 per million tokens. No dedicated deployment, warm replica or automatic failover was created. This is not a production provider switch or a successful quality comparison.

## Modal

The local isolated Python environment contains Modal1.6.3. The first metadata action only constructed SDK stubs using `Client.from_env()`. That was initially mislabeled authenticated; an appended audit correction records that it did **not** prove remote authentication. The harness now calls `client.hello()` and has two offline regressions proving a failed handshake cannot claim success.

One bounded ephemeral CPU app-creation attempt was rejected with `AuthError: Token ID is malformed`. No successful app ID, function execution or document output was observed. No GPU, schedule, endpoint or durable volume was created by the harness. There is no observed campaign app to stop; provider-wide absence of residual resources was not independently verified because authentication failed. Do not describe cleanup as verified.

The planned job was CPU request/limit0.125/0.25, memory128/256MiB, max one container, no warm containers, task timeout15s, startup30s, parent deadline90s, retries0, blocked container network, single-use containers and explicit stop/fallback cleanup. It handles only generated one-page PDF metadata and PNG dimensions, not general OCR. SDK control-plane actions are counted as logical actions; their internal gRPC sends are **not** claimed as exact HTTP counts.

The 400,000 micro-USD compute reservation remains held and Modal is paused. This conservative hold is not evidence of $0.40 spent. [Resource limits](https://modal.com/docs/guide/resources), [pricing](https://modal.com/pricing), [budgets](https://modal.com/docs/guide/budgets), and [ephemeral apps](https://modal.com/docs/guide/apps) informed the bounds. Compute credit eligibility and workspace identity could not be verified with the malformed credentials. Shared Endpoint credits/authentication were not substituted.

To repair credentials later, use a genuine SDK token pair in the ignored `hackathon/.env.local` fields `MODAL_TOKEN_ID` and `MODAL_TOKEN_SECRET`. Do not put them in chat or source. Any later live check requires review of the same held campaign ledger; deleting/reinitializing it is prohibited.

## Cloudflare

The deployed app keeps public AI disabled. Access login and Turnstile setup remain external prerequisites; neither has a verified end-to-end public browser result.

There are no recurring provider test jobs or unattended live runners configured. The existing Cloudflare retention cron is non-AI infrastructure work and does not call these providers. Cloudflare infrastructure usage and final provider invoices remain separate from this evaluation's returned-token estimates.
