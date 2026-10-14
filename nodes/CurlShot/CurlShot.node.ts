import type {
	IDataObject,
	IExecuteFunctions,
	ILoadOptionsFunctions,
	INode,
	INodeExecutionData,
	INodePropertyOptions,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeApiError, NodeConnectionTypes, NodeOperationError, sleep } from 'n8n-workflow';

import {
	commonOptions,
	formatProperties,
	jobProperties,
	operationProperties,
	outputProperties,
	pdfOptions,
	resourceProperty,
	sourceProperties,
	videoOptions,
} from './descriptions';
import {
	buildBulkRequestsFromUrls,
	buildRenderBody,
	checkBulkSize,
	fileNameFor,
	metaFromHeaders,
	mimeTypeFor,
	parseBulkJson,
	type Source,
} from './request';
import {
	curlShotJson,
	curlShotRequest,
	downloadResultFile,
	header,
	parseJson,
	type RawResponse,
} from './transport';

const POLL_INTERVAL_MS = 3000;

export class CurlShot implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'CurlShot',
		name: 'curlShot',
		icon: { light: 'file:curlshot.svg', dark: 'file:curlshot.dark.svg' },
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Take website screenshots, PDFs and scrolling videos with the CurlShot API',
		defaults: { name: 'CurlShot' },
		usableAsTool: true,
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [{ name: 'curlShotApi', required: true }],
		properties: [
			resourceProperty,
			...operationProperties,
			...sourceProperties,
			...formatProperties,
			...outputProperties,
			...jobProperties,
			commonOptions,
			...pdfOptions,
			...videoOptions,
		],
	};

	methods = {
		loadOptions: {
			// The device list is free to read: it never uses a screenshot.
			async getDevices(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const answer = await curlShotJson.call(this, 'GET', '/api/v1/devices');
				const devices = (answer.devices ?? []) as Array<{
					name: string;
					label: string;
					category?: string;
				}>;
				return devices.map((device) => ({
					name: device.label,
					value: device.name,
					description: device.category,
				}));
			},
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let i = 0; i < items.length; i++) {
			try {
				const resource = this.getNodeParameter('resource', i) as string;
				const operation = this.getNodeParameter('operation', i) as string;
				const results = await runOperation.call(this, resource, operation, i);
				returnData.push(...results.map((result) => ({ ...result, pairedItem: { item: i } })));
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: { error: (error as Error).message },
						pairedItem: { item: i },
					});
					continue;
				}
				throw asNodeError(this.getNode(), error, i);
			}
		}

		return [returnData];
	}
}

/** Keep errors that already carry n8n context (HTTP code, item); wrap anything else. */
function asNodeError(
	node: INode,
	error: unknown,
	itemIndex: number,
): NodeApiError | NodeOperationError {
	if (error instanceof NodeApiError || error instanceof NodeOperationError) return error;
	return new NodeOperationError(node, error as Error, { itemIndex });
}

async function runOperation(
	this: IExecuteFunctions,
	resource: string,
	operation: string,
	i: number,
): Promise<INodeExecutionData[]> {
	if (resource === 'screenshot' && operation === 'take') {
		return [await render.call(this, i, this.getNodeParameter('imageFormat', i) as string)];
	}
	if (resource === 'pdf' && operation === 'generate') {
		return [await render.call(this, i, 'pdf', 'pdfOptions')];
	}
	if (resource === 'video' && operation === 'record') {
		return [
			await render.call(this, i, this.getNodeParameter('videoFormat', i) as string, 'videoOptions'),
		];
	}
	if (resource === 'job') {
		if (operation === 'create') return [await createJob.call(this, i)];
		if (operation === 'get') return [await getJob.call(this, i)];
		if (operation === 'createBulk') return [await createBulk.call(this, i)];
		if (operation === 'getBatch') {
			const batchId = encodeURIComponent((this.getNodeParameter('batchId', i) as string).trim());
			return [
				{
					json: await curlShotJson.call(this, 'GET', `/api/v1/batches/${batchId}`, {
						itemIndex: i,
					}),
				},
			];
		}
	}
	if (resource === 'device' && operation === 'getAll') {
		const answer = await curlShotJson.call(this, 'GET', '/api/v1/devices', { itemIndex: i });
		return ((answer.devices as IDataObject[]) ?? []).map((device) => ({ json: device }));
	}
	if (resource === 'account' && operation === 'getUsage') {
		return [{ json: await curlShotJson.call(this, 'GET', '/api/v1/usage', { itemIndex: i }) }];
	}
	throw new NodeOperationError(
		this.getNode(),
		`Unsupported operation "${operation}" for "${resource}"`,
		{
			itemIndex: i,
		},
	);
}

function readSource(this: IExecuteFunctions, i: number): { source: Source; value: string } {
	const source = this.getNodeParameter('source', i) as Source;
	const value = (this.getNodeParameter(source, i) as string) ?? '';
	if (!value.trim()) {
		throw new NodeOperationError(this.getNode(), `Enter the ${source.toUpperCase()} to render`, {
			itemIndex: i,
		});
	}
	return { source, value: source === 'url' ? value.trim() : value };
}

function renderBody(
	this: IExecuteFunctions,
	i: number,
	format: string,
	extraName?: string,
): IDataObject {
	const { source, value } = readSource.call(this, i);
	const options = this.getNodeParameter('options', i, {}) as IDataObject;
	const extra = extraName ? [this.getNodeParameter(extraName, i, {}) as IDataObject] : [];
	return buildRenderBody({ source, value, format, options, extra });
}

async function binaryItem(
	this: IExecuteFunctions,
	response: RawResponse,
	i: number,
	input: {
		source: Source;
		value: string;
		format: string;
		propertyName: string;
		json?: IDataObject;
	},
): Promise<INodeExecutionData> {
	const meta = metaFromHeaders(response.headers);
	const id = typeof meta.reference_id === 'string' ? meta.reference_id : undefined;
	const fileName = fileNameFor({
		source: input.source,
		value: input.value,
		format: input.format,
		id,
	});
	const binary = await this.helpers.prepareBinaryData(
		response.body,
		fileName,
		mimeTypeFor(input.format, header(response, 'content-type')),
	);
	return {
		json: {
			...input.json,
			...meta,
			format: input.format,
			bytes: response.body.length,
			file_name: fileName,
		},
		binary: { [input.propertyName]: binary },
	};
}

async function render(
	this: IExecuteFunctions,
	i: number,
	format: string,
	extraName?: string,
): Promise<INodeExecutionData> {
	const body = renderBody.call(this, i, format, extraName);
	const output = this.getNodeParameter('output', i) as string;
	if (output === 'link') body.response_type = 'json';

	const response = await curlShotRequest.call(this, 'POST', '/api/v1/screenshot', {
		body,
		itemIndex: i,
	});
	if (output === 'link') {
		const json = parseJson(response.body);
		if (!json) {
			throw new NodeOperationError(this.getNode(), 'CurlShot sent an answer that is not JSON', {
				itemIndex: i,
			});
		}
		return { json: { ...json, ...metaFromHeaders(response.headers) } };
	}
	const source = this.getNodeParameter('source', i) as Source;
	return await binaryItem.call(this, response, i, {
		source,
		value: String(body[source]),
		format,
		propertyName: this.getNodeParameter('binaryPropertyName', i) as string,
	});
}

async function createJob(this: IExecuteFunctions, i: number): Promise<INodeExecutionData> {
	const format = this.getNodeParameter('jobFormat', i) as string;
	const extraName =
		format === 'pdf'
			? 'pdfOptions'
			: ['mp4', 'webm', 'gif'].includes(format)
				? 'videoOptions'
				: undefined;
	const body = renderBody.call(this, i, format, extraName);
	body.async = true;
	const webhookUrl = (this.getNodeParameter('webhookUrl', i, '') as string).trim();
	if (webhookUrl) body.webhook_url = webhookUrl;

	const accepted = await curlShotJson.call(this, 'POST', '/api/v1/screenshot', {
		body,
		itemIndex: i,
	});
	if (!this.getNodeParameter('waitForCompletion', i, false)) return { json: accepted };

	const maxWaitMs = (this.getNodeParameter('maxWait', i, 120) as number) * 1000;
	const jobId = String(accepted.job_id);
	const deadline = Date.now() + maxWaitMs;
	let job = accepted;
	while (job.status !== 'done' && job.status !== 'failed') {
		if (Date.now() >= deadline) {
			throw new NodeOperationError(
				this.getNode(),
				`Job ${jobId} was still ${String(job.status)} after ${maxWaitMs / 1000} seconds`,
				{ itemIndex: i, description: 'The job keeps running. Read it later with Job → Get.' },
			);
		}
		await sleep(POLL_INTERVAL_MS);
		job = await curlShotJson.call(this, 'GET', `/api/v1/jobs/${encodeURIComponent(jobId)}`, {
			itemIndex: i,
		});
	}
	return await jobResult.call(this, job, i);
}

async function getJob(this: IExecuteFunctions, i: number): Promise<INodeExecutionData> {
	const jobId = encodeURIComponent((this.getNodeParameter('jobId', i) as string).trim());
	const job = await curlShotJson.call(this, 'GET', `/api/v1/jobs/${jobId}`, { itemIndex: i });
	return await jobResult.call(this, job, i);
}

/** A job as JSON, plus its file as binary when it is done and the user asked for it. */
async function jobResult(
	this: IExecuteFunctions,
	job: IDataObject,
	i: number,
): Promise<INodeExecutionData> {
	const screenshot = job.screenshot as IDataObject | null | undefined;
	if (
		job.status !== 'done' ||
		!screenshot?.url ||
		!this.getNodeParameter('downloadFile', i, true)
	) {
		return { json: job };
	}
	const response = await downloadResultFile.call(this, String(screenshot.url), i);
	const format = String(screenshot.format ?? 'png');
	const binary = await this.helpers.prepareBinaryData(
		response.body,
		fileNameFor({
			source: 'html',
			value: '',
			format,
			id: String(screenshot.id ?? job.job_id ?? ''),
		}).replace(/^page/, 'curlshot'),
		mimeTypeFor(format, header(response, 'content-type')),
	);
	return {
		json: job,
		binary: { [this.getNodeParameter('binaryPropertyName', i) as string]: binary },
	};
}

async function createBulk(this: IExecuteFunctions, i: number): Promise<INodeExecutionData> {
	const mode = this.getNodeParameter('bulkMode', i) as string;
	let requests: IDataObject[];
	if (mode === 'json') {
		const parsed = parseBulkJson(this.getNodeParameter('requestsJson', i));
		if (typeof parsed === 'string')
			throw new NodeOperationError(this.getNode(), parsed, { itemIndex: i });
		requests = parsed;
	} else {
		requests = buildBulkRequestsFromUrls(
			this.getNodeParameter('urls', i) as string,
			this.getNodeParameter('bulkFormat', i) as string,
			this.getNodeParameter('options', i, {}) as IDataObject,
		);
	}
	const sizeError = checkBulkSize(requests);
	if (sizeError) throw new NodeOperationError(this.getNode(), sizeError, { itemIndex: i });

	const body: IDataObject = { requests };
	const webhookUrl = (this.getNodeParameter('webhookUrl', i, '') as string).trim();
	if (webhookUrl) body.webhook_url = webhookUrl;
	return { json: await curlShotJson.call(this, 'POST', '/api/v1/bulk', { body, itemIndex: i }) };
}
