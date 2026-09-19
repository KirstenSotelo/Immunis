export interface Env {
	RULES_KV: KVNamespace;
	ANALYSIS_QUEUE: Queue<any>;
	INCIDENT_COMMANDER: DurableObjectNamespace;
	ATTACK_VECTORS: VectorizeIndex;
	AI: any;
}

// ==========================================
// MEMBER 1: THE SHIELD (Edge Interception)
// ==========================================
export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
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
				timestamp: Date.now()
			});
		}

		// 3. Normal response
		return new Response('200 OK: System functioning normally.', { status: 200 });
	},

	// ==========================================
	// MEMBER 2: THE COMMANDER (Queue Consumer)
	// ==========================================
	async queue(batch: MessageBatch<any>, env: Env): Promise<void> {
		for (const message of batch.messages) {
			const data = message.body;
			
			// Route to the Durable Object specific to this IP
			const id = env.INCIDENT_COMMANDER.idFromName(data.ip);
			const stub = env.INCIDENT_COMMANDER.get(id);
			
			// Send the data to the DO for stateful tracking
			await stub.fetch(new Request('http://internal/analyze', {
				method: 'POST',
				body: JSON.stringify(data)
			}));
		}
	}
};

// ==========================================
// MEMBER 2 & 3: THE COMMANDER & THE ANALYST
// ==========================================
export class IncidentCommander {
	state: DurableObjectState;
	env: Env;

	constructor(state: DurableObjectState, env: Env) {
		this.state = state;
		this.env = env;
	}

	async fetch(request: Request) {
		const data = await request.json();
		const ip = data.ip;

		// Store the attack payload in DO state
		let attackChain: any[] = await this.state.storage.get('attack_chain') || [];
		attackChain.push(data);
		await this.state.storage.put('attack_chain', attackChain);

		// If we've seen enough suspicious requests, trigger the Analyst (Member 3)
		if (attackChain.length >= 3) {
			await this.triggerAgentAnalysis(ip, attackChain);
			// Reset chain after analysis
			await this.state.storage.delete('attack_chain');
		}

		return new Response('Logged');
	}

	// MEMBER 3: THE ANALYST (AI Diagnosis & Rule Generation)
	async triggerAgentAnalysis(ip: string, attackChain: any[]) {
		console.log(`Triggering AI Agent for IP: ${ip}`);
		
		// 1. (Optional) Check Vectorize for similar attacks
		// const vectorResult = await this.env.ATTACK_VECTORS.query(...)

		// 2. Call Workers AI or Agents SDK to diagnose
		const prompt = `You are an autonomous edge security agent. 
		Analyze this attack chain: ${JSON.stringify(attackChain)}. 
		Provide a diagnosis. We are blocking the IP.`;

		// Example using standard Workers AI text generation:
		// const response = await this.env.AI.run('@cf/meta/llama-2-7b-chat-int8', { prompt });

		// 3. Write the mitigation to KV (Block the IP instantly at the edge)
		await this.env.RULES_KV.put(`block_ip_${ip}`, "true", { expirationTtl: 3600 });
		
		console.log(`Deployed zero-day patch to edge for IP: ${ip}`);
	}
}
