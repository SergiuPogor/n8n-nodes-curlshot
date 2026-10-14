import type { IDataObject, INodeProperties } from 'n8n-workflow';
import { describe, expect, it } from 'vitest';

import dailyScreenshot from '../examples/daily-full-page-screenshot.json';
import { CurlShot } from '../nodes/CurlShot/CurlShot.node';

// Every workflow in examples/ belongs in this list, so the test checks it.
const EXAMPLES: Record<string, unknown> = {
	'daily-full-page-screenshot.json': dailyScreenshot,
};
const properties = new CurlShot().description.properties;

/**
 * Names a parameter may take: top-level fields, plus the keys allowed inside
 * collections (option names) and fixed collections (group names).
 */
function knownNames(list: INodeProperties[]): Map<string, Set<string>> {
	const names = new Map<string, Set<string>>();
	for (const property of list) {
		const children = names.get(property.name) ?? new Set<string>();
		for (const option of (property.options ?? []) as Array<{ name: string; value?: unknown }>) {
			if (property.type === 'collection' || property.type === 'fixedCollection')
				children.add(option.name);
		}
		names.set(property.name, children);
	}
	return names;
}

describe('examples', () => {
	it.each(Object.keys(EXAMPLES))('%s only uses parameters the CurlShot node defines', (file) => {
		const workflow = EXAMPLES[file] as {
			nodes: Array<{ type: string; parameters: IDataObject }>;
			connections: IDataObject;
		};
		const names = knownNames(properties);
		const curlShotNodes = workflow.nodes.filter((n) => n.type === 'n8n-nodes-curlshot.curlShot');
		expect(curlShotNodes.length).toBeGreaterThan(0);
		for (const node of curlShotNodes) {
			for (const [key, value] of Object.entries(node.parameters)) {
				expect(names.has(key), `unknown parameter ${key}`).toBe(true);
				if (value && typeof value === 'object' && !Array.isArray(value)) {
					for (const child of Object.keys(value)) {
						expect(names.get(key)?.has(child), `unknown option ${key}.${child}`).toBe(true);
					}
				}
			}
		}
	});
});
