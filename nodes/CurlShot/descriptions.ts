import type { INodeProperties } from 'n8n-workflow';

/** Resources whose operation renders a page (and so take a source and options). */
const RENDER = {
	screenshot: ['take'],
	pdf: ['generate'],
	video: ['record'],
	job: ['create'],
} as const;

const renderShow = (
	resources: Array<keyof typeof RENDER> = ['screenshot', 'pdf', 'video', 'job'],
) => ({
	show: {
		resource: [...resources],
		operation: resources.flatMap((r) => [...RENDER[r]]),
	},
});

export const resourceProperty: INodeProperties = {
	displayName: 'Resource',
	name: 'resource',
	type: 'options',
	noDataExpression: true,
	options: [
		{ name: 'Account', value: 'account' },
		{ name: 'Device', value: 'device' },
		{ name: 'Job', value: 'job' },
		{ name: 'PDF', value: 'pdf' },
		{ name: 'Screenshot', value: 'screenshot' },
		{ name: 'Video', value: 'video' },
	],
	default: 'screenshot',
};

export const operationProperties: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['screenshot'] } },
		options: [
			{
				name: 'Take',
				value: 'take',
				action: 'Take a screenshot',
				description: 'Capture a web page, HTML or Markdown as PNG, JPEG or WebP',
			},
		],
		default: 'take',
	},
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['pdf'] } },
		options: [
			{
				name: 'Generate',
				value: 'generate',
				action: 'Generate a PDF',
				description: 'Print a web page, HTML or Markdown to PDF',
			},
		],
		default: 'generate',
	},
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['video'] } },
		options: [
			{
				name: 'Record',
				value: 'record',
				action: 'Record a scrolling video',
				description: 'Record a page scrolling as MP4, WebM or GIF',
			},
		],
		default: 'record',
	},
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['job'] } },
		options: [
			{
				name: 'Create',
				value: 'create',
				action: 'Create a background render',
				description: 'Queue a render and get the result later, by polling or by webhook',
			},
			{
				name: 'Create Bulk',
				value: 'createBulk',
				action: 'Create many background renders',
				description: 'Queue up to 100 renders in one call',
			},
			{
				name: 'Get',
				value: 'get',
				action: 'Get a job',
				description: 'Get the state of a background render, and its file once done',
			},
			{
				name: 'Get Batch',
				value: 'getBatch',
				action: 'Get a batch',
				description: 'Get the state of every job of one bulk call',
			},
		],
		default: 'create',
	},
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['device'] } },
		options: [
			{
				name: 'Get Many',
				value: 'getAll',
				action: 'Get many device presets',
				description: 'List the phone, tablet and desktop presets you can render with',
			},
		],
		default: 'getAll',
	},
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['account'] } },
		options: [
			{
				name: 'Get Usage',
				value: 'getUsage',
				action: 'Get usage',
				description: 'Get the plan, quota and screenshots left this period. Free to call.',
			},
		],
		default: 'getUsage',
	},
];

export const sourceProperties: INodeProperties[] = [
	{
		displayName: 'Source',
		name: 'source',
		type: 'options',
		noDataExpression: true,
		displayOptions: renderShow(),
		options: [
			{ name: 'URL', value: 'url', description: 'A public web address' },
			{ name: 'HTML', value: 'html', description: 'HTML you provide' },
			{ name: 'Markdown', value: 'markdown', description: 'Markdown, rendered as a styled page' },
		],
		default: 'url',
	},
	{
		displayName: 'URL',
		name: 'url',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'https://example.com',
		displayOptions: { show: { ...renderShow().show, source: ['url'] } },
	},
	{
		displayName: 'HTML',
		name: 'html',
		type: 'string',
		typeOptions: { rows: 6 },
		required: true,
		default: '',
		placeholder: '<h1>Hello</h1>',
		displayOptions: { show: { ...renderShow().show, source: ['html'] } },
	},
	{
		displayName: 'Markdown',
		name: 'markdown',
		type: 'string',
		typeOptions: { rows: 6 },
		required: true,
		default: '',
		placeholder: '# Hello',
		displayOptions: { show: { ...renderShow().show, source: ['markdown'] } },
	},
];

export const formatProperties: INodeProperties[] = [
	{
		displayName: 'Format',
		name: 'imageFormat',
		type: 'options',
		displayOptions: renderShow(['screenshot']),
		options: [
			{ name: 'PNG', value: 'png' },
			{ name: 'JPEG', value: 'jpeg' },
			{ name: 'WebP', value: 'webp' },
		],
		default: 'png',
	},
	{
		displayName: 'Format',
		name: 'videoFormat',
		type: 'options',
		displayOptions: renderShow(['video']),
		options: [
			{ name: 'MP4', value: 'mp4' },
			{ name: 'WebM', value: 'webm' },
			{ name: 'GIF', value: 'gif' },
		],
		default: 'mp4',
	},
	{
		displayName: 'Format',
		name: 'jobFormat',
		type: 'options',
		displayOptions: renderShow(['job']),
		options: [
			{ name: 'GIF', value: 'gif' },
			{ name: 'JPEG', value: 'jpeg' },
			{ name: 'MP4', value: 'mp4' },
			{ name: 'PDF', value: 'pdf' },
			{ name: 'PNG', value: 'png' },
			{ name: 'WebM', value: 'webm' },
			{ name: 'WebP', value: 'webp' },
		],
		default: 'png',
	},
];

export const outputProperties: INodeProperties[] = [
	{
		displayName: 'Output',
		name: 'output',
		type: 'options',
		displayOptions: renderShow(['screenshot', 'pdf', 'video']),
		options: [
			{
				name: 'Binary File',
				value: 'binary',
				description: 'The file itself, ready for Slack, email, Google Drive or S3 nodes',
			},
			{
				name: 'Link',
				value: 'link',
				description: 'JSON with a link to the stored file, which expires after a while',
			},
		],
		default: 'binary',
	},
	{
		displayName: 'Put Output File in Field',
		name: 'binaryPropertyName',
		type: 'string',
		default: 'data',
		hint: 'The name of the output binary field to put the file in',
		displayOptions: {
			show: { ...renderShow(['screenshot', 'pdf', 'video']).show, output: ['binary'] },
		},
	},
];

function jobDownloadProperties(show: Record<string, Array<string | boolean>>): INodeProperties[] {
	return [
		{
			displayName: 'Download File',
			name: 'downloadFile',
			type: 'boolean',
			default: true,
			description: 'Whether to add the rendered file as binary data once the job is done',
			displayOptions: { show },
		},
		{
			displayName: 'Put Output File in Field',
			name: 'binaryPropertyName',
			type: 'string',
			default: 'data',
			hint: 'The name of the output binary field to put the file in',
			displayOptions: { show: { ...show, downloadFile: [true] } },
		},
	];
}

export const jobProperties: INodeProperties[] = [
	{
		displayName: 'Webhook URL',
		name: 'webhookUrl',
		type: 'string',
		default: '',
		placeholder: 'https://your-n8n.example.com/webhook/…',
		description:
			'Address that receives the finished job. Paste the production URL of a CurlShot Trigger node here.',
		displayOptions: { show: { resource: ['job'], operation: ['create', 'createBulk'] } },
	},
	{
		displayName: 'Wait for Completion',
		name: 'waitForCompletion',
		type: 'boolean',
		default: false,
		description:
			'Whether to keep checking the job until it is done or failed, instead of returning as soon as it is queued',
		displayOptions: { show: { resource: ['job'], operation: ['create'] } },
	},
	{
		displayName: 'Max Wait (Seconds)',
		name: 'maxWait',
		type: 'number',
		typeOptions: { minValue: 5, maxValue: 600 },
		default: 120,
		description:
			'Give up waiting after this long. The job keeps running and can be read later with Get.',
		displayOptions: {
			show: { resource: ['job'], operation: ['create'], waitForCompletion: [true] },
		},
	},
	{
		displayName: 'Job ID',
		name: 'jobId',
		type: 'string',
		required: true,
		default: '',
		description: 'The job_id returned when the job was created',
		displayOptions: { show: { resource: ['job'], operation: ['get'] } },
	},
	{
		displayName: 'Batch ID',
		name: 'batchId',
		type: 'string',
		required: true,
		default: '',
		description: 'The batch_id returned by Create Bulk',
		displayOptions: { show: { resource: ['job'], operation: ['getBatch'] } },
	},
	...jobDownloadProperties({ resource: ['job'], operation: ['get'] }),
	...jobDownloadProperties({ resource: ['job'], operation: ['create'], waitForCompletion: [true] }),
	{
		displayName: 'Requests Input',
		name: 'bulkMode',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['job'], operation: ['createBulk'] } },
		options: [
			{
				name: 'List of URLs',
				value: 'urls',
				description: 'One URL per line; the options below apply to every one',
			},
			{
				name: 'JSON',
				value: 'json',
				description: 'An array of request objects, each with its own options',
			},
		],
		default: 'urls',
	},
	{
		displayName: 'URLs',
		name: 'urls',
		type: 'string',
		typeOptions: { rows: 6 },
		required: true,
		default: '',
		placeholder: 'https://example.com\nhttps://example.org',
		description: 'Up to 100 URLs, one per line',
		displayOptions: { show: { resource: ['job'], operation: ['createBulk'], bulkMode: ['urls'] } },
	},
	{
		displayName: 'Format',
		name: 'bulkFormat',
		type: 'options',
		displayOptions: { show: { resource: ['job'], operation: ['createBulk'], bulkMode: ['urls'] } },
		options: [
			{ name: 'JPEG', value: 'jpeg' },
			{ name: 'PDF', value: 'pdf' },
			{ name: 'PNG', value: 'png' },
			{ name: 'WebP', value: 'webp' },
		],
		default: 'png',
	},
	{
		displayName: 'Requests (JSON)',
		name: 'requestsJson',
		type: 'json',
		required: true,
		default:
			'[\n  { "url": "https://example.com" },\n  { "url": "https://example.org", "full_page": true }\n]',
		description:
			'Array of up to 100 request objects using the API option names. See https://curlshot.com/docs.',
		displayOptions: { show: { resource: ['job'], operation: ['createBulk'], bulkMode: ['json'] } },
	},
];

/** Options every render accepts. Names match the API parameters one to one. */
export const commonOptions: INodeProperties = {
	displayName: 'Options',
	name: 'options',
	type: 'collection',
	placeholder: 'Add Option',
	default: {},
	displayOptions: {
		show: {
			resource: ['screenshot', 'pdf', 'video', 'job'],
			operation: ['take', 'generate', 'record', 'create', 'createBulk'],
		},
		hide: { bulkMode: ['json'] },
	},
	options: [
		{
			displayName: 'Block Ads',
			name: 'block_ads',
			type: 'boolean',
			default: true,
			description: 'Whether to block requests to ad networks',
		},
		{
			displayName: 'Block Chat Widgets',
			name: 'block_chats',
			type: 'boolean',
			default: true,
			description: 'Whether to block live-chat widgets',
		},
		{
			displayName: 'Block Cookie Banners',
			name: 'block_cookie_banners',
			type: 'boolean',
			default: true,
			description: 'Whether to hide cookie consent banners',
		},
		{
			displayName: 'Block Trackers',
			name: 'block_trackers',
			type: 'boolean',
			default: true,
			description: 'Whether to block analytics and tracking scripts',
		},
		{
			displayName: 'Cache',
			name: 'cache',
			type: 'boolean',
			default: true,
			description:
				'Whether to serve a stored copy when the same request was made before. Cache hits are free.',
		},
		{
			displayName: 'Cache TTL (Seconds)',
			name: 'cache_ttl',
			type: 'number',
			typeOptions: { minValue: 60, maxValue: 2592000 },
			default: 14400,
			description: 'How long a cached copy stays valid',
		},
		{
			displayName: 'Click Selector',
			name: 'click',
			type: 'string',
			default: '',
			placeholder: '#accept',
			description: 'Click the first element matching this CSS selector before the capture',
		},
		{
			displayName: 'CSS',
			name: 'styles',
			type: 'string',
			typeOptions: { rows: 4 },
			default: '',
			description: 'CSS to add to the page before the capture',
		},
		{
			displayName: 'Dark Mode',
			name: 'dark_mode',
			type: 'boolean',
			default: true,
			description: 'Whether to ask the page for its dark theme',
		},
		{
			displayName: 'Delay (Seconds)',
			name: 'delay',
			type: 'number',
			typeOptions: { minValue: 0, maxValue: 30, numberPrecision: 1 },
			default: 0,
			description: 'Extra time to wait after the page has loaded',
		},
		{
			displayName: 'Device Name or ID',
			name: 'viewport_device',
			type: 'options',
			typeOptions: { loadOptionsMethod: 'getDevices' },
			default: '',
			description:
				'Emulate a phone, tablet or laptop preset. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
		},
		{
			displayName: 'Device Scale Factor',
			name: 'device_scale_factor',
			type: 'number',
			typeOptions: { minValue: 1, maxValue: 3, numberPrecision: 2 },
			default: 1,
			description: 'Pixel density; 2 gives a retina image',
		},
		{
			displayName: 'Full Page',
			name: 'full_page',
			type: 'boolean',
			default: true,
			description: 'Whether to capture the whole page, not just the first screen',
		},
		{
			displayName: 'Hide Selectors',
			name: 'hide_selectors',
			type: 'string',
			default: '',
			placeholder: '.cookie-bar, #chat',
			description: 'Hide every element matching these CSS selectors (comma-separated)',
		},
		{
			displayName: 'Image Quality',
			name: 'image_quality',
			type: 'number',
			typeOptions: { minValue: 1, maxValue: 100 },
			default: 80,
			description: 'Compression quality for JPEG and WebP, from 1 to 100',
		},
		{
			displayName: 'Image Width',
			name: 'image_width',
			type: 'number',
			typeOptions: { minValue: 1, maxValue: 8000 },
			default: 640,
			description: 'Resize the final image to this width, in pixels',
		},
		{
			displayName: 'JavaScript',
			name: 'scripts',
			type: 'string',
			typeOptions: { rows: 4 },
			default: '',
			description: 'JavaScript to run on the page before the capture',
		},
		{
			displayName: 'Reduced Motion',
			name: 'reduced_motion',
			type: 'boolean',
			default: true,
			description: 'Whether to ask the page to turn animations off',
		},
		{
			displayName: 'Selector',
			name: 'selector',
			type: 'string',
			default: '',
			placeholder: '#pricing',
			description: 'Capture only the first element matching this CSS selector',
		},
		{
			displayName: 'Time Zone',
			name: 'time_zone',
			type: 'string',
			default: '',
			placeholder: 'Europe/Berlin',
			description: 'IANA time zone the page sees',
		},
		{
			displayName: 'Timeout (Seconds)',
			name: 'timeout',
			type: 'number',
			typeOptions: { minValue: 1, maxValue: 90 },
			default: 30,
			description: 'Give up if the page is not ready after this long',
		},
		{
			displayName: 'Transparent Background',
			name: 'omit_background',
			type: 'boolean',
			default: true,
			description: 'Whether to keep the page background transparent (PNG and WebP)',
		},
		{
			displayName: 'Viewport Height',
			name: 'viewport_height',
			type: 'number',
			typeOptions: { minValue: 100, maxValue: 4320 },
			default: 1024,
			description: 'Height of the browser window, in pixels',
		},
		{
			displayName: 'Viewport Width',
			name: 'viewport_width',
			type: 'number',
			typeOptions: { minValue: 100, maxValue: 3840 },
			default: 1280,
			description: 'Width of the browser window, in pixels',
		},
		{
			displayName: 'Wait for Selector',
			name: 'wait_for_selector',
			type: 'string',
			default: '',
			placeholder: '.chart-ready',
			description: 'Wait until this element is visible before capturing',
		},
		{
			displayName: 'Wait Until',
			name: 'wait_until',
			type: 'options',
			options: [
				{ name: 'Commit', value: 'commit' },
				{ name: 'DOM Content Loaded', value: 'domcontentloaded' },
				{ name: 'Load', value: 'load' },
				{ name: 'Network Idle', value: 'networkidle' },
			],
			default: 'load',
			description: 'Page event that marks the page as loaded',
		},
	],
};

const pdfOptionsFor = (show: Record<string, string[]>): INodeProperties => ({
	displayName: 'PDF Options',
	name: 'pdfOptions',
	type: 'collection',
	placeholder: 'Add Option',
	default: {},
	displayOptions: { show },
	options: [
		{
			displayName: 'Fit on One Page',
			name: 'pdf_fit_one_page',
			type: 'boolean',
			default: true,
			description: 'Whether to put the whole page on a single tall PDF page',
		},
		{
			displayName: 'Landscape',
			name: 'pdf_landscape',
			type: 'boolean',
			default: true,
			description: 'Whether to use landscape pages',
		},
		{
			displayName: 'Margin',
			name: 'pdf_margin',
			type: 'string',
			default: '',
			placeholder: '10mm',
			description: 'Margin on all four sides, with a CSS unit',
		},
		{
			displayName: 'Media Type',
			name: 'media_type',
			type: 'options',
			options: [
				{ name: 'Screen', value: 'screen' },
				{ name: 'Print', value: 'print' },
			],
			default: 'screen',
			description: 'CSS media type to render with',
		},
		{
			displayName: 'Paper Format',
			name: 'pdf_paper_format',
			type: 'options',
			options: [
				{ name: 'A0', value: 'a0' },
				{ name: 'A1', value: 'a1' },
				{ name: 'A2', value: 'a2' },
				{ name: 'A3', value: 'a3' },
				{ name: 'A4', value: 'a4' },
				{ name: 'A5', value: 'a5' },
				{ name: 'A6', value: 'a6' },
				{ name: 'Ledger', value: 'ledger' },
				{ name: 'Legal', value: 'legal' },
				{ name: 'Letter', value: 'letter' },
				{ name: 'Tabloid', value: 'tabloid' },
			],
			default: 'a4',
		},
		{
			displayName: 'Print Background',
			name: 'pdf_print_background',
			type: 'boolean',
			default: true,
			description: 'Whether to print background colors and images',
		},
	],
});

export const pdfOptions: INodeProperties[] = [
	pdfOptionsFor({ resource: ['pdf'], operation: ['generate'] }),
	pdfOptionsFor({ resource: ['job'], operation: ['create'], jobFormat: ['pdf'] }),
];

const videoOptionsFor = (show: Record<string, string[]>): INodeProperties => ({
	displayName: 'Video Options',
	name: 'videoOptions',
	type: 'collection',
	placeholder: 'Add Option',
	default: {},
	displayOptions: { show },
	options: [
		{
			displayName: 'Duration (Seconds)',
			name: 'video_duration',
			type: 'number',
			typeOptions: { minValue: 1, maxValue: 30, numberPrecision: 1 },
			default: 8,
			description: 'Length of the video. Left out, it follows the height of the page.',
		},
		{
			displayName: 'Frames per Second',
			name: 'video_fps',
			type: 'number',
			typeOptions: { minValue: 5, maxValue: 30 },
			default: 24,
			description: 'Frames per second. A GIF takes at most 15.',
		},
		{
			displayName: 'Max Duration (Seconds)',
			name: 'video_max_duration',
			type: 'number',
			typeOptions: { minValue: 1, maxValue: 30, numberPrecision: 1 },
			default: 30,
			description: 'Longest the video may get when its length follows the page',
		},
		{
			displayName: 'Scroll',
			name: 'video_scroll',
			type: 'boolean',
			default: true,
			description: 'Whether to scroll from the top of the page to the bottom while recording',
		},
		{
			displayName: 'Scroll Back',
			name: 'video_scroll_back',
			type: 'boolean',
			default: true,
			description: 'Whether to scroll back to the top at the end, so the video loops cleanly',
		},
	],
});

export const videoOptions: INodeProperties[] = [
	videoOptionsFor({ resource: ['video'], operation: ['record'] }),
	videoOptionsFor({ resource: ['job'], operation: ['create'], jobFormat: ['mp4', 'webm', 'gif'] }),
];
