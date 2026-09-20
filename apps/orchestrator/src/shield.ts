import type { Env } from './types';
import { classify } from './commander/fingerprint';
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

export async function handleShieldRequest(request: Request, env: Env, fetchOrigin: typeof fetch = fetch): Promise<Response> {
    const ip = request.headers.get('cf-connecting-ip') || 'unknown';
    const url = new URL(request.url);
    let proxyUrl: URL;
    try {
        if (!env.DEMO_UPSTREAM) throw new Error('missing upstream');
        proxyUrl = new URL(env.DEMO_UPSTREAM);
        if (!['http:', 'https:'].includes(proxyUrl.protocol) || proxyUrl.username || proxyUrl.password) throw new Error('invalid upstream');
        // Assign fields instead of resolving an attacker-controlled relative URL.
        proxyUrl.pathname = url.pathname;
        proxyUrl.search = url.search;
        proxyUrl.hash = '';
    } catch {
        return new Response('DEMO_UPSTREAM must be configured as an HTTP(S) target.', { status: 503 });
    }
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
    const rules = await readPatternRules(env, 0); // KV Cache disabled for instant demo feedback
    const matchInput = decodedUrl + '\n' + decodedPayload;
    const hit = matchPatternRules(rules.filter(rule => rule.action === 'block'), matchInput);

    if (hit && hit.action === 'block') {
        return new Response('403 Forbidden: Pattern exploit neutralized by Edge Agent.', { status: 403 });
    }

    // 3. Use the same attack classification as Commander.
    const event = {
        ip, url: request.url, method: request.method, payload,
        timestamp: Date.now(), userAgent: request.headers.get('user-agent') ?? '',
    };
    const isSuspicious = classify(event).attackClass !== 'unknown';

    if (isSuspicious) {
        // Await queue acceptance; analysis itself runs in the queue consumer.
        await env.ANALYSIS_QUEUE.send(event);
    }

    // 4. Proxy normal response to Demo Application
    const proxyRequest = new Request(proxyUrl, request);
    proxyRequest.headers.set('Host', proxyUrl.host);

    // Preserve redirects as responses rather than forwarding credentials to a new origin.
    return fetchOrigin(new Request(proxyRequest, { redirect: 'manual' }));
}
