// Records the n8n verification demo in ONE continuous take: one browser
// context, one `recordVideo`, no cuts. Run `node setup.mjs` first.
//
// Shown on camera: install n8n-nodes-curlshot@0.1.1 from npm, the credential
// test, Take a screenshot (binary view), Generate a PDF (binary view), and an
// AI Agent calling the CurlShot Tool, with the tool call opened in the logs.
//
// The access key is typed into n8n's password field (rendered as dots) while
// that field is blurred and covered by a caption, so it is never readable.
import { mkdirSync, readdirSync, renameSync } from 'node:fs';
import { chromium } from 'playwright';
import { config, readAccessKey } from './config.mjs';

const base = `http://localhost:${config.port}`;
const accessKey = readAccessKey();
const debug = process.env.N8N_DEMO_DEBUG === '1';

mkdirSync(config.videoDir, { recursive: true });

// Sign in outside the recorded context, then hand the session cookie over.
async function signIn() {
	const res = await fetch(`${base}/rest/login`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ emailOrLdapLoginId: config.owner.email, password: config.owner.password }),
	});
	if (!res.ok) throw new Error(`login -> ${res.status} ${await res.text()}`);
	return res.headers.getSetCookie().map((c) => {
		const [pair] = c.split(';');
		const i = pair.indexOf('=');
		return { name: pair.slice(0, i), value: pair.slice(i + 1), domain: 'localhost', path: '/' };
	});
}

// Visible cursor, click ripple, captions and key masking, injected into every page.
function overlay() {
	const css = `
		#demo-cursor { position: fixed; z-index: 2147483647; width: 22px; height: 22px; margin: -3px 0 0 -3px;
			pointer-events: none; transition: transform .08s; }
		#demo-cursor svg { filter: drop-shadow(0 1px 2px rgba(0,0,0,.45)); }
		.demo-ripple { position: fixed; z-index: 2147483646; width: 36px; height: 36px; margin: -18px 0 0 -18px;
			border-radius: 50%; border: 3px solid #ff6d5a; background: rgba(255,109,90,.25); pointer-events: none;
			animation: demo-ripple .6s ease-out forwards; }
		@keyframes demo-ripple { from { transform: scale(.4); opacity: 1 } to { transform: scale(1.8); opacity: 0 } }
		#demo-caption { position: fixed; z-index: 2147483645; left: 50%; bottom: 96px; transform: translateX(-50%);
			max-width: 1100px; padding: 14px 26px; border-radius: 12px; background: rgba(17,24,39,.9); color: #fff;
			font: 600 24px/1.35 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; text-align: center;
			pointer-events: none; box-shadow: 0 8px 30px rgba(0,0,0,.3); transition: opacity .3s; }
		#demo-caption.top { top: 84px; bottom: auto; }
		#demo-caption:empty { opacity: 0; }
		#demo-caption small { display: block; font-weight: 400; font-size: 18px; opacity: .85; margin-top: 4px; }
		/* The access key: password dots, blurred on top of that. */
		.demo-mask input { filter: blur(7px) !important; }
	`;
	const install = () => {
		if (document.getElementById('demo-cursor')) return;
		const style = document.createElement('style');
		style.textContent = css;
		document.head.appendChild(style);
		const cursor = document.createElement('div');
		cursor.id = 'demo-cursor';
		cursor.innerHTML =
			'<svg width="22" height="22" viewBox="0 0 24 24"><path d="M4 2l16 9.5-7 1.6L9.6 20z" fill="#111" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>';
		document.body.appendChild(cursor);
		// A closed shadow root keeps caption text out of reach of page selectors.
		const host = document.createElement('div');
		const root = host.attachShadow({ mode: 'closed' });
		const captionStyle = document.createElement('style');
		captionStyle.textContent = css;
		const caption = document.createElement('div');
		caption.id = 'demo-caption';
		root.append(captionStyle, caption);
		document.body.appendChild(host);
		window.__demoCaption = caption;
		const pos = JSON.parse(sessionStorage.getItem('demo-cursor') || '[960,540]');
		cursor.style.left = pos[0] + 'px';
		cursor.style.top = pos[1] + 'px';
		// Driven from the script (see moveTo), not from page mouse events:
		// some n8n panels swallow them, which froze the drawn cursor.
		window.__demoCursor = (x, y) => {
			cursor.style.left = x + 'px';
			cursor.style.top = y + 'px';
			sessionStorage.setItem('demo-cursor', JSON.stringify([x, y]));
		};
		window.__demoRipple = (x, y) => {
			const r = document.createElement('div');
			r.className = 'demo-ripple';
			r.style.left = x + 'px';
			r.style.top = y + 'px';
			document.body.appendChild(r);
			setTimeout(() => r.remove(), 700);
		};
	};
	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
	else install();
}

const browser = await chromium.launch({ headless: process.env.N8N_DEMO_HEADED !== '1', channel: process.env.N8N_DEMO_BROWSER ?? 'chrome', args: ['--window-size=1920,1080'] });
const context = await browser.newContext({
	viewport: { width: 1920, height: 1080 },
	recordVideo: { dir: config.videoDir, size: { width: 1920, height: 1080 } },
});
await context.addCookies(await signIn());
await context.addInitScript(overlay);
const page = await context.newPage();
page.setDefaultTimeout(30_000);

const pause = (ms) => page.waitForTimeout(ms);

async function caption(text, sub = '', where = 'bottom') {
	await page.evaluate(
		([t, s, w]) => {
			const el = window.__demoCaption;
			if (!el) return;
			el.className = w === 'top' ? 'top' : '';
			el.innerHTML = t ? `${t}${s ? `<small>${s}</small>` : ''}` : '';
		},
		[text, sub, where],
	);
}

let mouse = { x: 960, y: 540 };
async function moveTo(locator) {
	await locator.waitFor({ state: 'visible' });
	await locator.scrollIntoViewIfNeeded();
	const box = await locator.boundingBox();
	if (!box) throw new Error('no bounding box');
	const x = box.x + box.width / 2;
	const y = box.y + box.height / 2;
	const steps = Math.max(8, Math.round(Math.hypot(x - mouse.x, y - mouse.y) / 30));
	for (let i = 1; i <= steps; i++) {
		// Ease in and out, like a hand.
		const t = i / steps;
		const k = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
		const px = mouse.x + (x - mouse.x) * k;
		const py = mouse.y + (y - mouse.y) * k;
		await page.mouse.move(px, py);
		await page.evaluate(([cx, cy]) => window.__demoCursor?.(cx, cy), [px, py]);
	}
	mouse = { x, y };
}
async function click(locator, wait = 700) {
	await moveTo(locator);
	await pause(250);
	await page.evaluate(([cx, cy]) => window.__demoRipple?.(cx, cy), [mouse.x, mouse.y]);
	await locator.click();
	await pause(wait);
}
async function clickAt(x, y, wait = 500) {
	await moveTo({ waitFor: async () => {}, scrollIntoViewIfNeeded: async () => {}, boundingBox: async () => ({ x, y, width: 0, height: 0 }) });
	await page.evaluate(([cx, cy]) => window.__demoRipple?.(cx, cy), [x, y]);
	await page.mouse.click(x, y);
	await pause(wait);
}
async function type(locator, text, delay = 55) {
	await click(locator, 200);
	await locator.pressSequentially(text, { delay });
	await pause(400);
}
const byTest = (id) => page.locator(`[data-test-id="${id}"]`);
const creatorItem = (text) => byTest('item-iterator-item').filter({ hasText: text }).locator('visible=true').first();
const visibleText = (text) => page.getByText(text, { exact: true }).locator('visible=true').first();

async function searchNode(text) {
	const search = page.getByRole('textbox', { name: 'Search nodes...', exact: true });
	await search.waitFor();
	await pause(400);
	await search.pressSequentially(text, { delay: 70 });
	await pause(900);
}
// Runs the open node. A failed render (e.g. the target site timing out) is
// retried on camera, which n8n's single-take rule allows.
async function executeStep() {
	for (let attempt = 1; ; attempt++) {
		await click(byTest('node-execute-button').locator('visible=true').first(), 500);
		const failed = page.getByText(/CurlShot answered with HTTP/).locator('visible=true').first();
		let done = false;
		for (let waited = 0; waited < 90_000 && !done; waited += 500) {
			await pause(500);
			if (await inOutputPanel(byTest('ndv-run-data-display-mode'))) done = true;
			else if (await failed.isVisible()) break;
		}
		if (done) return;
		if (attempt === 3) throw new Error('the step failed three times');
		await caption('The target site was slow, so the render failed. Running the step again');
		await pause(2500);
	}
}

// The first visible match in the NDV's right-hand (output) column, or null.
async function inOutputPanel(locator) {
	const all = locator.locator('visible=true');
	for (let i = 0; i < (await all.count()); i++) {
		const box = await all.nth(i).boundingBox();
		if (box && box.x > 1170) return all.nth(i);
	}
	return null;
}

// The output "+" handle closest to the node with this label.
async function plusNear(label) {
	const node = await page.getByText(label, { exact: true }).locator('visible=true').first().boundingBox();
	const pluses = byTest('canvas-handle-plus').locator('visible=true');
	let best = null;
	let bestDist = Infinity;
	for (let i = 0; i < (await pluses.count()); i++) {
		const box = await pluses.nth(i).boundingBox();
		if (!box) continue;
		const d = Math.hypot(box.x - (node.x + node.width / 2), box.y - node.y);
		if (d < bestDist) {
			bestDist = d;
			best = pluses.nth(i);
		}
	}
	return best;
}
async function closeNdv() {
	await click(byTest('ndv-close-button'), 900);
}

async function step(name, fn) {
	if (debug) console.log(`-> ${name}`);
	try {
		await fn();
	} catch (err) {
		await page.screenshot({ path: `${config.videoDir}/fail-${name.replace(/\W+/g, '-')}.png` });
		throw new Error(`${name}: ${err.message}`);
	}
}

const started = Date.now();
try {
	await step('home', async () => {
		await page.goto(`${base}/home/workflows`);
		await page.getByText('Overview', { exact: true }).first().waitFor({ state: 'attached' }).catch(() => {});
		await pause(1200);
		await caption('CurlShot node for n8n: n8n-nodes-curlshot 0.1.1', 'A fresh, self-hosted n8n. The node is not installed yet.');
		await pause(4500);
	});

	await step('install', async () => {
		await caption('1. Install the node from npm', 'Settings → Community nodes → Install, version 0.1.1');
		await click(page.getByRole('menuitem', { name: 'Settings' }).locator('visible=true').first(), 1200);
		await click(page.getByRole('menuitem', { name: 'Community nodes' }), 1200);
		await click(page.getByRole('button', { name: 'Install a community node' }), 900);
		await type(byTest('package-name-input'), config.packageSpec, 70);
		await click(byTest('user-agreement-checkbox'), 600);
		await click(byTest('install-community-package-button'), 500);
		await page.getByText('n8n-nodes-curlshot', { exact: true }).waitFor({ timeout: 120_000 });
		await page.locator('[role="dialog"]').waitFor({ state: 'hidden', timeout: 60_000 }).catch(() => {});
		await pause(1200);
		const version = page.getByText(/v0\.1\.1/).last();
		await moveTo(version);
		await caption('1. Installed: n8n-nodes-curlshot v0.1.1', 'Nodes: CurlShot and CurlShot Trigger');
		await pause(3500);
	});

	await step('new workflow', async () => {
		await page.goto(`${base}/workflow/new`);
		await byTest('canvas-plus-button').waitFor();
		await caption('2. Build a workflow', 'Manual trigger → CurlShot: Take a screenshot');
		await pause(1200);
		await click(byTest('canvas-plus-button'), 900);
		await click(visibleText('Trigger manually'), 1200);
		await click(byTest('canvas-handle-plus').first(), 900);
		await searchNode('CurlShot');
		await click(visibleText('CurlShot'), 1500);
		await caption('2. The CurlShot node and its actions', 'Package version 0.1.1 shown at the bottom of the panel');
		await moveTo(page.getByText(/Package version/).first());
		await pause(2500);
		await click(visibleText('Take a screenshot'), 1500);
	});

	await step('credential', async () => {
		await caption('3. Add the CurlShot credential', 'Paste the access key, keep the default base URL, Save');
		await click(page.getByText('Connect to CurlShot', { exact: true }), 1200);
		const dialog = page.locator('[role="dialog"]').filter({ hasText: 'Access Key' });
		const keyField = dialog.locator('[data-test-id="parameter-input-apiKey"], .n8n-input').first();
		await keyField.evaluate((el) => el.classList.add('demo-mask'));
		await caption('3. Pasting the access key (hidden)', 'A fresh key made for this video, revoked after recording', 'top');
		await click(keyField, 300);
		await keyField.locator('input').fill(accessKey);
		await pause(1200);
		await caption('3. Save and test the connection', 'The test calls CurlShot’s free /api/v1/usage endpoint');
		await click(byTest('credential-save-button'), 500);
		// n8n tests the key on save; reopening the credential shows the result.
		await dialog.waitFor({ state: 'hidden', timeout: 30_000 }).catch(() => {});
		const success = page.getByText('Connection tested successfully').locator('visible=true').first();
		if (!(await success.isVisible())) {
			await pause(1200);
			await caption('3. Open the credential again to see the test result');
			await click(byTest('credential-edit-button').locator('visible=true').first(), 800);
		}
		await success.waitFor({ timeout: 30_000 });
		await moveTo(success);
		await caption('3. Connection tested successfully ✔', 'The credential is ready');
		await pause(4000);
		const closeButton = page.locator('[role="dialog"] button[aria-label="Close this dialog"], [role="dialog"] .el-dialog__headerbtn').locator('visible=true').first();
		if ((await closeButton.count()) > 0) await click(closeButton, 1000);
		else await page.keyboard.press('Escape');
		await success.waitFor({ state: 'hidden' });
	});

	await step('screenshot', async () => {
		await caption('4. Take a screenshot', 'URL https://example.com, PNG, full page, cookie banners blocked');
		await type(byTest('parameter-input-url').locator('input, textarea, [contenteditable]').first(), 'https://example.com');
		// Both options default to on once added.
		for (const option of ['Full Page', 'Block Cookie Banners']) {
			await click(page.getByRole('combobox', { name: 'Add Option' }).locator('visible=true').first(), 900);
			await click(page.getByRole('option', { name: option, exact: true }).locator('visible=true').first(), 900);
		}
		await caption('4. Execute the step', 'One real API call to CurlShot');
		await executeStep();
		await pause(1500);
	});

	await step('screenshot binary', async () => {
		await caption('4. The screenshot comes back as binary data', 'Ready for Slack, Google Drive, S3, email…');
		await click(await inOutputPanel(byTest('ndv-run-data-display-mode').getByText('Binary', { exact: true })), 1200);
		await viewBinary();
	});

	await step('pdf', async () => {
		await closeNdv();
		await caption('5. Generate a PDF', 'Same node: CurlShot → Generate a PDF');
		await click(byTest('canvas-handle-plus').locator('visible=true').last(), 900);
		await searchNode('CurlShot');
		await click(visibleText('CurlShot'), 1200);
		await click(visibleText('Generate a PDF'), 1500);
		await type(byTest('parameter-input-url').locator('input, textarea, [contenteditable]').first(), 'https://example.com');
		await executeStep();
		await pause(1500);
		await click(await inOutputPanel(byTest('ndv-run-data-display-mode').getByText('Binary', { exact: true })), 1200);
		await caption('5. The PDF, as binary data', 'application/pdf');
		await viewBinary();
		await closeNdv();
	});

	await step('agent', async () => {
		await caption('6. Use CurlShot as a tool for an AI Agent', 'AI Agent + chat trigger');
		// A chat trigger first, then the agent on its output.
		await clickAt(260, 300);
		await click(page.getByRole('button', { name: 'Open nodes panel' }), 900);
		await click(creatorItem('Add another trigger'), 1200);
		await click(creatorItem('On chat message'), 1500);
		if (await byTest('ndv-close-button').isVisible()) await closeNdv();
		await click(await plusNear('When chat message received'), 900);
		await searchNode('AI Agent');
		await click(visibleText('AI Agent'), 1500);
		await closeNdv();
		await caption('6. Chat model: a local Ollama model', 'Credential prepared before recording');
		await click(page.locator('.canvas-node-handle-non-main-input').nth(0).locator('[data-test-id="canvas-handle-plus"]'), 900);
		await searchNode('Ollama');
		await click(visibleText(config.chatModel.node), 1500);
		await click(byTest('parameter-input-model').getByRole('combobox').first(), 900);
		await click(visibleText(config.chatModel.model), 900);
		await closeNdv();
		await caption('6. Tool: CurlShot Tool', 'Same CurlShot credential, URL defined by the model');
		await click(page.locator('.canvas-node-handle-non-main-input').nth(2).locator('[data-test-id="canvas-handle-plus"]'), 900);
		await searchNode('CurlShot');
		await click(visibleText('CurlShot Tool'), 1500);
		await moveTo(byTest('node-credentials-select').locator('visible=true').first());
		await pause(1200);
		await click(byTest('parameter-input-url').locator('[data-test-id="from-ai-override-button"]'), 1500);
		await closeNdv();
	});

	await step('chat', async () => {
		await caption('7. Ask the agent in plain language', '', 'top');
		await click(byTest('workflow-chat-button'), 1200);
		const input = page.locator('textarea, input').and(page.getByPlaceholder(/Type message/)).first();
		await type(input, config.prompt, 45);
		await page.keyboard.press('Enter');
		await caption('7. The agent decides to call the CurlShot Tool…', '', 'top');
		const reply = page.locator('.chat-message-from-bot').filter({ hasText: /\d/ }).last();
		await reply.waitFor({ timeout: 240_000 });
		await pause(2500);
		await moveTo(reply);
		await caption('7. The agent used CurlShot and answered with the result', '', 'top');
		await pause(4000);
	});

	await step('logs', async () => {
		await caption('7. The CurlShot Tool call in the execution log', 'Input chosen by the model and the tool’s result', 'top');
		const toolEntry = byTest('logs-overview-body').getByText(/CurlShot/).first();
		// n8n usually opens the tool call by itself; clicking again would close it.
		if (await byTest('logs-details-body').isVisible()) await moveTo(toolEntry);
		else await click(toolEntry, 2500);
		await pause(5000);
	});

	await step('save', async () => {
		await caption('That’s it: install, credential, screenshot, PDF and AI agent tool', 'Thanks for reviewing n8n-nodes-curlshot!', 'top');
		await page.keyboard.press('ControlOrMeta+s');
		await pause(6000);
	});
} finally {
	console.log(`take length ~${Math.round((Date.now() - started) / 1000)} s`);
	const video = page.video();
	await context.close();
	await browser.close();
	if (video) {
		const path = await video.path();
		const target = `${config.videoDir}/take-${new Date().toISOString().replace(/[:.]/g, '-')}.webm`;
		renameSync(path, target);
		console.log(`video: ${target}`);
	}
	if (debug) console.log(readdirSync(config.videoDir).join('\n'));
}

// Opens the binary preview in the output panel, holds it on screen, closes it.
async function viewBinary() {
	// Only the output panel: the input panel shows the previous node's file.
	const view = await inOutputPanel(byTest('ndv-view-binary-data'));
	if (!view) {
		await pause(3000);
		return;
	}
	const popup = context.waitForEvent('page', { timeout: 4000 }).catch(() => null);
	await click(view, 500);
	const tab = await popup;
	if (tab) {
		// n8n opened the file in a new tab: the recording follows only the
		// original page, so show it in-page instead.
		await tab.close();
	}
	await pause(4500);
	const close = page.locator('[data-test-id="binary-data-view-close"], .binary-data-window-back, button:has-text("Back to list")').first();
	if ((await close.count()) > 0) await click(close, 800);
	else await page.keyboard.press('Escape');
}
