import type {
	IDataObject,
	IExecuteFunctions,
	IHttpRequestMethods,
	IHttpRequestOptions,
	ILoadOptionsFunctions,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError, NodeOperationError } from 'n8n-workflow';

import { version } from '../../package.json';

export const PACKAGE_VERSION = version;
export const USER_AGENT = `n8n-nodes-curlshot/${PACKAGE_VERSION}`;
export const DEFAULT_BASE_URL = 'https://curlshot.com';

type Ctx = IExecuteFunctions | ILoadOptionsFunctions;

export interface RawResponse {
	statusCode: number;
	headers: Record<string, string | string[] | undefined>;
	body: Buffer;
}

export function normalizeBaseUrl(value: unknown): string {
	const text = typeof value === 'string' && value.trim() ? value.trim() : DEFAULT_BASE_URL;
	return text.replace(/\/+$/, '');
}

export async function getBaseUrl(this: Ctx): Promise<string> {
	const credentials = await this.getCredentials('curlShotApi');
	return normalizeBaseUrl(credentials.baseUrl);
}

export function header(response: RawResponse, name: string): string | undefined {
	const value = response.headers[name.toLowerCase()];
	return Array.isArray(value) ? value[0] : value;
}

function toBuffer(body: unknown): Buffer {
	if (Buffer.isBuffer(body)) return body;
	if (body instanceof ArrayBuffer) return Buffer.from(body);
	if (ArrayBuffer.isView(body)) return Buffer.from(body.buffer, body.byteOffset, body.byteLength);
	if (typeof body === 'string') return Buffer.from(body, 'utf8');
	if (body === undefined || body === null) return Buffer.alloc(0);
	return Buffer.from(JSON.stringify(body), 'utf8');
}

export function parseJson(body: Buffer): IDataObject | undefined {
	try {
		const parsed: unknown = JSON.parse(body.toString('utf8'));
		return parsed && typeof parsed === 'object' ? (parsed as IDataObject) : undefined;
	} catch {
		return undefined;
	}
}

/** Turn a CurlShot error answer into an n8n error that shows the API's own message. */
export function apiError(this: Ctx, response: RawResponse, itemIndex?: number): NodeApiError {
	const parsed = parseJson(response.body) ?? {};
	const code = typeof parsed.error_code === 'string' ? parsed.error_code : undefined;
	const message =
		typeof parsed.error_message === 'string'
			? parsed.error_message
			: `CurlShot answered with HTTP ${response.statusCode}`;
	const details: string[] = [];
	if (Array.isArray(parsed.errors)) {
		for (const entry of parsed.errors as IDataObject[]) {
			const where = entry.index !== undefined ? `requests[${entry.index}].` : '';
			details.push(`${where}${entry.field}: ${entry.message}`);
		}
	}
	if (typeof parsed.upgrade_url === 'string') details.push(`Upgrade: ${parsed.upgrade_url}`);
	if (typeof parsed.documentation_url === 'string')
		details.push(`Docs: ${parsed.documentation_url}`);
	const reference = header(response, 'x-reference-id');
	if (reference) details.push(`Reference id: ${reference}`);
	return new NodeApiError(
		this.getNode(),
		{ ...parsed, httpCode: String(response.statusCode) } as JsonObject,
		{
			message: code ? `${message} (${code})` : message,
			description: details.join('\n') || undefined,
			httpCode: String(response.statusCode),
			itemIndex,
		},
	);
}

/**
 * One authenticated call to the CurlShot API. The body comes back as raw bytes
 * so the same helper serves file downloads and JSON answers; HTTP errors are
 * turned into NodeApiError with the API's message.
 */
export async function curlShotRequest(
	this: Ctx,
	method: IHttpRequestMethods,
	path: string,
	options: { body?: IDataObject; qs?: IDataObject; itemIndex?: number } = {},
): Promise<RawResponse> {
	const baseUrl = await getBaseUrl.call(this);
	const request: IHttpRequestOptions = {
		method,
		url: `${baseUrl}${path}`,
		headers: { 'User-Agent': USER_AGENT, Accept: '*/*' },
		qs: options.qs,
		encoding: 'arraybuffer',
		returnFullResponse: true,
		ignoreHttpStatusErrors: true,
		json: false,
	};
	if (options.body !== undefined) {
		request.body = JSON.stringify(options.body);
		request.headers = { ...request.headers, 'Content-Type': 'application/json' };
	}

	let raw: IDataObject;
	try {
		raw = (await this.helpers.httpRequestWithAuthentication.call(
			this,
			'curlShotApi',
			request,
		)) as IDataObject;
	} catch (error) {
		throw new NodeApiError(this.getNode(), error as JsonObject, { itemIndex: options.itemIndex });
	}
	const response: RawResponse = {
		statusCode: Number(raw.statusCode ?? 0),
		headers: (raw.headers ?? {}) as RawResponse['headers'],
		body: toBuffer(raw.body),
	};
	if (response.statusCode >= 400) throw apiError.call(this, response, options.itemIndex);
	return response;
}

/** JSON call: parses the answer and fails clearly when it is not JSON. */
export async function curlShotJson(
	this: Ctx,
	method: IHttpRequestMethods,
	path: string,
	options: { body?: IDataObject; qs?: IDataObject; itemIndex?: number } = {},
): Promise<IDataObject> {
	const response = await curlShotRequest.call(this, method, path, options);
	const parsed = parseJson(response.body);
	if (!parsed) {
		throw new NodeOperationError(this.getNode(), 'CurlShot sent an answer that is not JSON', {
			itemIndex: options.itemIndex,
		});
	}
	return parsed;
}

/**
 * Download a stored result from a link CurlShot handed out. The link must
 * point at the configured CurlShot address, so a job record can never make
 * n8n fetch some other host.
 */
export async function downloadResultFile(
	this: IExecuteFunctions,
	fileUrl: string,
	itemIndex: number,
): Promise<RawResponse> {
	const baseUrl = await getBaseUrl.call(this);
	if (!isSameOrigin(fileUrl, baseUrl)) {
		throw new NodeOperationError(
			this.getNode(),
			`The file link does not point at ${baseUrl}, so it was not downloaded`,
			{ itemIndex },
		);
	}
	const target = new URL(fileUrl);
	return await curlShotRequest.call(this, 'GET', `${target.pathname}${target.search}`, {
		itemIndex,
	});
}

export function isSameOrigin(link: string, baseUrl: string): boolean {
	try {
		return new URL(link).origin === new URL(baseUrl).origin;
	} catch {
		return false;
	}
}
