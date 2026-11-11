# Game Changer — by Atherious Labs

A Cloudflare-first, ChatGPT-inspired AI workspace for software development, plans and AI-assisted research. Original responsive UI with a CSS 3D hero, persistent projects and conversations, and server-side Workers AI. **No seeded/sample customer data is shipped.**

> **Release status (11 Nov 2026):** Source-ready functional first release, not yet Cloudflare-deployed or end-to-end verified with a real account. It is **not a full ChatGPT clone**. Review the limitations and deployment checklist before calling your production environment ready.

## Implemented

- ChatGPT-style home composer, dark sidebar, responsive desktop/mobile design, CSS 3D illustration.
- **New Chat / New Plan / New Research:** creates a *different persisted conversation* immediately. Recent list opens each chat independently.
- Multi-turn AI chat, response streaming via Cloudflare Workers AI, selectable GPT-OSS 120B/20B.
- Mode-specific system instructions; Research mode **does not pretend to browse the web**.
- Projects: create, rename, delete, per-project instructions; add/move conversations and list project chats.
- Conversations: rename, pin, archive/unarchive (with an Archived Chats page), delete, branch a chat, export Markdown; local search covers titles and message content.
- Server-side persistence in D1 with per-user ownership and SQLite foreign-key relations.
- Cloudflare Access JWT verification (signature, issuer, audience, expiry, email allowlist); no client-controlled identity.
- AI request counters, daily rate limits, partial-response handling and retry for interrupted/failed replies.
- Profile display name persisted in D1; account identity sourced from verified Access JWT.
- Honest Usage page backed by actual request records (only displays token counts when reported).
- Plugins and Billing show accurate unconfigured states; **no fictional plugins, charges or subscriptions**.
- No external UI framework/CDN/runtime dependency; Wrangler is needed for deployment.

## Not yet implemented / do not represent as available

Live browsing/deep research, repository access or file editing, file uploads/R2 storage, voice, image generation, plugin OAuth/invocation, payment subscriptions, account sharing, agent computer control, code execution sandbox, team collaboration, genuine cost/Neuron metering. These are future integrations, not fake buttons. The AI can *generate code and plans*, but cannot autonomously edit and deploy repositories in this release.

## Stack

- Frontend: static vanilla HTML/CSS/ES modules (no build step), safe text rendering, responsive accessible controls.
- Backend: Cloudflare Worker ES module (`src/index.js`).
- Models: `@cf/openai/gpt-oss-120b` (default), `@cf/openai/gpt-oss-20b` (manual low-cost option). Both go through `env.AI.run` and Workers AI's free daily Neuron allocation where eligible.
- Database: Cloudflare D1 with migrations; no localStorage or invented usage counters.
- Authentication: **Cloudflare Zero Trust Access on your real custom domain**, with independent signed JWT verification in the Worker (RS256/JWKS, `iss`, `aud`, `exp`).
- Future provider hook: `src/providers.js`; add another server-side adapter when credentials are available. Never expose a provider API key in frontend JS.

## GitHub CI

Every push to `main` and every pull request runs `.github/workflows/verify.yml`: syntax checks, 11 automated tests, and Cloudflare binding-structure validation. This is a source verification workflow, **not** a live Cloudflare deployment or inference smoke test.

## Cloudflare deployment

1. Install Node.js 22.16+ and dependencies: `npm install`.
2. Authenticate: `npx wrangler login`.
3. Create the database: `npx wrangler d1 create game-changer-db`.
4. Replace the `REPLACE_WITH_D1_DATABASE_UUID` value in `wrangler.jsonc` with the actual UUID returned by Wrangler. Keep the `DB` and `AI` bindings.
5. Apply migrations: `npm run db:remote` (for production) or `npm run db:local` (for local DB tests).
6. In Cloudflare Zero Trust, configure an **Access application for the actual custom domain** (e.g. `gamechanger.example.com/*`) and explicit allow policies for the users. Require MFA in your IdP/policy for serious deployments.
7. Set Worker secrets (Cloudflare prompts for the value):
   - `npx wrangler secret put ACCESS_TEAM_DOMAIN` — e.g. `https://your-team.cloudflareaccess.com` (the complete URL, no slash at end).
   - `npx wrangler secret put ACCESS_AUD` — the *application* AUD tag from Zero Trust Access.
   - Optionally `npx wrangler secret put ACCESS_ALLOWED_EMAILS` — comma-separated approved user email addresses; **Access policies are still required**.
8. Route the Worker to your protected custom domain and **protect any other public Worker URL or turn off public workers.dev if exposing a production instance**. Insecure duplicate routes can expose the UI (API still validates Access tokens).
9. Run `npm run check`, then `npm run deploy`. Sign in via the Access-protected domain and run the acceptance tests below.

Important: `wrangler dev` on unprotected localhost intentionally does **not** bypass authentication. The frontend will display an authentication/configuration error until valid Cloudflare Access JWTs are present. Test actual sign-in on a protected preview hostname. Do not add an `ALLOW_ANONYMOUS` production bypass.

### Free-tier restrictions

Cloudflare Workers AI offers a **10,000 Neuron daily free allocation** (as of 11 Nov 2026); beyond the allocation inference fails on the Free plan. Workers, D1 and Access have separate plan/usage restrictions. The application's own default limits are **25 model requests per rolling day and 4 per rolling minute per user**, adjustable in `wrangler.jsonc`, and do not guarantee your Cloudflare account stays below its allowance. Check actual Neuron usage in Cloudflare's dashboard. The app intentionally does **not** estimate a made-up balance.

### Configuration reference

| Name | Location | Description |
|---|---|---|
| `DB` | Wrangler D1 binding | D1 database; mandatory |
| `AI` | Wrangler AI binding | Workers AI; mandatory |
| `ACCESS_TEAM_DOMAIN` | Wrangler secret | `https://team.cloudflareaccess.com`; mandatory |
| `ACCESS_AUD` | Wrangler secret | Cloudflare Access application audience; mandatory |
| `ACCESS_ALLOWED_EMAILS` | Wrangler secret | Optional extra server-side allowlist |
| `MAX_REQUESTS_PER_DAY` | Wrangler vars | Per-user rolling 24-hour cap |
| `MAX_REQUESTS_PER_MINUTE` | Wrangler vars | Per-user rolling 1-minute cap |

## Acceptance checklist after integration (not yet performed against real Cloudflare)

- [ ] App hosted behind Access; unauthorized API request yields 401, valid signed JWT is accepted.
- [ ] A new user sees empty Projects, Recents and Usage (no demo records).
- [ ] New Chat/Plan/Research each create different route IDs and appear separately in Recents; refresh preserves each.
- [ ] AI outputs stream incrementally and persist across browser/device refresh.
- [ ] Invalid/expired JWTs, cross-site Origin and other users' IDs are rejected.
- [ ] Create, rename, pin, archive, delete and branch conversations; search matches chat text.
- [ ] Create a Project, add chats, edit project instructions and move a chat into/out of it.
- [ ] Responses are escaped before rendering (no message HTML execution).
- [ ] Usage shows real request counts; quotas and failure retry are exercised.
- [ ] Phone width (360px), tablet and desktop layout/keyboard shortcuts.
- [ ] Cloudflare Workers AI quota exhaustion displays an honest error.
- [ ] Custom domain, Access policies/MFA, DNS/TLS, backups, logging and security review approved.

## Test results on the source bundle

`npm run check` passes JavaScript syntax and the included 11 Node tests for JWT cryptographic checks, model allowlist, message limits, context trimming, streamed SSE parsing and a real SQLite-backed Worker API integration flow. Initial SQLite migration parsed and executed successfully in SQLite. A desktop/mobile static UI visual check was performed using a **local-only mocked identity/empty API**; no test/mock data or mock backend is deployed in this bundle. A Cloudflare account was not connected, so actual inference, Access and D1 integration **remain unverified**.

## References

- Cloudflare Workers AI: https://developers.cloudflare.com/workers-ai/platform/pricing/
- GPT-OSS 120B: https://developers.cloudflare.com/workers-ai/models/gpt-oss-120b/
- GPT-OSS 20B: https://developers.cloudflare.com/workers-ai/models/gpt-oss-20b/
- Cloudflare Access JWT verification: https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/
- Workers static assets: https://developers.cloudflare.com/workers/static-assets/routing/single-page-application/
- D1 migrations: https://developers.cloudflare.com/d1/reference/migrations/
- ChatGPT Projects (UX research): https://help.openai.com/en/articles/10169521-projects-in-chatgpt

## Integration into your repository

This is a standalone Cloudflare Worker + assets project. Once you provide the GitHub repository link, it can be reconciled with the actual repo architecture. **Do not overwrite an existing repository's app routes, migrations or Access configuration blindly.** Review feature overlap, deploy environments, naming, D1 schema and CI before merge.
