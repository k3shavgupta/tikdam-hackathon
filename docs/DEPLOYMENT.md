# Deployment notes

The app is served at [tikdam.xyz](https://tikdam.xyz), with a staging preview at [tikdam-v1-staging.k3shavgupta.workers.dev](https://tikdam-v1-staging.k3shavgupta.workers.dev). Public AI remains disabled until owner access, Turnstile and the live browser flow are configured and verified. A working manual path and build/tests do not establish live model availability.

For a separate Cloudflare deployment, create your own D1 databases and replace the zero UUIDs in `wrangler.jsonc`; configure your own account, domain routes and secrets. Never commit `.env.local`, `.dev.vars` or real credentials. Run `npm ci`, `npm test` and `npm run build` before deployment. The repository does not include account-specific Access/Turnstile setup automation.
