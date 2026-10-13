# n8n-nodes-curlshot

An [n8n](https://n8n.io) community node for [CurlShot](https://curlshot.com/?utm_source=n8n&utm_medium=integration&utm_campaign=dist-q4), the website screenshot API.

Capture any URL, HTML or Markdown as PNG, JPEG, WebP or PDF, or record the page scrolling as MP4, WebM or GIF. You can capture the full page or a single element, use a phone or tablet preset, switch on dark mode, and block ads and cookie banners. Results come back as binary data, ready for Slack, email, Google Drive or S3 nodes.

A free CurlShot key gives 100 screenshots a month with no card. Failed renders and cache hits don't count.

- [Installation](#installation)
- [Credentials](#credentials)
- [Operations](#operations)
- [CurlShot Trigger](#curlshot-trigger)
- [Example workflows](#example-workflows)
- [Compatibility](#compatibility)
- [Development](#development)

## Installation

In n8n, open **Settings → Community nodes → Install** and enter `n8n-nodes-curlshot`.
See the n8n [community nodes installation guide](https://docs.n8n.io/integrations/community-nodes/installation/) for details.

## Credentials

1. Create a free account at [curlshot.com](https://curlshot.com/?utm_source=n8n&utm_medium=integration&utm_campaign=dist-q4) and open **Dashboard → API keys**.
2. In n8n, add a **CurlShot API** credential and paste the **Access Key**.
3. Optional: paste the **Secret Key** as well. Only the CurlShot Trigger needs it, to check webhook signatures.

The credential test calls `GET /api/v1/usage`, which is free and never uses a screenshot.
Leave **Base URL** at `https://curlshot.com` unless support gives you another address.

## Operations

| Resource | Operation | What it does |
| --- | --- | --- |
| Screenshot | Take | Capture a URL, HTML or Markdown as PNG, JPEG or WebP |
| PDF | Generate | Print a URL, HTML or Markdown to PDF (paper size, margins, landscape, one tall page) |
| Video | Record | Record the page scrolling as MP4, WebM or GIF (duration, frame rate, scroll back) |
| Job | Create | Render in the background. Optionally wait for the result, or have it sent to a webhook |
| Job | Create Bulk | Queue up to 100 renders in one call, from a list of URLs or a JSON array |
| Job | Get | Read a background job, and download its file once done |
| Job | Get Batch | Read every job of one bulk call |
| Device | Get Many | List the phone, tablet, laptop and desktop presets |
| Account | Get Usage | Plan, quota and screenshots left this period |

**Output.** Screenshot, PDF and Video return the file in a binary field (`data` by default). The JSON next to it holds the reference id, cache status and quota left (`quota_remaining`). Choose **Output → Link** to get JSON with a link to the stored file instead.

**Options.** These include full page, element selector, device preset, viewport size, scale factor, dark mode, reduced motion, delay, wait until, wait for selector, timeout, hide selectors, custom CSS and JavaScript, click before capture, time zone, image quality and width, transparent background, cache, and blocking of ads, cookie banners, chat widgets and trackers. The names match the [API parameters](https://curlshot.com/docs?utm_source=n8n&utm_medium=integration&utm_campaign=dist-q4).

**Errors.** API errors show CurlShot's own message and code. When your quota is used up, the error includes the upgrade link and the reference id. Turn on **Continue On Fail** to get them as items instead.

The node can also be used as a tool by n8n AI agents.

## CurlShot Trigger

Starts a workflow when a background render finishes (`screenshot.completed` or `screenshot.failed`).

1. Add a **CurlShot Trigger** node and copy its **Production URL**.
2. In a CurlShot node, choose **Job → Create** (or **Create Bulk**) and paste that URL into **Webhook URL**.
3. Activate the workflow that has the trigger.

CurlShot attaches the webhook address to each job; nothing is registered on your account. **Verify Signature** is on by default. It checks the `x-signature` header (HMAC-SHA256 of `<x-timestamp>.<body>`, keyed with your secret key). It also refuses deliveries more than 5 minutes old, so a captured delivery can't be replayed. To download the file, add a CurlShot node with **Job → Get** and the `job_id` from the event.

## Example workflows

- **Competitor pricing watch:** Schedule Trigger (daily) → CurlShot *Screenshot → Take* (`https://competitor.example/pricing`, Full Page) → Slack *Upload a file*.
- **Save submitted pages as PDF:** Form Trigger → CurlShot *PDF → Generate* → Google Drive *Upload*.
- **Weekly site archive:** Schedule Trigger → CurlShot *Job → Create Bulk* with your sitemap URLs and a webhook → CurlShot Trigger → CurlShot *Job → Get* → S3 *Upload*.

## Compatibility

Uses community node API version 1 (`n8nNodesApiVersion: 1`) and is unit-tested against `n8n-workflow` 2.16. No runtime dependencies.

## Development

```bash
npm ci --ignore-scripts
npm run lint        # n8n community node rules (the same ones n8n Cloud verification uses)
npm run typecheck
npm test            # vitest unit tests, no network
npm run build
npm run dev         # starts a local n8n with this node loaded
```

### Releasing

Publishing happens only from GitHub Actions, with an npm provenance statement, as n8n requires.

1. Bump `version` in `package.json` in a pull request and merge it to `main`.
2. Push a tag with the same version: `git tag 0.2.0 && git push origin 0.2.0`.
3. `.github/workflows/publish.yml` runs the checks, publishes to npm and runs `npx @n8n/scan-community-package` on the published version.

The workflow uses the `NPM_TOKEN` repository secret. Once the package exists on npm, you can switch to npm trusted publishing for `publish.yml` and delete the secret.

## Resources

- [CurlShot API docs](https://curlshot.com/docs?utm_source=n8n&utm_medium=integration&utm_campaign=dist-q4)
- [n8n community nodes documentation](https://docs.n8n.io/integrations/#community-nodes)

## License

[MIT](LICENSE.md)
