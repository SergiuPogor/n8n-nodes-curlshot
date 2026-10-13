import { createHmac, timingSafeEqual } from 'crypto';

/** Seconds a webhook timestamp may differ from this clock (CurlShot uses the same window). */
export const WEBHOOK_TOLERANCE_SECONDS = 300;

export type SignatureCheck = 'ok' | 'missing' | 'stale' | 'mismatch';

/**
 * Check a CurlShot webhook: `x-signature` is the hex HMAC-SHA256 of
 * `<x-timestamp>.<raw body>`, keyed with the API key's secret key. The
 * timestamp is signed too, so an old delivery cannot be replayed.
 */
export function verifyWebhookSignature(input: {
	rawBody: Buffer;
	secret: string;
	signature: string | undefined;
	timestamp: string | undefined;
	nowMs?: number;
}): SignatureCheck {
	const { rawBody, secret, signature, timestamp } = input;
	if (!signature || !timestamp) return 'missing';
	if (!/^\d+$/.test(timestamp)) return 'stale';
	const nowSeconds = Math.floor((input.nowMs ?? Date.now()) / 1000);
	if (Math.abs(nowSeconds - Number(timestamp)) > WEBHOOK_TOLERANCE_SECONDS) return 'stale';

	const expected = createHmac('sha256', secret)
		.update(Buffer.concat([Buffer.from(`${timestamp}.`, 'utf8'), rawBody]))
		.digest('hex');
	const left = Buffer.from(expected, 'utf8');
	const right = Buffer.from(signature.trim().toLowerCase(), 'utf8');
	return left.length === right.length && timingSafeEqual(left, right) ? 'ok' : 'mismatch';
}
