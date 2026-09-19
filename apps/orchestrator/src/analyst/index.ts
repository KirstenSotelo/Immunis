import type { Env, IncidentBrief, MitigationPlan } from '../types';
import { investigate } from './loop';

export const MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';

/** Returns a plan only. Commander retains all deployment and fallback authority. */
export async function runAnalyst(env: Env, brief: IncidentBrief): Promise<MitigationPlan> {
  if (!env.AI) throw new Error('analyst_ai_unavailable');
  const result = await investigate(brief, {
    source: 'workers-ai:' + MODEL,
    complete: messages => env.AI!.run(MODEL, { messages, max_tokens: 900, temperature: 0, stream: false }),
  }, {
    searchCVE: async (query: string) => {
      const q = query.toLowerCase();
      const matches: string[] = [];
      if (q.includes('select') || q.includes('union')) matches.push('CVE-2015-SQLi: SQL Injection Template');
      if (q.includes('jndi')) matches.push('CVE-2021-44228: Log4Shell JNDI Lookup');
      if (q.includes('passwd') || q.includes('../')) matches.push('CVE-2007-0450: Directory Traversal');
      if (q.includes('<script>')) matches.push('CVE-2019-11358: jQuery XSS vulnerability equivalent');
      return { matches: matches.length ? matches : ['No known CVEs matched.'] };
    }
  });
  return result.plan;
}
