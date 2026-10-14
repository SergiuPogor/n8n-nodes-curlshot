import type { IDataObject } from 'n8n-workflow';
import { vi } from 'vitest';

export interface FakeResponse {
	statusCode?: number;
	headers?: Record<string, string>;
	body?: unknown;
}

export const NODE = {
	id: '1',
	name: 'CurlShot',
	type: 'n8n-nodes-curlshot.curlShot',
	typeVersion: 1,
	position: [0, 0],
	parameters: {},
};

export function jsonBody(value: unknown): Buffer {
	return Buffer.from(JSON.stringify(value), 'utf8');
}

/**
 * A minimal IExecuteFunctions: parameters come from `params`, and every API
 * call is answered by `respond` (in call order when it is an array).
 */
export function executeContext(input: {
	params: IDataObject;
	respond: FakeResponse[] | ((request: IDataObject) => FakeResponse);
	credentials?: IDataObject;
	continueOnFail?: boolean;
	items?: number;
}) {
	const queue = Array.isArray(input.respond) ? [...input.respond] : null;
	const httpRequestWithAuthentication = vi.fn(async (_credential: string, request: IDataObject) => {
		const answer = queue
			? queue.shift()
			: (input.respond as (r: IDataObject) => FakeResponse)(request);
		if (!answer)
			throw new Error(`Unexpected request ${String(request.method)} ${String(request.url)}`);
		return {
			statusCode: answer.statusCode ?? 200,
			headers: answer.headers ?? {},
			body: answer.body ?? Buffer.alloc(0),
		};
	});
	const prepareBinaryData = vi.fn(async (data: Buffer, fileName: string, mimeType: string) => ({
		data: data.toString('base64'),
		fileName,
		mimeType,
	}));
	const context = {
		getInputData: () => Array.from({ length: input.items ?? 1 }, () => ({ json: {} })),
		getNodeParameter: (name: string, _i: number, fallback?: unknown) =>
			name in input.params ? input.params[name] : fallback,
		getNode: () => NODE,
		getCredentials: async () => ({
			apiKey: 'key',
			baseUrl: 'https://curlshot.example',
			...input.credentials,
		}),
		continueOnFail: () => input.continueOnFail ?? false,
		helpers: { httpRequestWithAuthentication, prepareBinaryData },
	};
	return { context, httpRequestWithAuthentication, prepareBinaryData };
}
