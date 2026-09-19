# "Red vs. Blue" — Autonomous Zero-Day Patching Engine

This document breaks down the project into 3 manageable pieces for your team and provides the boilerplate code to get the Cloudflare Workers architecture running.

## 👥 Task Division (3-Person Team)

### 🛡️ Member 1: The Shield (Edge Interception & Enforcement)
**Tech Stack:** Cloudflare Workers, KV, Queues (Producer)
**Your Job:** Be the front line. You will intercept all incoming requests, check if they are blocked by our generated rules in KV, and forward suspicious traffic to the queue.
*   **Tasks:**
    *   Write the main `fetch` handler.
    *   Read from `RULES_KV` (e.g., checking if the IP or payload matches a regex rule).
    *   If blocked, return `403 Forbidden`.
    *   If suspicious, push the request data (IP, headers, body) to `ANALYSIS_QUEUE`.
    *   Return `200 OK` for normal traffic.

### 🧠 Member 2: The Commander (Stateful Tracking & Orchestration)
**Tech Stack:** Queues (Consumer), Durable Objects
**Your Job:** Act as the "Security Incident Commander." You will reconstruct the attack chain and keep track of state per IP address.
*   **Tasks:**
    *   Write the `queue` handler to consume messages from `ANALYSIS_QUEUE`.
    *   Implement the `IncidentCommander` Durable Object.
    *   Store and aggregate payloads by IP. If an IP sends 3 suspicious requests in 1 minute, trigger the AI analysis pipeline.

### 🕵️ Member 3: The Analyst (AI Diagnosis & Rule Generation)
**Tech Stack:** Agents SDK / Workers AI, Vectorize, KV (Writer)
**Your Job:** The brains of the operation. You will analyze the attack, classify it, generate a mitigation rule, and deploy it globally.
*   **Tasks:**
    *   Receive the triggered attack chain from the Durable Object.
    *   Query `Vectorize` to compare the payload against known signatures (optional/stretch goal).
    *   Prompt the AI (via Agents SDK/Workers AI) with the attack payloads and ask it to generate a WAF rule (e.g., a regex).
    *   Write the generated rule back into `RULES_KV` (which instantly updates Member 1's defenses).

---

## 🛠️ Boilerplate Code

### 1. `wrangler.toml`
This defines the infrastructure you'll need.

```toml
name = "red-vs-blue-engine"
main = "src/index.ts"
compatibility_date = "2024-03-20"

# Member 1: KV for Rules
[[kv_namespaces]]
binding = "RULES_KV"
id = "<YOUR_KV_NAMESPACE_ID>"

# Member 1 & 2: Queues for passing suspicious traffic
[[queues.producers]]
binding = "ANALYSIS_QUEUE"
queue = "suspicious-traffic-queue"

[[queues.consumers]]
queue = "suspicious-traffic-queue"
max_batch_size = 10
max_batch_timeout = 2

# Member 2: Durable Objects for state tracking
[[durable_objects.bindings]]
name = "INCIDENT_COMMANDER"
class_name = "IncidentCommander"

[[migrations]]
tag = "v1"
new_classes = ["IncidentCommander"]

# Member 3: Vectorize and AI
[[vectorize]]
binding = "ATTACK_VECTORS"
index_name = "attacks-index"

[ai]
binding = "AI"
```

### 2. `src/index.ts`
The main boilerplate containing the entry point and the Durable Object.

```typescript
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
```
