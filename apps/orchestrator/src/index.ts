import type { Env } from './types';
import { handleCommanderRequest } from './commander/api';
import { handleAnalysisBatch } from './commander/queue-consumer';

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

		// 1. Check if IP is already blocked in KV
		const isBlocked = await env.RULES_KV.get(`block_ip_${ip}`);
		if (isBlocked) {
			return new Response('403 Forbidden: Exploit neutralized by Edge Agent.', { status: 403 });
		}

		// 2. Simple heuristic for "suspicious" (can be expanded)
		const isSuspicious = payload.includes('SELECT') || url.search.includes('<script>');

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

		// 3. Normal response
		return new Response('200 OK: System functioning normally.', { status: 200 });
	},

	// ==========================================
	// MEMBER 2: THE COMMANDER (Queue Consumer)
	// ==========================================
	async queue(batch: MessageBatch<unknown>, env: Env): Promise<void> {
		await handleAnalysisBatch(batch, env);
	},
};
