'use client';

import { useState, type CSSProperties } from 'react';

import { clock } from '@/lib/format';
import type { RedTeamAction, RedTeamResponse, RedTeamResult, Verdict } from '@/lib/types';

import styles from './dashboard.module.css';

const VERDICT: Record<Verdict, { label: string; color: string }> = {
  breached: { label: 'breached', color: 'var(--danger)' },
  blocked: { label: 'blocked', color: 'var(--ok)' },
  rejected: { label: 'rejected', color: 'var(--info)' },
  error: { label: 'error', color: 'var(--warn)' },
};

interface Props {
  history: RedTeamResult[];
  knownIps: string[];
  onResults: (results: RedTeamResult[]) => void;
  onReset: () => void;
}

export function RedTeamConsole({ history, knownIps, onResults, onReset }: Props) {
  const [busy, setBusy] = useState<RedTeamAction | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(action: RedTeamAction) {
    setBusy(action);
    setError(null);
    try {
      const response = await fetch('/api/red-team', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action, ips: knownIps }),
      });
      const body = (await response.json()) as RedTeamResponse;
      if (!response.ok || body.error) throw new Error(body.error ?? `HTTP ${response.status}`);

      if (action === 'reset') {
        if (body.reset?.some((r) => !r.ok)) setError('Reset failed for some IPs — is the orchestrator running?');
        onReset();
      } else {
        onResults(body.results);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const disabled = busy !== null;

  return (
    <section className={styles.panel} aria-label="Red team console">
      <div className={styles.panelHead}>
        <h2 className={styles.panelTitle}>Red team console</h2>
        <span className={styles.panelMeta}>→ Shield :8787 → Origin :3001</span>
      </div>

      <div className={styles.btnRow}>
        <button className={styles.btn} disabled={disabled} onClick={() => run('benign')}>
          {busy === 'benign' ? 'Sending…' : 'Benign login'}
        </button>
        <button className={`${styles.btn} ${styles.btnAttack}`} disabled={disabled} onClick={() => run('attack')}>
          {busy === 'attack' ? 'Sending…' : 'SQLi attack'}
        </button>
        <button className={`${styles.btn} ${styles.btnAttack}`} disabled={disabled} onClick={() => run('burst')}>
          {busy === 'burst' ? 'Firing…' : 'Burst ×3'}
        </button>
      </div>

      <p className={styles.consoleHint}>
        The Commander opens an incident after 3 hostile requests in 60s, so use <strong>Burst ×3</strong>, wait a couple of seconds for the queue to drain,
        then fire <strong>SQLi attack</strong> again to see the edge block it.{' '}
        <button className={`${styles.btn} ${styles.btnGhost}`} style={{ padding: '3px 9px', fontSize: 12 }} disabled={disabled} onClick={() => run('reset')}>
          {busy === 'reset' ? 'Resetting…' : 'Reset demo'}
        </button>
      </p>

      {error && <p className={styles.error}>{error}</p>}

      {history.length > 0 && (
        <ul className={styles.results}>
          {history.slice(0, 5).map((r, i) => (
            <li key={`${r.at}:${i}`} className={styles.result}>
              <span className={styles.tag} style={{ '--chip': VERDICT[r.verdict].color } as CSSProperties}>
                {r.status || '—'} {VERDICT[r.verdict].label}
              </span>
              <span className={styles.resultNote}>
                {r.label} · {r.note}
              </span>
              <span className={styles.resultMs}>
                {clock(r.at)} · {r.ms}ms
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
