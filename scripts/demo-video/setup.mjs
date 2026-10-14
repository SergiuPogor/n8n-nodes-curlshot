// Prepares a fresh, throwaway n8n for the demo recording. Nothing here is filmed:
// it (re)creates the container and volume, creates the owner account and the
// chat-model credential the AI Agent picks from a list on camera.
//
// The CurlShot node is NOT installed here: installing it is part of the take.
import { execFileSync } from 'node:child_process';
import { config } from './config.mjs';

const { port, container, volume, image, owner, chatModel } = config;
const base = `http://localhost:${port}`;

function docker(...args) {
	return execFileSync('docker', args, { stdio: ['ignore', 'pipe', 'pipe'] }).toString().trim();
}

function quiet(fn) {
	try {
		fn();
	} catch {
		// The container or volume did not exist yet.
	}
}

async function waitForHealthy() {
	for (let i = 0; i < 90; i++) {
		try {
			const res = await fetch(`${base}/healthz/readiness`);
			if (res.ok) return;
		} catch {
			// Not listening yet.
		}
		await new Promise((r) => setTimeout(r, 2000));
	}
	throw new Error(`n8n did not become ready on ${base}`);
}

async function rest(cookie, path, body) {
	const res = await fetch(`${base}/rest${path}`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
		body: JSON.stringify(body),
	});
	if (!res.ok) throw new Error(`POST ${path} -> ${res.status} ${await res.text()}`);
	return res;
}

quiet(() => docker('rm', '-f', container));
quiet(() => docker('volume', 'rm', volume));
docker(
	'run', '-d', '--name', container,
	// Loopback only: the owner password is committed, so keep it off the LAN.
	'-p', `127.0.0.1:${port}:${port}`,
	'-e', `N8N_PORT=${port}`,
	'-e', 'N8N_COMMUNITY_PACKAGES_ALLOW_TOOL_USAGE=true',
	'-e', 'N8N_DIAGNOSTICS_ENABLED=false',
	'-e', 'N8N_PERSONALIZATION_ENABLED=false',
	'-e', 'N8N_SECURE_COOKIE=false',
	'-v', `${volume}:/home/node/.n8n`,
	image,
);
await waitForHealthy();

const setup = await rest(null, '/owner/setup', owner);
const cookie = setup.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
await rest(cookie, '/credentials', chatModel.credential);

console.log(`n8n ${docker('exec', container, 'n8n', '--version')} ready on ${base}`);
console.log(`Chat model credential "${chatModel.credential.name}" created.`);
