import type { CSSProperties } from 'react';

import { STAGE_COLORS } from '@/lib/format';
import type { State } from '@/lib/state';

import styles from './dashboard.module.css';

interface StatProps {
  label: string;
  value: number | string;
  hint: string;
  accent: string;
  badge?: { text: string; color: string };
}

function Stat({ label, value, hint, accent, badge }: StatProps) {
  return (
    <div className={`${styles.panel} ${styles.stat}`} style={{ '--accent': accent } as CSSProperties}>
      <div className={styles.statLabel}>{label}</div>
      <div className={styles.statValue}>
        {value}
        {badge && (
          <span className={styles.tag} style={{ '--chip': badge.color } as CSSProperties}>
            {badge.text}
          </span>
        )}
      </div>
      <div className={styles.statHint} title={hint}>
        {hint}
      </div>
    </div>
  );
}

export function StatsBar({ state, now }: { state: State; now: number }) {
  const liveMitigations = state.mitigations.filter((m) => m.expiresAt > now).length;
  const campaigns = Object.values(state.campaigns).filter((c) => c.distributed).length;
  const { threat, edge } = state;

  return (
    <section className={styles.stats} aria-label="Summary statistics">
      <Stat label="Attacks detected" value={state.detected} hint="classified requests, all IPs" accent="var(--danger)" />
      <Stat
        label="Incidents"
        value={state.incidentIds.length}
        hint={campaigns ? `${campaigns} distributed campaign${campaigns > 1 ? 's' : ''}` : 'opened by the Commander'}
        accent="var(--warn)"
      />
      <Stat
        label="Mitigations live"
        value={liveMitigations}
        hint={`${state.mitigations.length} deployed this session`}
        accent="var(--ok)"
      />
      <Stat
        label="Blocked at edge"
        value={edge.blocked}
        hint={edge.sent ? `${edge.breached} breached · ${edge.sent} sent from console` : 'counts 403s from the Red Team console'}
        accent="var(--cyan)"
      />
      <Stat
        label="Threat score"
        value={threat ? Math.round(threat.score) : 0}
        hint={threat ? `latest: ${threat.ip}` : 'no hostile traffic yet'}
        accent="var(--violet)"
        badge={threat ? { text: threat.stage, color: STAGE_COLORS[threat.stage] } : undefined}
      />
    </section>
  );
}
