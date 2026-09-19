/**
 * The Commander's client for the Analyst. OWNER: Member 2.
 *
 * Wraps Member 3's `runAnalyst()` with a timeout and a fallback, so the Commander
 * always ends up with a plan. Member 3 can deploy a half-finished analyst without
 * breaking the defence — the worst case is that we ship our own signature rule instead.
 */

import type { Env, IncidentBrief, MitigationPlan } from '../types';
import { runAnalyst } from '../analyst';
import { extractSignatureSamples } from './fingerprint';
import { fallbackPlan } from './fallback-plan';

/** Queue consumers have a wall-clock budget; we refuse to spend all of it on one model call. */
const ANALYST_TIMEOUT_MS = 10_000;

export interface AnalystOutcome {
	plan: MitigationPlan;
	/** Attack strings from this incident. Any proposed regex must match one of these. */
	proofSamples: string[];
	/** Set when we fell back — surfaced in the dashboard and the audit log. */
	degradedReason?: string;
	latencyMs: number;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
	return Promise.race([
		promise,
		new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`analyst timed out after ${ms}ms`)), ms)),
	]);
}

export async function requestPlan(env: Env, brief: IncidentBrief): Promise<AnalystOutcome> {
	const startedAt = Date.now();
	const proofSamples = brief.events.flatMap((event) => extractSignatureSamples(event, 2)).slice(0, 12);

	// ANALYST_MODE=fallback forces deterministic behaviour — used by tests and by the
	// live demo, where a flaky model call is worse than no model call.
	if ((env.ANALYST_MODE ?? 'auto').toLowerCase() === 'fallback') {
		return {
			plan: fallbackPlan(brief),
			proofSamples,
			degradedReason: 'ANALYST_MODE=fallback',
			latencyMs: Date.now() - startedAt,
		};
	}

	try {
		const plan = await withTimeout(runAnalyst(env, brief), ANALYST_TIMEOUT_MS);
		if (!plan || typeof plan !== 'object') throw new Error('analyst returned no plan');
		return { plan, proofSamples, latencyMs: Date.now() - startedAt };
	} catch (error) {
		const degradedReason = (error as Error).message;
		// `analyst_not_implemented` is the expected message until Member 3 lands their work.
		console.warn(`[commander] analyst unavailable (${degradedReason}); using deterministic fallback`);
		return { plan: fallbackPlan(brief), proofSamples, degradedReason, latencyMs: Date.now() - startedAt };
	}
}
