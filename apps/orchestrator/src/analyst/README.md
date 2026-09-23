# Worker 3 Analyst

The Analyst loop, Workers AI adapter and scripted-model tests live here. Commander
integration is in `../commander/analyst-client.ts`; shared reports reach the dashboard.
See the [current handoff](../../../../Worker-3-Handoff.md) for ownership and status.

## Local tests

From apps/orchestrator, with Node 24. Run:

```sh
node --import ./src/analyst/test-loader.mjs --test ./src/analyst/analyst.test.mjs
```

The loader resolves existing extensionless TypeScript imports for Node's built-in
type stripping. It is test-only; do not import it from the Worker. Tests use the
real Commander validator and signature extraction with a scripted mock model.
They do not call Cloudflare, deploy rules, or prove model quality.

The Analyst suite contains 33 tests. Additional regression coverage includes
two-pass decoding parity, malformed fields, overlapping regex repetitions,
duplicate tool reads, oversized object responses, invalid loop options, empty
incidents, and diagnostic trace retention on provider failure.
The fabricated CVE lookup was removed; a regression test confirms search_cve is
not advertised or dispatched. Run `npm test` from apps/orchestrator for all 57
Analyst, Shield and synthesis/policy tests. See [test details](../SHIELD_TESTING.md).

## Contract

runAnalyst(env, brief) keeps the existing IncidentBrief -> MitigationPlan interface.
It uses env.AI when invoked by the Commander. Missing AI, provider failures,
deadline exhaustion, or exhausted attempts throw for the existing Commander
fallback. No synthetic fallback is presented as model output.

The model selects one structured JSON tool action per turn: inspect_incident,
read_history, read_campaign, or propose. This is an application-managed tool
protocol over text generation, not native function calling or the Agents SDK.
History and campaign tools read only the supplied brief, not live storage.
Proposals are schema checked, checked against a conservative regex subset, and
passed to the existing Commander validator. Rejection feedback goes back to the
model. A passing proposal returns immediately; deployment remains with Commander.

investigate() accepts an injected model client and returns a plan and trace.
runAnalyst() preserves the plan-only API. Commander uses runAnalystDetailed(),
adapts its trace to AnalystReport and sends it with incident feed events.
Failed calls, deadlines and exhausted attempts carry partial traces in AnalystError;
Commander preserves these before adding fallback steps. Traces describe tool calls
and validation outcomes, not private model reasoning.

Maximum six model turns, with an 8.5-second overall waiting budget, below the
Commander's existing 10-second timeout. Timers are cleared. A timed-out remote
inference may continue at the provider: env.AI's current structural interface has
no cancellation API. No further tools or deployment are executed after timeout.

The adapter uses @cf/meta/llama-3.3-70b-instruct-fp8-fast. Its messages/response
shape follows https://developers.cloudflare.com/workers-ai/models/llama-3.3-70b-instruct-fp8-fast/.
Live model access and latency have not been tested.

## Integration limitations

- The regex subset intentionally rejects groups, alternation, character classes,
  wildcards and backreferences before executing the shared validator. Passing
  checks is not a general proof of regex safety or absence of false positives.
  Quantified tokens are restricted further to whitespace between literal letters
  or digits, avoiding overlapping word/digit runs and leading repetition.
- URL and body are decoded separately with the Commander's two-pass behavior.
  Read tools return their full result only once per investigation to limit context
  duplication. Object-form model responses have the same size limit as text.
- Only block actions and observe/log plans are emitted. Challenge and rate_limit
  need coordinated enforcement semantics before support can be added.
- The shared validator tests detector-extracted signature snippets. Endpoint-scoped
  rules may fail this contract even when they match the full request. Coordinate
  changes to validation and enforcement input with Members 1 and 2.
- The Analyst also requires a pattern to match actual incident evidence. For
  unknown attacks with no signature samples, it validates against full evidence.
  This does not fix the upstream gate that may prevent unknown incidents arriving.
- Automatic extra high-stage and last-resort IP blocking are disabled for the demo.
  Explicit block_ip proposals remain supported. KV visibility and authenticated
  dashboard/API integration remain shared follow-up work.
- Prompt instructions mark traffic as untrusted evidence. The tool allowlist and
  schema checks restrict authority, but do not prove prompt-injection resistance.
- Live multi-turn latency may exceed the current budget. Agree a background
  orchestration design or budget change before promising a live demo time.

Next integration check: feed a real IncidentBrief to a live model, confirm its
source is workers-ai without degraded fallback, then verify Worker 1 actually
enforces the approved pattern while a benign same-IP request still passes.
