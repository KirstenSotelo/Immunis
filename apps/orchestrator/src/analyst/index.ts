/**
 * ==========================================================================
 * MEMBER 3: THE ANALYST — this file is yours. It is a placeholder.
 * ==========================================================================
 *
 * Member 2's IncidentCommander calls `runAnalyst()` whenever it opens an incident.
 * Replace the body below with your real implementation:
 *   - query ATTACK_VECTORS (Vectorize) for similar known signatures
 *   - prompt env.AI / the Agents SDK with the attack chain
 *   - return a MitigationPlan
 *
 * THE CONTRACT (please keep these three properties):
 *   1. Return a `MitigationPlan`, or throw. Both are handled.
 *   2. Do NOT write to RULES_KV here. The Commander validates every plan against a
 *      benign-traffic corpus before deploying, and owns rollback. A rule written
 *      directly to KV bypasses that check.
 *   3. Stay under ~10s. You are called inside a queue consumer.
 *
 * Until you land your version, the Commander falls back to its own deterministic
 * signature rules (see commander/fallback-plan.ts), so the pipeline runs end to end.
 */

import type { Env, IncidentBrief, MitigationPlan } from '../types';

export async function runAnalyst(_env: Env, _brief: IncidentBrief): Promise<MitigationPlan> {
	throw new Error('analyst_not_implemented');
}
