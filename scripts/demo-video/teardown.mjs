// Removes the demo n8n and its volume. The volume holds the CurlShot
// credential typed on camera, so run this as soon as the take is done.
import { execFileSync } from 'node:child_process';
import { config } from './config.mjs';

const { container, volume } = config;

for (const args of [
	['rm', '-f', container],
	['volume', 'rm', '-f', volume],
]) {
	execFileSync('docker', args, { stdio: ['ignore', 'ignore', 'inherit'] });
}
console.log(`Removed container ${container} and volume ${volume}.`);
