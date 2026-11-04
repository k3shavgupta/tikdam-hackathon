# Deployment

GitHub repository `k3shavgupta/tikdam-hackathon`, branch `main`, contains the landing page, checker and Worker. Wrangler publishes the combined build. A push alone does not deploy it. Use the release commands in the root README from this checkout.

On November 3 the live homepage and checker HTML matched the separate local release directory byte for byte. GitHub lagged behind production Worker `fde90d1e-a61d-4a63-9be1-e3020e35c4e9`. The source reconciliation includes Baseten chat, the optional customer account, session revocation, topic counters, and the CSP-compatible landing build. Account-specific settings and provider credentials stay on Cloudflare. D1 records processing failures and budget estimates for the owner dashboard. Worker request logging is disabled. Inspect the ledger before retrying any ambiguous provider failure.

## Earlier releases

## Worldwide evidence preparation — 2 November 2026

Staging version `c2ec365b-aaa9-488e-afa0-c0f379d333f0` and production version `c234ebed-9f27-41ca-bc8a-99195cec46c5` serve the 250-location selector. Eleven locations have researched guidance; only narrow IN/GB/SG scenarios can return conditional numerical amounts. The other 239 provide general invoice and evidence preparation without local tax conclusions. Public AI remains disabled.

The full suite passed 1,163 tests before the final landing-copy change; 25 focused UI tests and a production build passed afterward. Production HTTP checks confirmed Brazil receives no numerical amount, the UK example remains conditional, the app serves the worldwide wording, `www` redirects and unauthenticated admin access is denied.

## Worldwide assistant boundary — 2 November 2026

Staging version `ba99b7b5-7fe3-4855-83ce-0db911b404eb` and production version `2eb83878-70ea-4036-b4ce-98acdf2e470d` were deployed from the combined homepage/app build after commit `8684995`. Both deployments kept `AI_ENABLED=false` and the existing D1 bindings. The public repository retains placeholder D1 IDs; a temporary local-only deploy config supplied the existing account IDs and was excluded from Git.

Before deployment, 1,167 project tests and 1,000 offline evaluation cases passed, and the combined production build completed after installing the landing package's locked dependencies. Private fictional Meta checks covered a France purchase question and Brazil client-payment explanation; details and limits are in `docs/evaluation/WORLDWIDE-ASSISTANT-2026-11-02.md`.

Staging and production HTTP checks returned 250 countries and AI disabled. France returned general preparation with no local source. Brazil returned a payment reconciliation with a 20.00 BRL gap, no benefit amount and no local source. Production `/` and `/app` returned 200, `www` redirected with 308, unauthenticated admin paths returned 403, and `/.env.local` returned 404. The served app bundle contains the new unreviewed-location assistant warning. Live browser AI remains unavailable pending Access and Turnstile setup.

## Contact links — 2 November 2026

Staging version `4bc73199-69c7-4637-9cde-06ecf377e44a` and production version `12096416-990a-48d3-9c7e-7768a9836508` add Tikdam's email, Instagram and X links to the homepage footer and the X handle to social metadata. The existing `/app` checker, primary navigation and logo download remain in place. Public AI stays disabled.

The landing lint, combined production build and 40 Worker tests passed. Staging and production HTTP checks verified the homepage, checker, 12 static assets, inline-script CSP hashes, protected routes, 404 behavior and a deterministic India purchase plan. Production also returned the three new links and `www.tikdam.xyz/app` redirected to the canonical host.
