import type { Env } from './types';
import { handleCommanderRequest } from './commander/api';
import { handleAnalysisBatch } from './commander/queue-consumer';
import { readPatternRules, matchPatternRules, type EdgeBlock } from './commander/mitigation';

// Mirror the two-pass normalization used by the Analyst.
function decodeEvidence(input: string): string {
	let value = input;
	for (let pass = 0; pass < 2; pass++) {
		try {
			const next = decodeURIComponent(value.replace(/\+/g, ' '));
			if (next === value) break;
			value = next;
		} catch {
			break;
		}
	}
	return value;
}

export type { Env } from './types';

// Durable Object classes must be exported from the worker entrypoint.
// MEMBER 2 owns both of these.
export { IncidentCommander } from './commander/incident-commander';
export { CampaignTracker } from './commander/campaign-tracker';

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		// ==========================================
		// MEMBER 2: operator + dashboard API.
		// Returns null for any other path, so Member 1's handler below is unaffected.
		// ==========================================
		const commanderResponse = await handleCommanderRequest(request, env);
		if (commanderResponse) return commanderResponse;

		// ==========================================
		// MEMBER 1: THE SHIELD (Edge Interception)
		// ==========================================
		const ip = request.headers.get('cf-connecting-ip') || 'unknown';
		const url = new URL(request.url);
		const payload = await request.clone().text();

		// Safely decode evidence
		const decodedUrl = decodeEvidence(request.url);
		const decodedPayload = decodeEvidence(payload);

		// 1. Check if IP is already blocked in KV
		const ipBlockRaw = await env.RULES_KV.get(`block_ip_${ip}`);
		if (ipBlockRaw) {
			try {
				const block = JSON.parse(ipBlockRaw) as EdgeBlock;
				if (block.action === 'block') {
					return new Response('403 Forbidden: Exploit neutralized by Edge Agent.', { status: 403 });
				}
			} catch {
				// Fallback if parsing fails
				return new Response('403 Forbidden: Exploit neutralized by Edge Agent.', { status: 403 });
			}
		}

		// 2. Test against Pattern Rules
		const rules = await readPatternRules(env, 60); // 60s cache TTL on the edge
		const matchInput = decodedUrl + '\n' + decodedPayload;
		const hit = matchPatternRules(rules, matchInput);

		if (hit && hit.action === 'block') {
			return new Response('403 Forbidden: Pattern exploit neutralized by Edge Agent.', { status: 403 });
		}

		// 3. Simple heuristic for "suspicious" (can be expanded)
		const suspicionRegex = /(?:SELECT|UNION|DROP|<script>|\$\{jndi:|\$gt|\.\.\/)/i;
		const isSuspicious = suspicionRegex.test(decodedPayload) || suspicionRegex.test(decodedUrl);

		if (isSuspicious) {
			// Send to background analysis without blocking the main thread
			await env.ANALYSIS_QUEUE.send({
				ip,
				url: request.url,
				method: request.method,
				payload,
				timestamp: Date.now(),
			});
		}

		// 4. Proxy normal response to Demo Application
		const demoUpstream = env.DEMO_UPSTREAM || 'https://httpbin.org';
		const proxyUrl = new URL(url.pathname + url.search, demoUpstream);
		const proxyRequest = new Request(proxyUrl, request);
		proxyRequest.headers.set('Host', proxyUrl.host);

		return fetch(proxyRequest);
	},

	// ==========================================
	// MEMBER 2: THE COMMANDER (Queue Consumer)
	// ==========================================
	async queue(batch: MessageBatch<unknown>, env: Env): Promise<void> {
		await handleAnalysisBatch(batch, env);
	},
};
