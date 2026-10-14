// Settings shared by setup.mjs and record.mjs. Override with environment variables.
import { readFileSync } from 'node:fs';

const env = process.env;

export const config = {
	port: Number(env.N8N_DEMO_PORT ?? 5678),
	container: env.N8N_DEMO_CONTAINER ?? 'n8n-demo',
	volume: env.N8N_DEMO_VOLUME ?? 'n8n_demo',
	image: env.N8N_DEMO_IMAGE ?? 'docker.n8n.io/n8nio/n8n',
	packageSpec: env.N8N_DEMO_PACKAGE ?? 'n8n-nodes-curlshot@0.1.1',
	// Throwaway owner of the throwaway instance.
	owner: {
		email: 'demo@curlshot.com',
		firstName: 'CurlShot',
		lastName: 'Demo',
		// No committed default: a known password would open n8n to anything
		// that reaches the port. Read lazily so teardown.mjs needs no password.
		get password() {
			const password = env.N8N_DEMO_PASSWORD;
			if (!password) throw new Error('Set N8N_DEMO_PASSWORD to the owner password for the demo n8n.');
			return password;
		},
	},
	// A local Ollama model, so the recording needs no paid LLM key.
	chatModel: {
		node: 'Ollama Chat Model',
		model: env.N8N_DEMO_MODEL ?? 'qwen2.5:7b',
		credential: {
			name: 'Ollama (local)',
			type: 'ollamaApi',
			data: { baseUrl: env.N8N_DEMO_OLLAMA_URL ?? 'http://host.docker.internal:11434' },
		},
	},
	prompt: env.N8N_DEMO_PROMPT ?? 'Take a screenshot of https://n8n.io and tell me its file size in one sentence.',
	videoDir: env.N8N_DEMO_VIDEO_DIR ?? new URL('./out/', import.meta.url).pathname,
};

/**
 * The CurlShot access key typed on camera. Read from a file (JSON with
 * `accessKey`, or the bare key) so it never appears in shell history or logs.
 */
export function readAccessKey() {
	const file = env.CURLSHOT_KEY_FILE;
	if (!file) throw new Error('Set CURLSHOT_KEY_FILE to a file holding the CurlShot access key.');
	const raw = readFileSync(file, 'utf8').trim();
	if (!raw.startsWith('{')) return raw;
	let parsed;
	try {
		parsed = JSON.parse(raw);
	} catch {
		// The SyntaxError message quotes the file, which would print part of the key.
		throw new Error('CURLSHOT_KEY_FILE is not valid JSON.');
	}
	if (typeof parsed?.accessKey !== 'string' || !parsed.accessKey) {
		throw new Error('CURLSHOT_KEY_FILE has no "accessKey" string.');
	}
	return parsed.accessKey;
}
