'use client';

import { useState, useEffect } from 'react';
import { clock } from '@/lib/format';
import type { RedTeamAction, RedTeamResponse, RedTeamResult, Verdict } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertCircle, Terminal, BrainCircuit } from 'lucide-react';

const VERDICT: Record<Verdict, { label: string; color: string; variant: any }> = {
  breached: { label: 'breached', color: 'text-rose-500', variant: 'destructive' },
  blocked: { label: 'blocked', color: 'text-emerald-500', variant: 'success' },
  rejected: { label: 'rejected', color: 'text-zinc-400', variant: 'secondary' },
  error: { label: 'error', color: 'text-amber-500', variant: 'warning' },
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
  const [autoRun, setAutoRun] = useState(false);
  const [autoIterations, setAutoIterations] = useState(0);

  async function run(action: RedTeamAction, autoHistory?: { payload: string; result: string }[]) {
    setBusy(action);
    setError(null);
    try {
      const response = await fetch('/api/red-team', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action, ips: knownIps, history: autoHistory }),
      });
      const body = (await response.json()) as RedTeamResponse;
      if (!response.ok || body.error) throw new Error(body.error ?? `HTTP ${response.status}`);

      if (action === 'reset') {
        if (body.reset?.some((r) => !r.ok)) setError('Reset failed for some IPs — is the orchestrator running?');
        onReset();
        setAutoRun(false);
      } else {
        onResults(body.results);
        return body.results;
      }
    } catch (e) {
      setError((e as Error).message);
      setAutoRun(false);
    } finally {
      setBusy(null);
    }
  }

  useEffect(() => {
    if (!autoRun) return;
    if (autoIterations >= 5) {
      setAutoRun(false);
      return;
    }
    let active = true;
    const timer = setTimeout(async () => {
      const attackHistory = history
        .filter(r => r.payload)
        .map(r => ({ payload: r.payload!, result: r.verdict }));
      const res = await run('auto', attackHistory);
      if (active && res && res[0]) {
        setAutoIterations(i => i + 1);
      } else if (!res) {
        setAutoRun(false);
      }
    }, 1500);
    return () => { active = false; clearTimeout(timer); };
  }, [autoRun, autoIterations]);

  const disabled = busy !== null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 text-xs text-zinc-500 font-mono mb-2">
        <Terminal className="h-3 w-3" />
        <span>→ Shield :8787 → Origin :3001</span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Button variant="secondary" size="sm" disabled={disabled} onClick={() => run('benign')} className="text-xs">
          {busy === 'benign' ? 'Sending…' : 'Benign login'}
        </Button>
        <Button variant="destructive" size="sm" disabled={disabled} onClick={() => run('attack')} className="text-xs">
          {busy === 'attack' ? 'Sending…' : 'SQLi attack'}
        </Button>
        <Button variant="outline" size="sm" disabled={disabled} onClick={() => run('burst')} className="text-xs border-rose-900/50 hover:bg-rose-950 hover:text-rose-400">
          {busy === 'burst' ? 'Firing…' : 'Burst ×3'}
        </Button>
      </div>

      <Button 
        variant="outline" 
        size="sm" 
        onClick={() => { setAutoIterations(0); setAutoRun(true); }}
        disabled={disabled || autoRun}
        className="w-full border-violet-900/50 hover:bg-violet-950 hover:text-violet-400 gap-2 mt-[-8px]"
      >
        <BrainCircuit className="h-4 w-4" />
        {autoRun ? `AI Attacking... (${autoIterations}/5)` : 'Unleash AI (Auto-Attack)'}
      </Button>

      <div className="text-[11px] text-zinc-500 leading-relaxed bg-zinc-900/50 p-3 rounded-md border border-zinc-800">
        The Commander opens an incident after 3 hostile requests in 60s, so use <strong>Burst ×3</strong>, wait a couple of seconds for the queue to drain,
        then fire <strong>SQLi attack</strong> again to see the edge block it.{' '}
        <button className="underline hover:text-zinc-300 ml-1" disabled={disabled} onClick={() => run('reset')}>
          {busy === 'reset' ? 'Resetting…' : 'Reset demo'}
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-xs text-rose-400 bg-rose-950/40 p-2 rounded border border-rose-900/50">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      {history.length > 0 && (
        <ScrollArea className="h-40 border border-zinc-800 rounded-md bg-zinc-950 p-2">
          <ul className="flex flex-col gap-1">
            {history.slice(0, 5).map((r, i) => (
              <li key={`${r.at}:${i}`} className="flex items-start gap-2 p-2 hover:bg-zinc-900/50 rounded font-mono text-[10px]">
                <Badge variant={VERDICT[r.verdict].variant} className="h-4 px-1 rounded-sm shrink-0 uppercase text-[9px]">
                  {r.status || '—'} {VERDICT[r.verdict].label}
                </Badge>
                <span className="flex-1 text-zinc-400 break-words">
                  {r.label} · <span className="text-zinc-500">{r.note}</span>
                  {r.thought && (
                    <div className="mt-1 pl-2 border-l border-zinc-800 text-zinc-400 italic text-[11px]">
                      "{r.thought}"
                    </div>
                  )}
                  {r.payload && (
                    <div className="mt-1 pl-2 font-mono text-[9px] text-rose-400/80">
                      {r.payload}
                    </div>
                  )}
                </span>
                <span className="shrink-0 text-zinc-600">
                  {r.ms}ms
                </span>
              </li>
            ))}
          </ul>
        </ScrollArea>
      )}
    </div>
  );
}
