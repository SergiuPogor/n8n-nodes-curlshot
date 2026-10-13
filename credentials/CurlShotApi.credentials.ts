import type {
	IAuthenticateGeneric,
	Icon,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class CurlShotApi implements ICredentialType {
	name = 'curlShotApi';

	displayName = 'CurlShot API';

	icon: Icon = { light: 'file:../icons/curlshot.svg', dark: 'file:../icons/curlshot.dark.svg' };

	documentationUrl = 'https://github.com/SergiuPogor/n8n-nodes-curlshot#credentials';

	properties: INodeProperties[] = [
		{
			displayName: 'Access Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			required: true,
			default: '',
			description:
				'Your CurlShot access key, from Dashboard → API keys. A free key gives 100 screenshots a month.',
		},
		{
			displayName: 'Secret Key',
			name: 'secretKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			description:
				'Only needed by the CurlShot Trigger node, to check that a webhook really came from CurlShot. Shown next to the access key in Dashboard → API keys.',
		},
		{
			displayName: 'Base URL',
			name: 'baseUrl',
			type: 'string',
			default: 'https://curlshot.com',
			description: 'Leave as is unless CurlShot support gave you another address',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '=Bearer {{$credentials.apiKey}}',
			},
		},
	};

	// The usage endpoint is free: testing the key never uses a screenshot.
	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials.baseUrl.replace(/\\/+$/, "")}}',
			url: '/api/v1/usage',
			method: 'GET',
		},
	};
}
