# Immunis — three-minute demo walkthrough

[Watch the recorded demo](https://youtu.be/5-JEJ8wvWRo).

Immunis is the defense product. Red is a separate demonstration tool. The recording uses deterministic Blue synthesis and scripted Red fallback, not live model inference.

## Before presenting

Follow the [README setup](README.md#-quick-start). Use Node 24; start target on 3001, Worker on 8787 and dashboard on 3000. Initialize D1 and configure `.dev.vars`.

`ANALYST_MODE=fallback` makes Blue deterministic; `auto` attempts Workers AI. Red has a separate model/fallback path. Check source attribution before narrating AI behavior.

Stop automatic attacks, then use **Reset demo**. This resets selected IPs and global tracker/rules/feed, not the entire D1 ledger. Rehearse the sequence and test benign traffic after protection.

## 0:00–0:30 — The problem

**Say:** “A vulnerability can remain exposed while developers prepare a fix. Immunis investigates suspicious traffic and deploys temporary protections. The attacker console helps us test the defense.”

**Show:** Traffic feed, Payload Analyzer and Active Mitigations.

## 0:30–1:00 — Before protection

**Do:** Click **Benign login**, then **SQLi attack**.

**Say:** “Wrong credentials return 401: the request reached the application normally. This SQL injection targets a real vulnerable SQLite query. Before protection activates, it can bypass the login.”

Describe the displayed outcome. A 200 is meaningful here because the target reports successful authentication; status 200 alone does not prove compromise.

## 1:00–1:50 — Investigation

**Do:** Click **Burst ×3**, wait for the incident, then select it.

**Say:** “Commander tracks the suspicious requests and opens an investigation. Here are the captured payload, analysis source, steps and validation result. A passing proposal is published for Shield to enforce.”

In fallback mode, say “deterministic synthesizer.” Say “Workers AI” only if the report identifies that source. Show rejection/revision only when they occur.

## 1:50–2:25 — Check the result

**Do:** After a blocking rule appears, click **SQLi attack**, then **Benign login**.

**Say:** “The repeated attack now receives 403 from Shield. The ordinary request still reaches the application and receives 401. Both results matter: protection should stop the attack without locking out normal users.”

If benign traffic is blocked, explain the false positive instead of presenting success. Local stress testing has found an overly broad rule.

## 2:25–2:45 — Optional adaptive test

**Do:** Use **Botnet ×4** after reset, or briefly run **Unleash AI**, then **Terminate**.

**Say:** “The separate harness can vary payloads and simulate multiple addresses. Immunis correlates evidence and can add protections.”

Simulated addresses require `DEMO_ALLOW_SOURCE_SPOOF=true`. Auto mode sends three requests from one simulated address per round. Its UI currently hides the generator source, so the button name does not prove AI ran. Additional attack classes on the login endpoint have simulated success outcomes.

## 2:45–3:00 — Close

**Say:** “Immunis connects incident memory, investigation, validation and temporary enforcement. Next comes stronger application-specific validation and live deployment evaluation.”

## Scope of the demonstration

This shows a local attack-to-protection workflow. It does not establish general zero-day detection, source-code repair, model training, fixed success percentages or instant global KV propagation. Our Shield Worker enforces the rules; they are not published to Cloudflare's managed WAF service.
