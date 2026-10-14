import type { IDataObject, IExecuteFunctions, ILoadOptionsFunctions } from 'n8n-workflow';
import { describe, expect, it, vi } from 'vitest';

import { CurlShot } from '../nodes/CurlShot/CurlShot.node';
import { PACKAGE_VERSION, USER_AGENT } from '../nodes/CurlShot/transport';
import pkg from '../package.json';
import { executeContext, jsonBody } from './helpers';

vi.mock('n8n-workflow', async (importOriginal) => ({
	...(await importOriginal<typeof import('n8n-workflow')>()),
	sleep: vi.fn(async () => undefined),
}));

const node = new CurlShot();

async function run(ctx: ReturnType<typeof executeContext>) {
	return await node.execute.call(ctx.context as unknown as IExecuteFunctions);
}

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

describe('Screenshot → Take', () => {
	it('posts the options and returns the image as binary with quota metadata', async () => {
		const ctx = executeContext({
			params: {
				resource: 'screenshot',
				operation: 'take',
				source: 'url',
				url: ' https://example.com/pricing ',
				imageFormat: 'png',
				output: 'binary',
				binaryPropertyName: 'data',
				options: { full_page: true, block_cookie_banners: true, selector: '' },
			},
			respond: [
				{
					headers: {
						'content-type': 'image/png',
						'x-reference-id': 'abc123',
						'x-quota-remaining': '99',
						'x-cache': 'MISS',
					},
					body: PNG,
				},
			],
		});

		const [[item]] = await run(ctx);

		const request = ctx.httpRequestWithAuthentication.mock.calls[0][1] as IDataObject;
		expect(ctx.httpRequestWithAuthentication.mock.calls[0][0]).toBe('curlShotApi');
		expect(request.method).toBe('POST');
		expect(request.url).toBe('https://curlshot.example/api/v1/screenshot');
		expect((request.headers as IDataObject)['User-Agent']).toBe(USER_AGENT);
		expect(JSON.parse(String(request.body))).toEqual({
			url: 'https://example.com/pricing',
			format: 'png',
			full_page: true,
			block_cookie_banners: true,
		});
		expect(item.binary?.data).toMatchObject({
			fileName: 'example.com-abc123.png',
			mimeType: 'image/png',
		});
		expect(item.json).toMatchObject({
			reference_id: 'abc123',
			quota_remaining: 99,
			cache: 'MISS',
			bytes: 4,
		});
		expect(item.pairedItem).toEqual({ item: 0 });
	});

	it('returns JSON with a link when Output is Link', async () => {
		const answer = {
			id: 'abc',
			url: 'https://curlshot.example/api/v1/files/abc.png?token=t',
			format: 'png',
			bytes: 10,
		};
		const ctx = executeContext({
			params: {
				resource: 'screenshot',
				operation: 'take',
				source: 'html',
				html: '<h1>Hi</h1>',
				imageFormat: 'webp',
				output: 'link',
			},
			respond: [{ headers: { 'content-type': 'application/json' }, body: jsonBody(answer) }],
		});

		const [[item]] = await run(ctx);

		const body = JSON.parse(
			String((ctx.httpRequestWithAuthentication.mock.calls[0][1] as IDataObject).body),
		);
		expect(body).toEqual({ html: '<h1>Hi</h1>', format: 'webp', response_type: 'json' });
		expect(item.json).toMatchObject(answer);
		expect(item.binary).toBeUndefined();
	});

	it('reports a non-JSON answer for Output Link as a node error, and continues on fail', async () => {
		const params = {
			resource: 'screenshot',
			operation: 'take',
			source: 'url',
			url: 'https://example.com',
			imageFormat: 'png',
			output: 'link',
		};
		const respond = () => [
			{ headers: { 'content-type': 'text/html' }, body: Buffer.from('<html>') },
		];

		await expect(run(executeContext({ params, respond: respond() }))).rejects.toThrow(
			'CurlShot sent an answer that is not JSON',
		);
		const [[item]] = await run(
			executeContext({ params, respond: respond(), continueOnFail: true }),
		);
		expect(item.json.error).toMatch(/not JSON/);
	});

	it('shows the API error message, code and upgrade link', async () => {
		const ctx = executeContext({
			params: {
				resource: 'screenshot',
				operation: 'take',
				source: 'url',
				url: 'https://example.com',
				imageFormat: 'png',
				output: 'binary',
			},
			respond: [
				{
					statusCode: 402,
					headers: { 'content-type': 'application/json', 'x-reference-id': 'r1' },
					body: jsonBody({
						error_code: 'quota_exceeded',
						error_message: 'You have used every screenshot in your plan this month.',
						upgrade_url: 'https://curlshot.example/dashboard/billing',
					}),
				},
			],
		});

		await expect(run(ctx)).rejects.toMatchObject({
			message: 'You have used every screenshot in your plan this month. (quota_exceeded)',
			httpCode: '402',
			description: expect.stringContaining('Upgrade: https://curlshot.example/dashboard/billing'),
		});
	});

	it('lists each rejected option', async () => {
		const ctx = executeContext({
			params: {
				resource: 'screenshot',
				operation: 'take',
				source: 'url',
				url: 'https://example.com',
				imageFormat: 'png',
				output: 'binary',
			},
			respond: [
				{
					statusCode: 400,
					body: jsonBody({
						error_code: 'invalid_options',
						error_message: 'Some options are not valid.',
						errors: [{ field: 'viewport_width', message: 'must be at most 3840' }],
					}),
				},
			],
		});

		await expect(run(ctx)).rejects.toMatchObject({
			description: expect.stringContaining('viewport_width: must be at most 3840'),
		});
	});

	it('keeps going with an error item when Continue On Fail is on', async () => {
		const ctx = executeContext({
			params: {
				resource: 'screenshot',
				operation: 'take',
				source: 'url',
				url: '',
				imageFormat: 'png',
				output: 'binary',
			},
			respond: [],
			continueOnFail: true,
		});

		const [[item]] = await run(ctx);
		expect(item.json.error).toMatch(/Enter the URL/);
		expect(ctx.httpRequestWithAuthentication).not.toHaveBeenCalled();
	});
});

describe('PDF and video', () => {
	it('sends PDF options with format pdf', async () => {
		const ctx = executeContext({
			params: {
				resource: 'pdf',
				operation: 'generate',
				source: 'markdown',
				markdown: '# Invoice',
				output: 'binary',
				binaryPropertyName: 'pdf',
				options: {},
				pdfOptions: { pdf_paper_format: 'letter', pdf_margin: '10mm' },
			},
			respond: [{ headers: { 'content-type': 'application/pdf' }, body: Buffer.from('%PDF') }],
		});

		const [[item]] = await run(ctx);

		const body = JSON.parse(
			String((ctx.httpRequestWithAuthentication.mock.calls[0][1] as IDataObject).body),
		);
		expect(body).toEqual({
			markdown: '# Invoice',
			format: 'pdf',
			pdf_paper_format: 'letter',
			pdf_margin: '10mm',
		});
		expect(item.binary?.pdf).toMatchObject({ mimeType: 'application/pdf', fileName: 'page.pdf' });
	});

	it('records a video in the chosen format', async () => {
		const ctx = executeContext({
			params: {
				resource: 'video',
				operation: 'record',
				source: 'url',
				url: 'https://example.com',
				videoFormat: 'gif',
				output: 'binary',
				binaryPropertyName: 'data',
				videoOptions: { video_duration: 5, video_fps: 12 },
			},
			respond: [{ headers: { 'content-type': 'image/gif' }, body: Buffer.from('GIF89a') }],
		});

		const [[item]] = await run(ctx);

		const body = JSON.parse(
			String((ctx.httpRequestWithAuthentication.mock.calls[0][1] as IDataObject).body),
		);
		expect(body).toEqual({
			url: 'https://example.com',
			format: 'gif',
			video_duration: 5,
			video_fps: 12,
		});
		expect(item.binary?.data).toMatchObject({ mimeType: 'image/gif', fileName: 'example.com.gif' });
	});
});

describe('Job', () => {
	const done = {
		job_id: 'job_1',
		status: 'done',
		screenshot: {
			id: 'shot_1',
			url: 'https://curlshot.example/api/v1/files/shot_1.png?expires=1&token=t',
			format: 'png',
			bytes: 4,
		},
	};

	it('creates an async job with a webhook and returns at once', async () => {
		const accepted = {
			job_id: 'job_1',
			status: 'queued',
			job_url: 'https://curlshot.example/api/v1/jobs/job_1',
		};
		const ctx = executeContext({
			params: {
				resource: 'job',
				operation: 'create',
				source: 'url',
				url: 'https://example.com',
				jobFormat: 'pdf',
				webhookUrl: 'https://n8n.example/webhook/abc/webhook',
				waitForCompletion: false,
				options: {},
				pdfOptions: { pdf_landscape: true },
			},
			respond: [{ statusCode: 202, body: jsonBody(accepted) }],
		});

		const [[item]] = await run(ctx);

		const body = JSON.parse(
			String((ctx.httpRequestWithAuthentication.mock.calls[0][1] as IDataObject).body),
		);
		expect(body).toEqual({
			url: 'https://example.com',
			format: 'pdf',
			pdf_landscape: true,
			async: true,
			webhook_url: 'https://n8n.example/webhook/abc/webhook',
		});
		expect(item.json).toEqual(accepted);
	});

	it('waits for completion, then downloads the file', async () => {
		const ctx = executeContext({
			params: {
				resource: 'job',
				operation: 'create',
				source: 'url',
				url: 'https://example.com',
				jobFormat: 'png',
				waitForCompletion: true,
				maxWait: 60,
				downloadFile: true,
				binaryPropertyName: 'data',
			},
			respond: [
				{ statusCode: 202, body: jsonBody({ job_id: 'job_1', status: 'queued' }) },
				{ body: jsonBody({ job_id: 'job_1', status: 'processing' }) },
				{ body: jsonBody(done) },
				{ headers: { 'content-type': 'image/png' }, body: PNG },
			],
		});

		const [[item]] = await run(ctx);

		const urls = ctx.httpRequestWithAuthentication.mock.calls.map(
			(call) => (call[1] as IDataObject).url,
		);
		expect(urls).toEqual([
			'https://curlshot.example/api/v1/screenshot',
			'https://curlshot.example/api/v1/jobs/job_1',
			'https://curlshot.example/api/v1/jobs/job_1',
			'https://curlshot.example/api/v1/files/shot_1.png?expires=1&token=t',
		]);
		expect(item.json).toEqual(done);
		expect(item.binary?.data).toMatchObject({
			mimeType: 'image/png',
			fileName: 'curlshot-shot_1.png',
		});
	});

	it('refuses to download a file link that points at another host', async () => {
		const ctx = executeContext({
			params: {
				resource: 'job',
				operation: 'get',
				jobId: 'job_1',
				downloadFile: true,
				binaryPropertyName: 'data',
			},
			respond: [
				{
					body: jsonBody({
						...done,
						screenshot: { ...done.screenshot, url: 'http://169.254.169.254/latest/meta-data' },
					}),
				},
			],
		});

		await expect(run(ctx)).rejects.toThrow(/does not point at https:\/\/curlshot.example/);
		expect(ctx.httpRequestWithAuthentication).toHaveBeenCalledTimes(1);
	});

	it('returns a failed job as JSON without downloading', async () => {
		const failed = {
			job_id: 'job_1',
			status: 'failed',
			screenshot: null,
			error_code: 'navigation_timeout',
		};
		const ctx = executeContext({
			params: { resource: 'job', operation: 'get', jobId: 'job_1', downloadFile: true },
			respond: [{ body: jsonBody(failed) }],
		});

		const [[item]] = await run(ctx);
		expect(item.json).toEqual(failed);
		expect(item.binary).toBeUndefined();
	});

	it('creates a bulk call from a list of URLs', async () => {
		const ctx = executeContext({
			params: {
				resource: 'job',
				operation: 'createBulk',
				bulkMode: 'urls',
				urls: 'https://example.com\nhttps://example.org',
				bulkFormat: 'jpeg',
				options: { full_page: true },
				webhookUrl: '',
			},
			respond: [{ statusCode: 202, body: jsonBody({ batch_id: 'b1', jobs: [] }) }],
		});

		const [[item]] = await run(ctx);

		const request = ctx.httpRequestWithAuthentication.mock.calls[0][1] as IDataObject;
		expect(request.url).toBe('https://curlshot.example/api/v1/bulk');
		expect(JSON.parse(String(request.body))).toEqual({
			requests: [
				{ url: 'https://example.com', format: 'jpeg', full_page: true },
				{ url: 'https://example.org', format: 'jpeg', full_page: true },
			],
		});
		expect(item.json.batch_id).toBe('b1');
	});

	it('rejects more than 100 bulk requests before calling the API', async () => {
		const ctx = executeContext({
			params: {
				resource: 'job',
				operation: 'createBulk',
				bulkMode: 'json',
				requestsJson: JSON.stringify(
					Array.from({ length: 101 }, () => ({ url: 'https://example.com' })),
				),
			},
			respond: [],
		});

		await expect(run(ctx)).rejects.toThrow(/at most 100/);
		expect(ctx.httpRequestWithAuthentication).not.toHaveBeenCalled();
	});

	it('reads a batch', async () => {
		const ctx = executeContext({
			params: { resource: 'job', operation: 'getBatch', batchId: 'b 1' },
			respond: [{ body: jsonBody({ batch_id: 'b 1', status: 'done' }) }],
		});

		await run(ctx);
		expect((ctx.httpRequestWithAuthentication.mock.calls[0][1] as IDataObject).url).toBe(
			'https://curlshot.example/api/v1/batches/b%201',
		);
	});
});

describe('Device and account', () => {
	it('returns one item per device preset', async () => {
		const ctx = executeContext({
			params: { resource: 'device', operation: 'getAll' },
			respond: [{ body: jsonBody({ devices: [{ name: 'iphone_15' }, { name: 'ipad' }] }) }],
		});

		const [items] = await run(ctx);
		expect(items.map((item) => item.json.name)).toEqual(['iphone_15', 'ipad']);
	});

	it('reads usage', async () => {
		const ctx = executeContext({
			params: { resource: 'account', operation: 'getUsage' },
			respond: [{ body: jsonBody({ quota: 100, used: 3, remaining: 97 }) }],
			credentials: { baseUrl: 'https://curlshot.example/' },
		});

		const [[item]] = await run(ctx);
		expect(item.json).toEqual({ quota: 100, used: 3, remaining: 97 });
		expect((ctx.httpRequestWithAuthentication.mock.calls[0][1] as IDataObject).url).toBe(
			'https://curlshot.example/api/v1/usage',
		);
	});

	it('loads device presets for the dropdown', async () => {
		const ctx = executeContext({
			params: {},
			respond: [
				{
					body: jsonBody({
						devices: [{ name: 'iphone_15', label: 'iPhone 15', category: 'phone' }],
					}),
				},
			],
		});

		const options = await node.methods.loadOptions.getDevices.call(
			ctx.context as unknown as ILoadOptionsFunctions,
		);
		expect(options).toEqual([{ name: 'iPhone 15', value: 'iphone_15', description: 'phone' }]);
	});
});

describe('package', () => {
	it('sends the published version in its User-Agent', () => {
		expect(PACKAGE_VERSION).toBe(pkg.version);
	});
});
