/**
 * The Commander's degraded mode. OWNER: Member 2.
 *
 * When the Analyst is unavailable — model rate-limited, not authenticated, returning
 * prose instead of JSON, or simply not merged yet — the Commander still has to act.
 * A security system that stops defending because its LLM hiccuped is not a security
 * system, so the escalation path is: Analyst -> these deterministic signatures -> IP block.
 *
 * Every pattern here is hand-verified against the benign corpus in mitigation.ts; the
 * `signatures round-trip through validateRule` test enforces that they stay that way.
 */

import type { AttackClass, IncidentBrief, MitigationPlan } from '../types';
import { suggestedTtlSeconds } from './policy';

const CLASS_SIGNATURES: Record<AttackClass, { pattern: string; flags: string } | null> = {
	sqli: {
		pattern: String.raw`(?:\bunion\b[\s\S]{0,40}?\bselect\b|\bor\b\s+1\s*=\s*1|\b(?:sleep|pg_sleep|benchmark)\s*\(|\binformation_schema\b|\bxp_cmdshell\b)`,
		flags: 'i',
	},
	xss: {
		pattern: String.raw`(?:<\s*script[\s>]|\bon(?:error|load|toggle)\s*=|javascript\s*:|document\s*\.\s*cookie)`,
		flags: 'i',
	},
	path_traversal: {
		pattern: String.raw`(?:(?:\.\.[\/\\]){2,}|%2e%2e(?:%2f|%5c)|\/etc\/(?:passwd|shadow)|\/proc\/self\/environ)`,
		flags: 'i',
	},
	rce: {
		pattern: String.raw`(?:[;&|]\s*(?:cat|ls|whoami|curl|wget|chmod)\s|\$\([^)]{1,60}\)|\/dev\/tcp\/|\bnc\s+-[a-z]*e\b)`,
		flags: 'i',
	},
	ssrf: {
		pattern: String.raw`(?:169\.254\.169\.254|metadata\.google\.internal|\b(?:file|gopher|dict):\/\/)`,
		flags: 'i',
	},
	nosqli: {
		pattern: String.raw`["']?\$(?:ne|gt|gte|lt|lte|where|regex|expr)["']?\s*[:=]`,
		flags: 'i',
	},
	log4shell: {
		pattern: String.raw`\$\{\s*jndi\s*:\s*(?:ldap|ldaps|rmi|dns|iiop)`,
		flags: 'i',
	},
	scanner: {
		pattern: String.raw`\b(?:sqlmap|nikto|nmap|masscan|acunetix|nessus|dirbuster|gobuster|wpscan|nuclei)\b`,
		flags: 'i',
	},
	// No trustworthy signature exists for traffic we could not classify. Blocking the
	// single address is the honest response; inventing a pattern is how you take a site down.
	unknown: null,
};

export function signatureFor(attackClass: AttackClass): { pattern: string; flags: string } | null {
	return CLASS_SIGNATURES[attackClass];
}

/** Deterministic plan from the classifier alone. No network, no model, always available. */
export function fallbackPlan(brief: IncidentBrief): MitigationPlan {
	const { classification } = brief;
	const signature = CLASS_SIGNATURES[classification.attackClass];
	const ttlSeconds = suggestedTtlSeconds(classification.attackClass, brief.priorIncidents);

	// A distributed campaign means the IP is disposable — block the technique, not the address.
	const preferPattern = Boolean(signature) && (brief.campaign?.distributed || classification.confidence >= 0.7);

	if (preferPattern && signature) {
		return {
			kind: 'pattern_rule',
			action: brief.stage === 'challenge' ? 'challenge' : 'block',
			pattern: signature.pattern,
			flags: signature.flags,
			ttlSeconds,
			attackClass: classification.attackClass,
			confidence: classification.confidence,
			source: 'commander-fallback',
			diagnosis:
				`${brief.eventCount} requests from ${brief.ip} match a ${classification.attackClass} pattern ` +
				`(${classification.indicators.join(', ') || 'no named indicator'}). ` +
				(brief.campaign?.distributed
					? `The same fingerprint is live on ${brief.campaign.ipCount} addresses, so this deploys a payload rule rather than an IP block.`
					: `Deploying a signature rule for ${classification.pathTemplate}.`),
		};
	}

	return {
		kind: 'block_ip',
		action: 'block',
		ttlSeconds,
		attackClass: classification.attackClass,
		confidence: classification.confidence,
		source: 'commander-fallback',
		diagnosis:
			`${brief.ip} sent ${brief.eventCount} suspicious requests (threat score ${brief.threatScore.toFixed(1)}, stage ${brief.stage}). ` +
			`Classified ${classification.attackClass}; no high-confidence payload signature available, so the address is blocked for ${ttlSeconds}s.`,
	};
}
