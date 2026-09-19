'use client';

import { useEffect, useRef, type CSSProperties } from 'react';

import { CLASS_COLORS, STAGE_COLORS, classLabel, clock } from '@/lib/format';
import type { Connection, LogEntry, Tone } from '@/lib/types';
import { ORCHESTRATOR_URL } from '@/lib/useWarRoom';

import styles from './dashboard.module.css';

const TONE_COLORS: Record<Tone, string> = {
  info: '#c3c8da',
  warn: 'var(--warn)',
  danger: 'var(--danger)',
  ok: 'var(--ok)',
};

function Row({ entry }: { entry: LogEntry }) {
  return (
    <div className={styles.logRow}>
      <span className={styles.time}>{clock(entry.at)}</span>
      {entry.ip && <span className={styles.ip}>{entry.ip}</span>}
      {entry.attackClass && entry.kind !== 'edge' && (
        <span className={styles.tag} style={{ '--chip': CLASS_COLORS[entry.attackClass] } as CSSProperties}>
          {classLabel(entry.attackClass)}
        </span>
      )}
      <span className={styles.logText} style={{ '--tone': TONE_COLORS[entry.tone] } as CSSProperties}>
        {entry.text}
      </span>
      {entry.analysis && (
        <span className={styles.tag} style={{ '--chip': 'var(--violet)' } as CSSProperties}>
          analyst engaged
        </span>
      )}
      {entry.kind === 'ingest' && entry.stage && (
        <span className={styles.logStats}>
          <span>conf {Math.round((entry.confidence ?? 0) * 100)}%</span>
          <span>score {Math.round(entry.score ?? 0)}</span>
          <span className={styles.tag} style={{ '--chip': STAGE_COLORS[entry.stage] } as CSSProperties}>
            {entry.stage}
          </span>
        </span>
      )}
      {entry.detail && <span className={styles.detail}>{entry.detail}</span>}
    </div>
  );
}

export function LiveLog({ entries, connection }: { entries: LogEntry[]; connection: Connection }) {
  const scroller = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  // Connection notices are logged as `system` rows; the room is still "quiet" until real traffic arrives.
  const quiet = entries.every((entry) => entry.kind === 'system');

  // Follow the tail like a terminal, unless the operator has scrolled up to read.
  useEffect(() => {
    const el = scroller.current;
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [entries]);

  const onScroll = () => {
    const el = scroller.current;
    if (el) stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
  };

  return (
    <section className={styles.panel} aria-label="Live log">
      <div className={styles.panelHead}>
        <h2 className={styles.panelTitle}>Live log</h2>
        <span className={styles.panelMeta}>{entries.length} {entries.length === 1 ? 'event' : 'events'}</span>
      </div>
      {connection === 'offline' && (
        <p className={styles.notice} role="alert">
          Can’t reach the orchestrator at <code>{ORCHESTRATOR_URL}</code>. Start it with <code>npm run dev</code> in <code>apps/orchestrator</code> — this page
          reconnects on its own.
        </p>
      )}
      <div className={styles.log} ref={scroller} onScroll={onScroll} role="log" aria-live="off">
        {entries.map((entry) => (
          <Row key={entry.id} entry={entry} />
        ))}
        {quiet && connection !== 'offline' && (
          <div className={styles.empty}>
            All quiet. Waiting for hostile traffic
            <span className={styles.cursor} aria-hidden />
            <br />
            Fire a request from the Red Team console →
          </div>
        )}
      </div>
    </section>
  );
}
