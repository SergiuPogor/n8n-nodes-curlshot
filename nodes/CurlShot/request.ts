import type { IDataObject } from 'n8n-workflow';

export type Source = 'url' | 'html' | 'markdown';

export const BULK_MAX = 100;

/** Options sent to the API as a list (the node takes them comma-separated). */
const LIST_OPTIONS = new Set(['hide_selectors']);

/**
 * Copy node options into an API body: drop empty strings so the API uses its
 * own default, and turn comma-separated lists into arrays.
 */
export function cleanOptions(options: IDataObject): IDataObject {
	const body: IDataObject = {};
	for (const [name, value] of Object.entries(options)) {
		if (value === undefined || value === null) continue;
		if (typeof value === 'string') {
			const text = value.trim();
			if (!text) continue;
			body[name] = LIST_OPTIONS.has(name) ? splitList(text) : text;
			continue;
		}
		body[name] = value;
	}
	return body;
}

/** Split on new lines and commas, trimming blanks. */
export function splitList(text: string): string[] {
	return text
		.split(/[\n,]/)
		.map((part) => part.trim())
		.filter(Boolean);
}

export function buildRenderBody(input: {
	source: Source;
	value: string;
	format: string;
	options?: IDataObject;
	extra?: IDataObject[];
}): IDataObject {
	const body: IDataObject = { [input.source]: input.value, format: input.format };
	for (const group of [input.options ?? {}, ...(input.extra ?? [])]) {
		Object.assign(body, cleanOptions(group));
	}
	return body;
}

export function buildBulkRequestsFromUrls(
	urlsText: string,
	format: string,
	options: IDataObject,
): IDataObject[] {
	const shared = cleanOptions(options);
	return splitList(urlsText).map((url) => ({ url, format, ...shared }));
}

/** Validate the JSON input of Create Bulk. Returns an error message, or the requests. */
export function parseBulkJson(value: unknown): IDataObject[] | string {
	let parsed: unknown = value;
	if (typeof value === 'string') {
		try {
			parsed = JSON.parse(value);
		} catch {
			return 'Requests (JSON) is not valid JSON';
		}
	}
	if (!Array.isArray(parsed)) return 'Requests (JSON) must be an array of request objects';
	if (!parsed.every((entry) => entry && typeof entry === 'object' && !Array.isArray(entry))) {
		return 'Every entry in Requests (JSON) must be an object, for example { "url": "https://example.com" }';
	}
	return parsed as IDataObject[];
}

export function checkBulkSize(requests: IDataObject[]): string | undefined {
	if (requests.length === 0) return 'Add at least one request';
	if (requests.length > BULK_MAX) {
		return `A bulk call takes at most ${BULK_MAX} requests; got ${requests.length}. Split the list over several calls.`;
	}
	return undefined;
}

const EXTENSIONS: Record<string, string> = {
	png: 'png',
	jpeg: 'jpg',
	webp: 'webp',
	pdf: 'pdf',
	mp4: 'mp4',
	webm: 'webm',
	gif: 'gif',
};

const MIME_TYPES: Record<string, string> = {
	png: 'image/png',
	jpeg: 'image/jpeg',
	webp: 'image/webp',
	pdf: 'application/pdf',
	mp4: 'video/mp4',
	webm: 'video/webm',
	gif: 'image/gif',
};

export function mimeTypeFor(format: string, contentType?: string): string {
	const fromHeader = contentType?.split(';')[0].trim();
	return fromHeader || MIME_TYPES[format] || 'application/octet-stream';
}

/** A readable file name: host name (or "page") plus the reference id. */
export function fileNameFor(input: {
	source: Source;
	value: string;
	format: string;
	id?: string;
}): string {
	let stem = 'page';
	if (input.source === 'url') {
		try {
			stem = new URL(input.value).hostname.replace(/^www\./, '') || stem;
		} catch {
			// Not a valid URL: the API will say so; keep the generic name.
		}
	}
	const suffix = input.id ? `-${input.id.slice(0, 12)}` : '';
	return `${stem}${suffix}.${EXTENSIONS[input.format] ?? input.format}`;
}

/** Response headers worth keeping next to a binary result. */
export const META_HEADERS: Record<string, string> = {
	'x-reference-id': 'reference_id',
	'x-cache': 'cache',
	'x-render-ms': 'render_ms',
	'x-quota-limit': 'quota_limit',
	'x-quota-remaining': 'quota_remaining',
	'x-quota-reset': 'quota_reset',
};

export function metaFromHeaders(
	headers: Record<string, string | string[] | undefined>,
): IDataObject {
	const meta: IDataObject = {};
	for (const [headerName, field] of Object.entries(META_HEADERS)) {
		const raw = headers[headerName];
		const value = Array.isArray(raw) ? raw[0] : raw;
		if (value === undefined) continue;
		meta[field] = /^\d+$/.test(value) ? Number(value) : value;
	}
	return meta;
}
