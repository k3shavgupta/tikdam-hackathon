# Deployment notes

The app is served at [tikdam.xyz](https://tikdam.xyz), with a staging preview at [tikdam-v1-staging.k3shavgupta.workers.dev](https://tikdam-v1-staging.k3shavgupta.workers.dev). Public AI remains disabled until owner access, Turnstile and the live browser flow are configured and verified. A working manual path and build/tests do not establish live model availability.

For a separate Cloudflare deployment, create your own D1 databases and replace the zero UUIDs in `wrangler.jsonc`; configure your own account, domain routes and secrets. Never commit `.env.local`, `.dev.vars` or real credentials. Run `npm ci`, `npm --prefix landing ci`, `npm test` and `npm run build` before deployment. The repository does not include account-specific Access/Turnstile setup automation.

## Worldwide evidence preparation — 2 November 2026

Staging version `c2ec365b-aaa9-488e-afa0-c0f379d333f0` and production version `c234ebed-9f27-41ca-bc8a-99195cec46c5` serve the 250-location selector. Eleven locations have researched guidance; only narrow IN/GB/SG scenarios can return conditional numerical amounts. The other 239 provide general invoice and evidence preparation without local tax conclusions. Public AI remains disabled.

The full suite passed 1,163 tests before the final landing-copy change; 25 focused UI tests and a production build passed afterward. Production HTTP checks confirmed Brazil receives no numerical amount, the UK example remains conditional, the app serves the worldwide wording, `www` redirects and unauthenticated admin access is denied.

## Worldwide assistant boundary — 2 November 2026

Staging version `ba99b7b5-7fe3-4855-83ce-0db911b404eb` and production version `2eb83878-70ea-4036-b4ce-98acdf2e470d` were deployed from the combined homepage/app build after commit `8684995`. Both deployments kept `AI_ENABLED=false` and the existing D1 bindings. The public repository retains placeholder D1 IDs; a temporary local-only deploy config supplied the existing account IDs and was excluded from Git.

Before deployment, 1,167 project tests and 1,000 offline evaluation cases passed, and the combined production build completed after installing the landing package's locked dependencies. Private fictional Meta checks covered a France purchase question and Brazil client-payment explanation; details and limits are in `docs/evaluation/WORLDWIDE-ASSISTANT-2026-11-02.md`.

Staging and production HTTP checks returned 250 countries and AI disabled. France returned general preparation with no local source. Brazil returned a payment reconciliation with a 20.00 BRL gap, no benefit amount and no local source. Production `/` and `/app` returned 200, `www` redirected with 308, unauthenticated admin paths returned 403, and `/.env.local` returned 404. The served app bundle contains the new unreviewed-location assistant warning. Live browser AI remains unavailable pending Access and Turnstile setup.
