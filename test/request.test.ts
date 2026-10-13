import { describe, expect, it } from 'vitest';

import {
	buildBulkRequestsFromUrls,
	buildRenderBody,
	checkBulkSize,
	cleanOptions,
	fileNameFor,
	metaFromHeaders,
	mimeTypeFor,
	parseBulkJson,
	splitList,
} from '../nodes/CurlShot/request';

describe('cleanOptions', () => {
	it('drops empty strings so the API keeps its defaults', () => {
		expect(cleanOptions({ selector: '  ', time_zone: '', full_page: false, delay: 0 })).toEqual({
			full_page: false,
			delay: 0,
		});
	});

	it('sends hide_selectors as a list', () => {
		expect(cleanOptions({ hide_selectors: '.cookie-bar, #chat,,' })).toEqual({
			hide_selectors: ['.cookie-bar', '#chat'],
		});
	});
});

describe('buildRenderBody', () => {
	it('puts the source under its own API name with the format and options', () => {
		expect(
			buildRenderBody({
				source: 'url',
				value: 'https://example.com',
				format: 'jpeg',
				options: { full_page: true, viewport_device: '' },
				extra: [{ pdf_landscape: true }],
			}),
		).toEqual({ url: 'https://example.com', format: 'jpeg', full_page: true, pdf_landscape: true });
	});

	it('keeps HTML untouched', () => {
		expect(buildRenderBody({ source: 'html', value: ' <h1>Hi</h1> ', format: 'png' })).toEqual({
			html: ' <h1>Hi</h1> ',
			format: 'png',
		});
	});
});

describe('bulk input', () => {
	it('splits URLs on lines and shares the options', () => {
		expect(
			buildBulkRequestsFromUrls(
				'https://example.com\n https://example.org \n\nhttps://example.net\n',
				'pdf',
				{
					block_ads: true,
				},
			),
		).toEqual([
			{ url: 'https://example.com', format: 'pdf', block_ads: true },
			{ url: 'https://example.org', format: 'pdf', block_ads: true },
			{ url: 'https://example.net', format: 'pdf', block_ads: true },
		]);
	});

	it('keeps commas inside a URL', () => {
		expect(
			buildBulkRequestsFromUrls('https://example.com/report?fields=name,email', 'png', {}),
		).toEqual([{ url: 'https://example.com/report?fields=name,email', format: 'png' }]);
	});

	it('accepts a JSON array given as text or as a value', () => {
		expect(parseBulkJson('[{"url":"https://example.com"}]')).toEqual([
			{ url: 'https://example.com' },
		]);
		expect(parseBulkJson([{ url: 'https://example.com' }])).toEqual([
			{ url: 'https://example.com' },
		]);
	});

	it('explains bad JSON input', () => {
		expect(parseBulkJson('{nope')).toMatch(/not valid JSON/);
		expect(parseBulkJson('{"url":"https://example.com"}')).toMatch(/must be an array/);
		expect(parseBulkJson('["https://example.com"]')).toMatch(/must be an object/);
	});

	it('enforces 1 to 100 requests', () => {
		expect(checkBulkSize([])).toMatch(/at least one/);
		expect(checkBulkSize(Array.from({ length: 100 }, () => ({})))).toBeUndefined();
		expect(checkBulkSize(Array.from({ length: 101 }, () => ({})))).toMatch(/at most 100/);
	});

	it('splitList ignores blanks', () => {
		expect(splitList(' a ,\n\n b ')).toEqual(['a', 'b']);
	});
});

describe('files', () => {
	it('names a file after the host and reference id', () => {
		expect(
			fileNameFor({
				source: 'url',
				value: 'https://www.example.com/pricing',
				format: 'jpeg',
				id: 'abcdef1234567890',
			}),
		).toBe('example.com-abcdef123456.jpg');
		expect(fileNameFor({ source: 'html', value: '<h1>x</h1>', format: 'pdf' })).toBe('page.pdf');
		expect(fileNameFor({ source: 'url', value: 'not a url', format: 'png' })).toBe('page.png');
	});

	it('prefers the content type the API sent', () => {
		expect(mimeTypeFor('png', 'image/png; charset=binary')).toBe('image/png');
		expect(mimeTypeFor('mp4')).toBe('video/mp4');
		expect(mimeTypeFor('unknown')).toBe('application/octet-stream');
	});

	it('keeps quota and cache headers as JSON fields', () => {
		expect(
			metaFromHeaders({
				'x-reference-id': 'ref_1',
				'x-cache': 'MISS',
				'x-quota-remaining': '97',
				'x-quota-reset': '2026-11-01T00:00:00.000Z',
				'content-type': 'image/png',
			}),
		).toEqual({
			reference_id: 'ref_1',
			cache: 'MISS',
			quota_remaining: 97,
			quota_reset: '2026-11-01T00:00:00.000Z',
		});
	});
});
