import type { Env } from '../types';

export const RED_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';

export interface AttackHistory {
	payload: string;
	result: string;
}

const RED_SYSTEM_PROMPT = `You are an advanced autonomous red team agent. Your goal is to bypass a Web Application Firewall (WAF) using SQL Injection to log in as the 'admin' user.
The application processes a login POST request where the body contains URL encoded 'username' and 'password' fields. 
The backend query is vulnerable: SELECT * FROM users WHERE username = '<your_payload>' AND password = 'wrong'

You must mutate your payload based on the results of your previous attempts. 
- If a payload was 'blocked', the firewall detected your signature, so you must obfuscate it (e.g., using comments, hex encoding, alternative whitespace, different case, or string concatenation).
- If a payload was 'breached', you successfully bypassed the firewall! However, to prove the firewall cannot adapt, you should try the exact same payload again. If the firewall is learning, it will block your second attempt, and then you must mutate.

You MUST output exactly one JSON object with no markdown formatting, backticks, or other text.
Format:
{
  "thought": "A brief, sinister 1-sentence explanation of why you are trying this specific mutation.",
  "payload": "The exact SQL injection payload string to inject into the username field (e.g., admin' OR 1=1 -- )"
}`;

export async function generateAttackPayload(env: Env, history: AttackHistory[]): Promise<{ thought: string; payload: string }> {
	if (!env.AI) throw new Error('AI binding unavailable');

	const messages = [{ role: 'system', content: RED_SYSTEM_PROMPT }];

	if (history.length > 0) {
		messages.push({
			role: 'user',
			content: `Here is the history of your previous attempts:\n${history
				.map((h, i) => `Attempt ${i + 1}:\nPayload: ${h.payload}\nResult: ${h.result}`)
				.join('\n\n')}\n\nGenerate your next payload.`,
		});
	} else {
		messages.push({
			role: 'user',
			content: 'This is your first attempt. Generate your initial payload.',
		});
	}

	const response = await env.AI.run(RED_MODEL, {
		messages,
		max_tokens: 300,
		temperature: 0.7,
		stream: false,
	});

	let raw: any = response;
	console.log('[red-agent] Raw AI response:', raw);
	
	if (raw && typeof raw === 'object' && 'response' in raw) {
		raw = raw.response;
	}
	
	if (typeof raw === 'string') {
		try {
			const clean = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
			return JSON.parse(clean);
		} catch (e) {
			console.error('[red-agent] JSON parse error', e, raw);
			return {
				thought: "I must try a different encoding to evade detection.",
				payload: "admin'/**/OR/**/1=1#"
			};
		}
	} else if (typeof raw === 'object' && raw !== null && 'thought' in raw && 'payload' in raw) {
		return raw as { thought: string; payload: string };
	}
	
	console.error('[red-agent] Invalid format. Type:', typeof raw, 'Value:', raw);
	throw new Error(`Invalid Red Agent response format. Got: ${JSON.stringify(raw)}`);
}
