# Immunis engineering brief

Updated September 22, 2026. Repository: [KirstenSotelo/Immunis](https://github.com/KirstenSotelo/Immunis).

Immunis is the defense system. The Red Agent and vulnerable target are demonstration tools. It provides temporary request filtering while a vulnerability remains unfixed; it does not modify application source code.

The [recorded demonstration](https://youtu.be/5-JEJ8wvWRo) uses local deterministic fallback analysis. It does not establish live Workers AI performance or production readiness. See the [README](../README.md) for setup and the [walkthrough](../DEMO_WALKTHROUGH.md) for presentation steps.

## Architecture and ownership

The team's three “Workers” are responsibilities inside **one deployed Worker**, `apps/orchestrator`. The existing deployment name, `red-vs-blue-engine`, and legacy package/resource names remain to preserve deployment identity.

| Component | Responsibility | Entry points |
|---|---|---|
| Shield (Member 1) | Enforcement, classification, evidence queueing and proxying | `src/shield.ts` |
| Commander (Member 2) | Incident state, campaigns, validation, publication and audit | `src/commander/` |
| Analyst (Member 3) | Evidence inspection, proposed plans and validation-feedback revision | `src/analyst/` |
| Dashboard | Evidence, tool steps, protections and demo controls | `apps/dashboard/src/` |
| Target | Deliberately vulnerable Express/SQLite practice app | `apps/target/index.js` |

Shared contracts are in `apps/orchestrator/src/types.ts`; keep `apps/dashboard/src/lib/types.ts` aligned when changing feed events.

```text
Request -> Shield -> allowed request -> application
             |
             +-> suspicious evidence -> Queue -> IncidentCommander (per-IP DO)
                                                    |
                                                    +-> CampaignTracker (global DO)
                                                    +-> Analyst / fallback
                                                    +-> validation -> KV -> Shield
                                                    +-> D1 audit ledger
                                                    +-> WebSocket -> dashboard
Shield -> edge_block telemetry -> CampaignTracker -> dashboard
```

## Request and incident lifecycle

1. Shield validates `DEMO_UPSTREAM`; missing/invalid configuration returns 503. It pins the origin host while copying path/query and returns redirects without following them.
2. Shield checks `block_ip_<ip>` and `waf:patterns` in KV. It enforces blocking actions and skips expired pattern rules. Matching uses the twice-decoded full URL and body.
3. Shield uses Commander's classifier. Only non-`unknown` requests enter the queue. Queue acceptance is awaited before forwarding; analysis runs in the consumer.
4. The consumer processes each IP's events sequentially, acknowledges/retries individual messages and uses message IDs for duplicate detection. Retry/poison handling and the configured DLQ need deployed verification.
5. IncidentCommander maintains per-IP evidence, scores and incidents. CampaignTracker correlates fingerprints across addresses before policy evaluation.
6. Bursts, escalation, new attack classes or distributed campaigns can trigger analysis, subject to stage and cooldown gates. Defaults include three events in 60 seconds and three campaign IPs in ten minutes.
7. Commander validates proposed patterns and publishes through CampaignTracker. D1 stores incident, mitigation and audit records; ledger writes are fail-soft.
8. The dashboard receives request evidence, analysis reports and mitigations. Shield publishes actual edge blocks asynchronously. This feed is not a complete access log.

The DO scheduler implements score decay, incident closure, expiry and cleanup. Implementation alone does not establish that every alarm, retry and recovery path has been exercised.

## Analyst and fallback

Workers AI model: `@cf/meta/llama-3.3-70b-instruct-fp8-fast`. The application-managed JSON tool protocol offers `inspect_incident`, `read_history`, `read_campaign` and `propose`. Tools read the supplied brief, not independent database/vector searches.

Inspection is mandatory before a proposal passes. The loop validates schema, a restricted regex subset, shared benign/signature samples and matching incident evidence. Rejection feedback enables revision. It allows six model turns within an 8.5-second waiting budget; Commander adds a ten-second timeout.

`runAnalystDetailed()` returns a plan and trace. Commander's adapter creates `AnalystReport`, attaches final validation and streams it with the incident. Partial `AnalystError` traces survive fallback. These are observable tool actions and outcomes, not private model reasoning.

`ANALYST_MODE=auto` attempts Workers AI. `fallback` bypasses the Blue model. Deterministic recovery tries evidence-derived patterns, then a class signature, then observe-only behavior. Automatic extra high-stage IP blocking and last-resort IP blocking were disabled for the demo; explicit `block_ip` plans remain supported.

Fallback can emit `challenge` actions, while Shield only enforces `block`. A challenge rule therefore does not establish protection. Fallback observe plans retain an action of `block`; Commander currently uses the kind to avoid deployment. These contracts need cleanup.

Agents SDK and Vectorize retrieval are **not implemented**. The Vectorize declaration is commented out. Red/Blue context adaptation does not train model weights. Prompt targets of 30% evasion or 70% defense are not measured guarantees.

## Dashboard and demonstration

Ports: dashboard **3000**, target **3001**, Worker **8787**.

Current components: `Header`, `TrafficFeed`, `PayloadAnalyzer`, `ActiveMitigations`, `RedTeamConsole`. Payload Analyzer shows captured evidence, classifier confidence, source, elapsed analysis time and tool/validation steps. There is no Vectorize similarity score.

The server route `/api/red-team` supports benign, attack, burst, botnet, auto and reset actions. Auto obtains a payload from Workers AI or a scripted ladder and sends three requests from one simulated address per round. It currently returns only the first result and drops the generator's source field; console totals do not account for all requests or prove model usage.

SQL injection on `POST /login` uses real SQLite. Alternative XSS, command-injection and traversal successes on that endpoint are simulated. `GET /search` separately reflects unescaped input; `GET /files` returns mock file contents.

Reset clears selected IP commanders and global tracker/rules/feed. It does not wipe all D1 history or every historical IP. Stop automatic traffic before resetting.

## Configuration

| Setting | Purpose |
|---|---|
| `DEMO_UPSTREAM` | Required controlled HTTP(S) target |
| `DEMO_ALLOW_SOURCE_SPOOF` | Local demo only: accept `x-demo-source-ip` |
| `ANALYST_MODE` | `auto` or `fallback`; controls Blue, not Red |
| `COMMANDER_API_KEY` | Optional operator API secret; unset means open routes |
| `NEXT_PUBLIC_ORCHESTRATOR_URL` | Dashboard browser endpoint, set before build |
| `ORCHESTRATOR_URL` | Optional server-side dashboard endpoint override |

Copy the orchestrator's `.dev.vars.example` to `.dev.vars`. Dashboard overrides can go in `.env.local`; its example documents both endpoints. Defaults need no dashboard environment file. Do not commit secrets.

Wrangler contains account-specific KV/D1 identifiers, Queue/DLQ names and DO migrations. Review these against the intended deployment account. A cloud Worker cannot reach a laptop's localhost target.

The dashboard does not currently forward the Commander API key for REST, WebSocket or demo requests. Public use needs an authenticated operator flow; do not put a shared secret in a public environment variable.

## Verification

Use Node 24. From `apps/orchestrator`:

```sh
npm ci
npm test
npm run typecheck
```

From `apps/dashboard`:

```sh
npm ci
npm run typecheck
npm run build
```

The suite has 57 tests: 33 Analyst, 16 Shield and 8 synthesis/policy checks. Model output and Cloudflare bindings are mocked. SQLite tests execute the vulnerable query shape without starting Express. See [test details](../apps/orchestrator/src/SHIELD_TESTING.md).

A passing suite is not live Cloudflare or AI validation. Record model source, latency, deployed rule, attack outcome, benign traffic and rollback together when evaluating a deployment.

## Remaining priorities

1. **Rule specificity:** classification excludes the request's host, but signature extraction scans the full URL. Local stress testing produced a generalized address/port rule that blocked benign traffic. Align detection, extraction, validation and enforcement; add full-request benign replay.
2. **Unknown traffic:** the known-class gate prevents unclassified anomalies from reaching investigation. This is not general zero-day detection.
3. **Operator access:** integrate authenticated dashboard/API access and separate demo actions before public use. The vulnerable target currently listens on all interfaces.
4. **Action semantics and provenance:** reconcile challenge/observe behavior, preserve Red source attribution and account for all auto requests.
5. **Queue recovery:** after one IP's ingest fails, the consumer breaks without explicitly retrying that group's remaining messages. Because it returns successfully, those untouched messages can be acknowledged without processing. Messages acknowledged as poison also bypass the configured DLQ. Review this against [Cloudflare's acknowledgement semantics](https://developers.cloudflare.com/queues/configuration/batching-retries/) and add failure-path tests.
6. **Live evaluation:** measure model quality, timeouts, KV visibility, alarms, expiry and rollback. The Red history is stored newest-first in the dashboard but consumed as chronological history; align that ordering before evaluating adaptation.
7. **Validation coverage:** expand representative benign requests and evaluate regex cost. Passing a small corpus and heuristics is not proof of safety.
8. **KV visibility:** omitting a custom cache TTL does not establish strongly consistent global reads. Measure propagation instead of promising instant worldwide protection; see [Cloudflare's KV consistency documentation](https://developers.cloudflare.com/kv/concepts/how-kv-works/).

These are follow-up implementation tasks, not fixes completed by this documentation refresh.
