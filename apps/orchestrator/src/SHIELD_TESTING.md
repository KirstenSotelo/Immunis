# Orchestrator regression checks

From `apps/orchestrator`, using Node 24:

```sh
npm test
npm run typecheck
```

The test script runs all three suites:

```sh
node --import ./src/analyst/test-loader.mjs --test ./src/analyst/analyst.test.mjs ./src/shield.test.mjs ./src/commander/synthesizer.test.mjs
```

Expected: 57 passing tests (33 Analyst, 16 Shield, 8 synthesis/policy). Tests need no network or Cloudflare credentials. Typechecking needs dependencies installed with `npm ci`.

## Coverage

- Scripted-model tools, rejection/revision, evidence checks and failure traces.
- Origin host pinning, required upstream configuration, forwarding and redirects.
- Vulnerable SQLite query behavior using Node's in-memory database.
- Classification, decoding, expiry and blocking-rule precedence.
- Exclusion of the request's own host from classification.
- Synthesis, sibling mutations, selected benign samples and campaign policy.
- Observe-only fallback when no safe pattern exists, matching demo policy.

Bindings, upstream fetch and AI responses are mocked. Tests do not start Express or validate the full Cloudflare runtime.

## Configuration and remaining checks

Set `DEMO_UPSTREAM` to a controlled HTTP(S) target, e.g. `http://localhost:3001`. Missing/invalid configuration returns 503. A deployed Worker needs a reachable target, not laptop localhost. See [setup](../../../README.md).

The hostname regression covers classification, not signature extraction or complete synthesis. The broad-rule false positive remains open. Live model latency, action semantics, authenticated dashboard access, KV visibility, queue recovery, alarms and rollback need integration verification.
