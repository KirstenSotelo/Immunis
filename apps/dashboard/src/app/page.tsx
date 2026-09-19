'use client';

import { useEffect, useState, type CSSProperties } from 'react';

import { LiveLog } from '@/components/LiveLog';
import { MitigationFeed } from '@/components/MitigationFeed';
import { RedTeamConsole } from '@/components/RedTeamConsole';
import { StatsBar } from '@/components/StatsBar';
import styles from '@/components/dashboard.module.css';
import { useWarRoom } from '@/lib/useWarRoom';
import type { Connection } from '@/lib/types';

const CONNECTION: Record<Connection, { label: string; color: string; pulse: boolean }> = {
  connecting: { label: 'CONNECTING', color: 'var(--warn)', pulse: true },
  live: { label: 'LIVE', color: 'var(--ok)', pulse: true },
  offline: { label: 'OFFLINE', color: 'var(--danger)', pulse: false },
};

/** Ticks once a second so TTL countdowns and "live" counts stay honest. Starts at 0 to keep SSR and hydration identical. */
function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(0);
  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}

export default function WarRoom() {
  const { state, actions } = useWarRoom();
  const now = useNow();
  const status = CONNECTION[state.connection];

  const knownIps = [...new Set([...state.knownIps, ...state.mitigations.map((m) => m.ip).filter(Boolean)])];

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Red vs. Blue · Autonomous zero-day patching</p>
          <h1 className={styles.title}>War Room</h1>
          <p className={styles.subtitle}>
            Hostile requests hit the Shield, the Commander tracks the attacker, and the Analyst writes a rule that goes live at the edge — no human in the loop.
          </p>
        </div>
        <div className={styles.pill} role="status" aria-live="polite">
          <span className={`${styles.dot} ${status.pulse ? styles.pulse : ''}`} style={{ '--dot': status.color } as CSSProperties} />
          {status.label}
        </div>
      </header>

      <StatsBar state={state} now={now} />

      <div className={styles.grid}>
        <LiveLog entries={state.log} connection={state.connection} />
        <div className={styles.column}>
          <RedTeamConsole
            history={state.edge.history}
            knownIps={knownIps}
            onResults={actions.recordEdge}
            onReset={() => {
              actions.clear();
              void actions.refreshRules();
            }}
          />
          <MitigationFeed cards={state.mitigations} now={now} />
        </div>
      </div>
    </main>
  );
}
