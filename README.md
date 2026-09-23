<div align="center">

# Immunis

**An autonomous defense agent that investigates suspicious traffic and deploys temporary protections while developers fix the underlying vulnerability.**

[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-F38020?logo=cloudflare&logoColor=white)](https://developers.cloudflare.com/workers/)
[![Workers AI](https://img.shields.io/badge/Workers-AI-F38020?logo=cloudflare&logoColor=white)](https://developers.cloudflare.com/workers-ai/)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-15-000000?logo=nextdotjs)](https://nextjs.org/)

[Watch Demo](https://youtu.be/5-JEJ8wvWRo) · [Quick Start](#-quick-start) · [Report Bug](https://github.com/KirstenSotelo/Immunis/issues)

<a href="https://youtu.be/5-JEJ8wvWRo">
  <img src="docs/assets/demo-preview.gif" alt="Immunis dashboard: an active protection blocks a repeated SQL-injection attack" width="800" />
</a>

*Observe the attack. Investigate the evidence. Validate and enforce a response.*

<a href="https://youtu.be/5-JEJ8wvWRo">
  <img src="https://img.shields.io/badge/▶_Watch_the_3--Minute_Demo-8B5CF6?style=for-the-badge" alt="Watch the three-minute Immunis demo" />
</a>

<sub>Recorded locally with the fallback synthesizer and scripted Red Agent. No live Workers AI inference is shown.</sub>

</div>

---

## 🛡️ Overview

Immunis is an application defense prototype built on Cloudflare. It remembers suspicious activity, investigates incidents, and publishes temporary request-filtering rules. The dashboard shows the evidence and decisions behind each response.

**The Red Agent is separate testing tooling.** It challenges the defense with changing payloads; it is not part of the protection a website needs to run.

## ✨ Features

| Feature | What it does |
|---|---|
| **Stateful defense** | Tracks incidents and correlates shared attack patterns across addresses. |
| **Agent investigation** | Uses a bounded tool loop to inspect evidence, read supplied context, and propose mitigations. |
| **Validation and revision** | Checks proposed patterns against attack and benign samples; returns rejection feedback to the Analyst. |
| **Temporary protection** | Publishes expiring rules for the Shield Worker to enforce. |
| **Visible decisions** | Streams captured requests, investigation traces, and active mitigations to the dashboard. |
| **Fallback synthesis** | Derives and validates candidate patterns when model inference is unavailable. |

## 🏗️ Architecture

```mermaid
flowchart LR
    Traffic[Incoming requests] --> Shield[Shield Worker]
    Shield -->|Allowed requests| App[Application]
    Shield -->|Suspicious evidence| Queue[Cloudflare Queue]
    Queue --> Commander[Commander · Durable Objects]
    Commander --> Analyst[Analyst · Workers AI or fallback]
    Analyst -->|Proposed mitigation| Validator[Commander validation]
    Validator -->|Approved rule| KV[(KV)]
    KV --> Shield
    Commander --> D1[(D1 · Audit ledger)]
    Commander -->|Live events| Dashboard[Dashboard]
```

The Analyst proposes; Commander controls deployment. **Shield enforces the rules**—the application’s source code stays unchanged.

## 🛠️ Tech Stack

| Layer | Technologies |
|---|---|
| **Defense backend** | Cloudflare Workers, Durable Objects, Queues, KV, D1 |
| **AI** | Workers AI · Llama 3.3 70B |
| **Dashboard** | Next.js, React, TypeScript, Tailwind CSS |
| **Practice target** | Express, SQLite |

## 🚀 Quick Start

<details>
<summary><strong>Expand local setup</strong></summary>

You’ll need **Node.js 24** and npm (the tests use Node's TypeScript and SQLite support). Keep the deliberately vulnerable target in a controlled local environment.

```sh
git clone https://github.com/KirstenSotelo/Immunis.git
cd Immunis
```

Open three terminals at the repository root.

**1. Practice target — port 3001**

```sh
cd apps/target
npm ci
npm start
```

**2. Defense engine — port 8787**

Copy `apps/orchestrator/.dev.vars.example` to `apps/orchestrator/.dev.vars`. Set `ANALYST_MODE="fallback"` for deterministic defensive analysis.

```sh
cd apps/orchestrator
npm ci
npm run db:init
npm run dev
```

**3. Dashboard — port 3000**

```sh
cd apps/dashboard
npm ci
npm run dev
```

Open **http://127.0.0.1:3000**. Stop each service with `Ctrl+C`.

For a different engine address, see `apps/dashboard/.env.example`. The current dashboard assumes a local Commander without an API key; authenticated dashboard access remains follow-up work.

**Run the checks**

From `apps/orchestrator`, run `npm test` and `npm run typecheck`. From `apps/dashboard`, run `npm run typecheck` and `npm run build`. Tests use scripted models and mocked Cloudflare bindings, not live AI.

</details>

### Try the defense

In **Red Team Console**:

1. **Benign login** → `401` from the application.
2. **Burst ×3** → watch Immunis investigate and publish a rule.
3. **SQLi attack** → `403` from Shield after protection activates.
4. **Benign login** → verify the normal request still reaches the application.
5. **Reset demo** → start again.

**Botnet ×4** tests correlation across simulated addresses. **Unleash AI** starts the adaptive attacker, with a scripted fallback. **Terminate** stops it.

## 📁 Project Structure

```text
apps/
├── orchestrator/   # Shield, Commander, Analyst, and Cloudflare bindings
├── dashboard/      # Live evidence, mitigations, and demo controls
└── target/         # Deliberately vulnerable practice application
docs/
├── PROJECT_BRIEF.md
└── assets/         # Animated demo preview
```

## 🔎 Prototype Scope

- Protection is temporary filtering, not source-code repair or general zero-day detection.
- SQL injection is real against the practice database; additional attack classes use simulated outcomes.
- Validation covers selected samples. Extended testing found an overly broad rule that also blocked benign traffic.
- Application-specific replay, stronger validation, and live AI evaluation are next priorities.

See the [engineering brief](docs/PROJECT_BRIEF.md) for implementation and testing details.

---

<div align="center">
  <sub>Built at Hack the North · Investigate. Validate. Protect.</sub>
</div>
