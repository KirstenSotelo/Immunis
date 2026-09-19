import type { CSSProperties } from 'react';

import { CLASS_COLORS, classLabel, clock, countdown } from '@/lib/format';
import type { MitigationCard } from '@/lib/types';

import styles from './dashboard.module.css';

function Card({ card, now }: { card: MitigationCard; now: number }) {
  const live = card.expiresAt > now;
  const color = CLASS_COLORS[card.attackClass ?? 'unknown'];
  // Reasons can carry multi-line stack traces (e.g. a degraded analyst); keep the first line only.
  const trail = (card.reasons ?? [])
    .map((r) => r.split('\n')[0].trim())
    .filter((r) => r && !r.startsWith('+'))
    .map((r) => (r.length > 140 ? `${r.slice(0, 137)}…` : r))
    .slice(-3);

  return (
    <article className={`${styles.card} ${live ? '' : styles.cardExpired}`} style={{ '--chip': color } as CSSProperties}>
      <div className={styles.cardTop}>
        <span className={styles.tag} style={{ '--chip': color } as CSSProperties}>
          {classLabel(card.attackClass ?? 'unknown')}
        </span>
        <span className={styles.tag} style={{ '--chip': 'var(--danger)' } as CSSProperties}>
          {card.action}
        </span>
        <span className={styles.panelMeta}>{card.kind === 'pattern_rule' ? 'WAF pattern rule' : 'IP block'}</span>
        <span className={styles.cardStatus} style={{ color: live ? 'var(--ok)' : 'var(--muted)' }}>
          <span className={`${styles.dot} ${live ? styles.pulse : ''}`} style={{ '--dot': live ? 'var(--ok)' : 'var(--muted)' } as CSSProperties} />
          {live ? 'LIVE AT EDGE' : 'EXPIRED'}
        </span>
      </div>

      <code className={styles.code}>{card.kind === 'pattern_rule' && card.pattern ? `/${card.pattern}/${card.flags ?? ''}` : `block_ip_${card.ip || '?'}`}</code>

      {card.reason && <p className={styles.reason}>{card.reason}</p>}

      <div className={styles.cardMeta}>
        <span>deployed {clock(card.deployedAt)}</span>
        <span>{live ? `expires in ${countdown(card.expiresAt, now)}` : 'ttl elapsed'}</span>
        {card.ip && <span>source {card.ip}</span>}
        <span>via {card.source}</span>
      </div>

      {trail.length > 0 && (
        <ul className={styles.trail}>
          {trail.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      )}
    </article>
  );
}

export function MitigationFeed({ cards, now }: { cards: MitigationCard[]; now: number }) {
  const live = cards.filter((c) => c.expiresAt > now).length;
  return (
    <section className={styles.panel} aria-label="Mitigation feed">
      <div className={styles.panelHead}>
        <h2 className={styles.panelTitle}>Mitigation feed</h2>
        <span className={styles.panelMeta}>{live} live</span>
      </div>
      <div className={styles.cards}>
        {cards.length === 0 ? (
          <div className={styles.empty}>
            No rules deployed yet.
            <br />
            The Analyst writes one once an attack burst opens an incident.
          </div>
        ) : (
          cards.map((card) => <Card key={card.id} card={card} now={now} />)
        )}
      </div>
    </section>
  );
}
