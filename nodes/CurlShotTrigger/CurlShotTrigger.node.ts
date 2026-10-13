import type {
	IDataObject,
	IHookFunctions,
	INodeType,
	INodeTypeDescription,
	IWebhookFunctions,
	IWebhookResponseData,
} from 'n8n-workflow';
import { NodeConnectionTypes } from 'n8n-workflow';

import { verifyWebhookSignature } from './signature';

const EVENTS = ['screenshot.completed', 'screenshot.failed'];

export class CurlShotTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'CurlShot Trigger',
		name: 'curlShotTrigger',
		icon: { light: 'file:curlshot.svg', dark: 'file:curlshot.dark.svg' },
		group: ['trigger'],
		version: 1,
		subtitle: '={{$parameter["events"].join(", ")}}',
		description: 'Starts the workflow when a CurlShot background render finishes',
		defaults: { name: 'CurlShot Trigger' },
		inputs: [],
		outputs: [NodeConnectionTypes.Main],
		credentials: [{ name: 'curlShotApi', required: true }],
		webhooks: [
			{
				name: 'default',
				httpMethod: 'POST',
				responseMode: 'onReceived',
				path: 'webhook',
			},
		],
		properties: [
			{
				displayName:
					"CurlShot sends a webhook per job, not per account: copy this node's production URL into the Webhook URL field of a CurlShot node (Job → Create or Create Bulk), or into the <code>webhook_url</code> of any API call.",
				name: 'notice',
				type: 'notice',
				default: '',
			},
			{
				displayName: 'Events',
				name: 'events',
				type: 'multiOptions',
				required: true,
				options: [
					{ name: 'Screenshot Completed', value: 'screenshot.completed' },
					{ name: 'Screenshot Failed', value: 'screenshot.failed' },
				],
				default: ['screenshot.completed', 'screenshot.failed'],
			},
			{
				displayName: 'Verify Signature',
				name: 'verifySignature',
				type: 'boolean',
				default: true,
				description:
					'Whether to reject deliveries that are not signed with your secret key. Needs the Secret Key in the credential.',
			},
		],
	};

	// CurlShot has no webhook registry: the address travels with each job, so
	// there is nothing to create or remove on CurlShot's side.
	webhookMethods = {
		default: {
			async checkExists(this: IHookFunctions): Promise<boolean> {
				return true;
			},
			async create(this: IHookFunctions): Promise<boolean> {
				return true;
			},
			async delete(this: IHookFunctions): Promise<boolean> {
				return true;
			},
		},
	};

	async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
		const req = this.getRequestObject();
		const res = this.getResponseObject();
		const body = this.getBodyData() as IDataObject;

		if (this.getNodeParameter('verifySignature', true) as boolean) {
			const credentials = await this.getCredentials('curlShotApi');
			const secret = typeof credentials.secretKey === 'string' ? credentials.secretKey.trim() : '';
			if (!secret) {
				res.status(500).json({
					error: 'Add the Secret Key to the CurlShot credential, or turn off Verify Signature',
				});
				return { noWebhookResponse: true };
			}
			const rawBody =
				(req as unknown as { rawBody?: Buffer }).rawBody ?? Buffer.from(JSON.stringify(body));
			const check = verifyWebhookSignature({
				rawBody,
				secret,
				signature: req.header('x-signature'),
				timestamp: req.header('x-timestamp'),
			});
			if (check !== 'ok') {
				res.status(401).json({ error: `Signature check failed: ${check}` });
				return { noWebhookResponse: true };
			}
		}

		const events = this.getNodeParameter('events', []) as string[];
		const event = typeof body.event === 'string' ? body.event : '';
		// Acknowledge events this workflow does not listen to, so CurlShot does not retry them.
		if (!EVENTS.includes(event) || !events.includes(event)) {
			return { webhookResponse: { received: true, ignored: true } };
		}

		return {
			workflowData: [
				[
					{
						json: {
							...body,
							webhook_attempt: req.header('x-webhook-attempt') ?? null,
						},
					},
				],
			],
		};
	}
}
