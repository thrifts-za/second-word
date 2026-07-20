# Deploying

Two pieces: the Worker (the decision layer) and the sandbox (the public link judges click).

The extension **cannot** talk to a localhost backend from Gmail. Chrome blocks mixed content, so
`https://mail.google.com` calling `http://localhost:8787` fails silently. The Worker has to be on
HTTPS before the extension works anywhere real.

## 1. Worker

```bash
# Required. Signs the token that binds /v1/rewrite to a prior /v1/analyze.
# Any long random string; it never leaves the Worker.
openssl rand -base64 32 | npx wrangler secret put TOKEN_SIGNING_KEY

# Only once Gloo credentials exist:
npx wrangler secret put GLOO_CLIENT_ID
npx wrangler secret put GLOO_CLIENT_SECRET

npm run deploy:worker
```

Workers AI needs no key. The `[ai]` binding in `wrangler.toml` is the credential.

Check it came up, including upstream:

```bash
curl https://second-word.<subdomain>.workers.dev/health
curl https://second-word.<subdomain>.workers.dev/health/upstream
```

`/health` reports `llm_provider`, whether Gloo is configured, and whether the AI binding is present.

## 2. Point everything at it

Three places need the deployed URL:

1. **`wrangler.toml`** -> add the Pages origin to `ALLOWED_ORIGINS`, then redeploy the Worker.
   CORS is a strict allow-list; an origin that is not listed is refused.
2. **`sandbox/index.html`** -> `<html lang="en" data-api="https://...workers.dev">`.
   Without it the sandbox falls back to `http://localhost:8787`.
3. **`extension/src/config.ts`** -> `DEFAULT_API_BASE`, or set it on the options page after install.

## 3. Sandbox

```bash
npm run build:sandbox
npm run deploy:sandbox
```

## 4. Switching to Gloo

One variable in `wrangler.toml`:

```toml
LLM_PROVIDER = "gloo"    # was "workers-ai"
```

Then redeploy. Nothing else changes: same interface, same prompts, same schema, same allow-lists.

**The Gloo path is unverified.** Token URL, API base and model name are best-effort values from the
pre-challenge webinar. Confirm against `docs.gloo.com` when credentials arrive, override with
`GLOO_TOKEN_URL` / `GLOO_API_BASE` / `GLOO_MODEL` if they differ, and update `docs/api-notes.md`.

## 5. Before filming

```bash
npm run verify:all      # typechecks, 54 tests, both bundles
npm run verify:refs     # every reviewed reference resolves against YouVersion
curl https://<worker>/health/upstream
```

Then load `extension/dist` unpacked in Chrome and open a real Gmail compose window. Gmail changes
its DOM whenever it likes; the fixture cannot tell you the selectors still match.
