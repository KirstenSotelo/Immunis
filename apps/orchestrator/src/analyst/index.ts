import type { Env, IncidentBrief, MitigationPlan } from '../types';
import { investigate } from './loop';

export const MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';

/** Returns a plan only. Commander retains all deployment and fallback authority. */
export async function runAnalyst(env: Env, brief: IncidentBrief): Promise<MitigationPlan> {
  if (!env.AI) throw new Error('analyst_ai_unavailable');
  const result = await investigate(brief, {
    source: 'workers-ai:' + MODEL,
    complete: messages => env.AI!.run(MODEL, { messages, max_tokens: 900, temperature: 0, stream: false }),
  });
  return result.plan;
}
