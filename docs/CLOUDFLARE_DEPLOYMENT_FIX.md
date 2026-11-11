# Fix Cloudflare deploy error 10021 (D1 database_id)

The deployment screenshot shows: `binding DB of type d1 must have a valid database_id specified [code: 10021]`. The checked-in `wrangler.jsonc` contains a placeholder. Never invent a database ID.

### One-time Cloudflare configuration

1. In the **same Cloudflare account**, locate the existing D1 database named `game-changer-db` (or create it once under Storage & databases > D1). Avoid duplicates.
2. Under **Workers & Pages > game-changer > Settings > Build**, change **Deploy command** from default `npx wrangler deploy` to **`npm run deploy`**, then save. Cloudflare Git Builds does not automatically invoke the npm deploy script.
3. Trigger a new deployment. The npm script uses `wrangler d1 list --json` to resolve the real D1 ID, patches only the ephemeral build configuration, applies remote migrations, and deploys. If D1 listing is unavailable to the build environment, set the **build-time** variable `D1_DATABASE_ID` to the real UUID from the D1 dashboard.
4. Separately configure Zero Trust Access on the production hostname and Worker runtime secrets `ACCESS_TEAM_DOMAIN` and `ACCESS_AUD`. Those values are not available from repository code.

This deployment fix fails safely if it cannot find a valid database. It does **not** disable auth, invent credentials, create duplicate resources, or claim live AI/Access verification. See https://developers.cloudflare.com/workers/ci-cd/builds/configuration/ and https://developers.cloudflare.com/workers/wrangler/commands/d1/.
