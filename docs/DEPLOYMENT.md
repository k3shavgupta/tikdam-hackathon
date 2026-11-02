# Deployment notes

The app is served at [tikdam.xyz](https://tikdam.xyz), with a staging preview at [tikdam-v1-staging.k3shavgupta.workers.dev](https://tikdam-v1-staging.k3shavgupta.workers.dev). Public AI remains disabled until owner access, Turnstile and the live browser flow are configured and verified. A working manual path and build/tests do not establish live model availability.

For a separate Cloudflare deployment, create your own D1 databases and replace the zero UUIDs in `wrangler.jsonc`; configure your own account, domain routes and secrets. Never commit `.env.local`, `.dev.vars` or real credentials. Run `npm ci`, `npm test` and `npm run build` before deployment. The repository does not include account-specific Access/Turnstile setup automation.

## Worldwide evidence preparation — 2 November 2026

Staging version `c2ec365b-aaa9-488e-afa0-c0f379d333f0` and production version `c234ebed-9f27-41ca-bc8a-99195cec46c5` serve the 250-location selector. Eleven locations have researched guidance; only narrow IN/GB/SG scenarios can return conditional numerical amounts. The other 239 provide general invoice and evidence preparation without local tax conclusions. Public AI remains disabled.

The full suite passed 1,163 tests before the final landing-copy change; 25 focused UI tests and a production build passed afterward. Production HTTP checks confirmed Brazil receives no numerical amount, the UK example remains conditional, the app serves the worldwide wording, `www` redirects and unauthenticated admin access is denied.
