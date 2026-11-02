# V1 build evidence

Execution started 1 November 2026 from the existing local app. The first bullets record the initial baseline; later sections record completed verification.

- Fresh baseline: `npm test`, 25 passed, 0 failed.
- Fresh baseline: `npm run build`, Vite production build passed.
- No Git repository in the application or its parents at baseline.
- Live Meta calls not performed. AI will remain disabled while enforcement and pricing evidence are built.
- Cloudflare authentication, domain bindings, deployed runtime and admin login not yet verified.
- Shared interfaces frozen in `docs/contracts.md` before worker dispatch.

## Workstreams

Tax evidence, D1/admin data, and Workers runtime are the first parallel jobs. AI/cost control and new UI components follow their contracts. Deployment evidence will be recorded separately in `docs/DEPLOYMENT.md`.

## Integrated implementation and deployment

- Tax route/domain tests now include narrow India stationery with eight explicit statutory assertions, reviewed UK/SG limits, stable source IDs and coverage registry. No authority verification or professional sign-off claimed.
- D1 repository, admin queries, reservations, retention, audits and shared throttles implemented. Real local D1 tests cover concurrency and campaign persistence.
- Worker runtime supports exact production origins, static assets, JSON API404, verified Access JWT denial, Turnstile checks, secure sessions and bounded bodies.
- Meta service includes preflight, bounded single calls, validated structured output, usage estimates and no automatic retries. No live provider call made.
- New React assistant/feedback and private admin dashboard implemented. Main app exposes statutory checks and truthful retention copy.
- Full integrated suite reached102 passing tests, no failures. Further tests for source rendering, reset races and three complete React flows were then added; final count will be recorded after the next run.
- Cloudflare CLI authentication refreshed within existing permissions. Scoped Access/Turnstile permissions are still missing; user said they will add a local token.
- Separate remote D1 staging/production databases created and initial migration applied.
- Preview deployed and verified by real HTTPS requests, D1 queries and native Chrome coverage/privacy inspection. Production deployed on apex/www Worker routes.
- Manual workflow verification: prebuy, conditional example invoice after confirmation, clear session, and client certificate request passed React integration checks using actual domain code. These tests use no model calls.
- Native browser controls intermittently report missing window frames or no change, so complete manual desktop interaction and mobile verification are not claimed.
- Live AI remains disabled. Production admin remains denied pending actual Access configuration and login verification.

## Release verification

- Final integrated `npm test`:110 passed, 0 failed, 0 skipped, all model calls mocked.
- `npm run build` passed. `npm audit --omit=dev` reported0 vulnerabilities on the checked dependency set.
- Actual configured secret-value scan across54 source/document/build files found no secret values outside ignored local credential files.
- Public config reports11 countries, eight India assertions and narrow numerical coverage IN/GB/SG. Public JS bundle did not contain credential-token patterns in the smoke scan.
- Cloudflare API confirmed both production Worker routes, production cleanup schedule03:47UTC and disabled production workers.dev/previews.
- Public source resolution now includes client-payment sources. Session creation is serialized behind cookie clearing; additional race regression tests pass.

- Latest production release `e9ef39e2-986a-4ac2-8af3-86aca6dcfef7` has the final retention-copy corrections. Existing110 tests remain green.
- Missing local scoped Cloudflare token confirmed by the read-only control preflight. Account-specific Access/Turnstile setup automation is excluded from this public repository.

## Worldwide selector release — 2 November 2026

The selector contains 250 countries and territories. Eleven have researched guidance, and only narrow IN/GB/SG scenarios have conditional numerical estimates. General evidence preparation for other locations does not establish tax eligibility. The final full suite passed 1,163 tests, and the production build passed. See `docs/DEPLOYMENT.md` for deployed versions and HTTP verification.

## Worldwide assistant boundary — 2 November 2026

The bounded chat path now accepts all 250 locations when AI controls are enabled. For unreviewed locations, it has no local source IDs and cannot determine a tax amount, eligibility or filing route. Purchase questions ignore client-payment fields. Private live checks passed after a France purchase question was corrected and a Brazil client-payment answer was checked for missing evidence and refund limits. The full suite passed 1,167 tests, the offline evaluation passed 1,000 cases without provider calls, and the production build passed. Public AI remains off: the read-only Cloudflare controls preflight found no local `CLOUDFLARE_API_TOKEN` for owner Access and Turnstile setup.
