# n8n verification demo video

Records the demo video n8n asks for during community node verification, as
**one continuous take** of a real, fresh n8n:

1. install `n8n-nodes-curlshot` from npm (Settings → Community nodes), version shown
2. create the CurlShot credential and show **Connection tested successfully**
3. **Take a screenshot** (full page, cookie banners blocked) and open the image in the Binary tab
4. **Generate a PDF** and open it in the Binary tab
5. an **AI Agent** (chat trigger + local Ollama model) with the **CurlShot Tool**; the agent
   calls the tool from a plain-language chat message, and the tool call is shown in the logs

Captions explain each step on screen (no voice-over). A drawn cursor and click
ripples show what is clicked. Playwright records the whole run with one
`recordVideo` on one browser context, so there are no cuts.

## Requirements

- Docker (runs `docker.n8n.io/n8nio/n8n`)
- [Ollama](https://ollama.com) with a tool-calling model: `ollama pull qwen2.5:7b`
- Google Chrome (or set `N8N_DEMO_BROWSER=chromium` after `npx playwright install chromium`)
- ffmpeg
- a CurlShot access key made for the recording. Revoke it afterwards.

## Record

```bash
cd scripts/demo-video
npm install
export N8N_DEMO_PASSWORD="Demo1-$(openssl rand -hex 12)"   # owner password, required
node setup.mjs                      # fresh n8n on :5678, owner + Ollama credential (not filmed)
ollama run qwen2.5:7b "hi" >/dev/null   # load the model so the agent answers quickly
CURLSHOT_KEY_FILE=/path/to/key.json node record.mjs   # writes out/take-<time>.webm
sh encode.sh out/take-<time>.webm   # -> out/take-<time>.mp4 (H.264 1080p)
node teardown.mjs                   # remove the n8n container and volume (they hold the key)
```

`CURLSHOT_KEY_FILE` holds the access key, either bare or as JSON with an
`accessKey` field, so the key never lands in shell history. On camera it is
pasted into n8n's password field (dots only), which is also blurred.

The browser runs headless by default; set `N8N_DEMO_HEADED=1` to watch it.
`setup.mjs` deletes and recreates the `n8n-demo` container and `n8n_demo`
volume each time, so every take starts from a clean n8n. n8n listens on
`127.0.0.1` only. The owner password comes from `N8N_DEMO_PASSWORD` (there is
no default), and `setup.mjs` and `record.mjs` must see the same value. n8n
requires an uppercase letter and a digit, which the `Demo1-` prefix guarantees.
Run `node teardown.mjs` once you have a good take: the volume stores the
CurlShot credential until it is removed.

Other settings (see `config.mjs`): `N8N_DEMO_PORT`, `N8N_DEMO_PACKAGE`
(default `n8n-nodes-curlshot@0.1.1`; bump it for a new version),
`N8N_DEMO_MODEL`, `N8N_DEMO_OLLAMA_URL`, `N8N_DEMO_PROMPT`.

A take costs about three screenshots and one PDF from the key's quota. If a
render fails (for example the target site times out), the script runs the step
again on camera; n8n allows a live fix inside the single take.

## Before submitting

Watch the whole file. Check that every step above is visible and that no key
is readable in any frame.

## Keep it out of the npm package

`n8n-node build` copies every `.png`/`.svg` it finds into `dist/`, and it only
skips the top-level `node_modules`. So a local build copies Playwright's icons
from `scripts/demo-video/node_modules` and failure screenshots from
`scripts/demo-video/out/` into `dist/scripts/`. `package.json` excludes
`dist/scripts` from `files`, so none of it reaches the npm package. Releases are
built by `publish.yml` on a clean checkout anyway.
