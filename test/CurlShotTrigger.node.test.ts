import type { IDataObject, IWebhookFunctions } from 'n8n-workflow';
import { createHmac } from 'crypto';
import { describe, expect, it, vi } from 'vitest';

import { CurlShotTrigger } from '../nodes/CurlShotTrigger/CurlShotTrigger.node';
import { verifyWebhookSignature } from '../nodes/CurlShotTrigger/signature';

const SECRET = 'sk_test_secret';
const NOW = 1_800_000_000_000;

function sign(body: string, timestamp: number, secret = SECRET): string {
	return createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
}

describe('verifyWebhookSignature', () => {
	const body = '{"event":"screenshot.completed","job_id":"job_1"}';
	const ts = Math.floor(NOW / 1000);

	it('accepts a correct signature', () => {
		expect(
			verifyWebhookSignature({
				rawBody: Buffer.from(body),
				secret: SECRET,
				signature: sign(body, ts),
				timestamp: String(ts),
				nowMs: NOW,
			}),
		).toBe('ok');
	});

	it('rejects a changed body or another secret', () => {
		const signature = sign(body, ts);
		expect(
			verifyWebhookSignature({
				rawBody: Buffer.from(`${body} `),
				secret: SECRET,
				signature,
				timestamp: String(ts),
				nowMs: NOW,
			}),
		).toBe('mismatch');
		expect(
			verifyWebhookSignature({
				rawBody: Buffer.from(body),
				secret: 'other',
				signature,
				timestamp: String(ts),
				nowMs: NOW,
			}),
		).toBe('mismatch');
	});

	it('rejects a replay outside the 5 minute window', () => {
		const old = ts - 301;
		expect(
			verifyWebhookSignature({
				rawBody: Buffer.from(body),
				secret: SECRET,
				signature: sign(body, old),
				timestamp: String(old),
				nowMs: NOW,
			}),
		).toBe('stale');
	});

	it('rejects missing headers', () => {
		expect(
			verifyWebhookSignature({
				rawBody: Buffer.from(body),
				secret: SECRET,
				signature: undefined,
				timestamp: String(ts),
			}),
		).toBe('missing');
	});
});

function webhookContext(input: {
	body: IDataObject;
	headers?: Record<string, string>;
	params?: IDataObject;
	secretKey?: string;
	noRawBody?: boolean;
}) {
	const raw = JSON.stringify(input.body);
	const res = { status: vi.fn(), json: vi.fn() };
	res.status.mockReturnValue(res);
	const headers = input.headers ?? {};
	const params: IDataObject = {
		verifySignature: true,
		events: ['screenshot.completed', 'screenshot.failed'],
		...input.params,
	};
	const context = {
		getRequestObject: () => ({
			rawBody: input.noRawBody ? undefined : Buffer.from(raw),
			header: (name: string) => headers[name.toLowerCase()],
		}),
		getResponseObject: () => res,
		getBodyData: () => input.body,
		getNodeParameter: (name: string) => params[name],
		getCredentials: async () => ({ apiKey: 'key', secretKey: input.secretKey ?? SECRET }),
	};
	return { context: context as unknown as IWebhookFunctions, res, raw };
}

function signedHeaders(raw: string): Record<string, string> {
	const ts = Math.floor(Date.now() / 1000);
	return { 'x-timestamp': String(ts), 'x-signature': sign(raw, ts), 'x-webhook-attempt': '1' };
}

describe('CurlShot Trigger', () => {
	const trigger = new CurlShotTrigger();
	const event = { event: 'screenshot.completed', job_id: 'job_1', status: 'done' };

	it('starts the workflow for a signed delivery', async () => {
		const raw = JSON.stringify(event);
		const { context } = webhookContext({ body: event, headers: signedHeaders(raw) });

		const result = await trigger.webhook.call(context);
		expect(result.workflowData?.[0][0].json).toEqual({ ...event, webhook_attempt: '1' });
	});

	it('answers 401 and does not start for a bad signature', async () => {
		const { context, res } = webhookContext({
			body: event,
			headers: { 'x-timestamp': String(Math.floor(Date.now() / 1000)), 'x-signature': 'deadbeef' },
		});

		const result = await trigger.webhook.call(context);
		expect(res.status).toHaveBeenCalledWith(401);
		expect(result).toEqual({ noWebhookResponse: true });
	});

	it('answers 400 and does not start when the raw body is missing', async () => {
		const raw = JSON.stringify(event);
		const { context, res } = webhookContext({
			body: event,
			headers: signedHeaders(raw),
			noRawBody: true,
		});

		const result = await trigger.webhook.call(context);
		expect(res.status).toHaveBeenCalledWith(400);
		expect(result).toEqual({ noWebhookResponse: true });
	});

	it('asks for the secret key when verification is on but none is set', async () => {
		const { context, res } = webhookContext({ body: event, secretKey: '' });

		await trigger.webhook.call(context);
		expect(res.status).toHaveBeenCalledWith(500);
		expect(res.json).toHaveBeenCalledWith({ error: expect.stringMatching(/Secret Key/) });
	});

	it('skips events the workflow does not listen to, but acknowledges them', async () => {
		const failed = { ...event, event: 'screenshot.failed' };
		const raw = JSON.stringify(failed);
		const { context } = webhookContext({
			body: failed,
			headers: signedHeaders(raw),
			params: { events: ['screenshot.completed'] },
		});

		const result = await trigger.webhook.call(context);
		expect(result.workflowData).toBeUndefined();
		expect(result.webhookResponse).toEqual({ received: true, ignored: true });
	});

	it('accepts unsigned deliveries when verification is off', async () => {
		const { context } = webhookContext({ body: event, params: { verifySignature: false } });

		const result = await trigger.webhook.call(context);
		expect(result.workflowData?.[0][0].json.job_id).toBe('job_1');
	});
});
