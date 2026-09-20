'use client';

import { useEffect, useMemo, useState } from 'react';
import { useWarRoom } from '@/lib/useWarRoom';
import type { LogEntry } from '@/lib/types';

import { Header } from '@/components/Header';
import { TrafficFeed } from '@/components/TrafficFeed';
import { PayloadAnalyzer } from '@/components/PayloadAnalyzer';
import { ActiveMitigations } from '@/components/ActiveMitigations';
import { RedTeamConsole } from '@/components/RedTeamConsole';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Swords } from 'lucide-react';

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
  // Which entry the user pinned by clicking. Null means "auto-follow the newest threat".
  const [pinnedId, setPinnedId] = useState<string | null>(null);

  const knownIps = [...new Set([...state.knownIps, ...state.mitigations.map((m) => m.ip).filter(Boolean)])];

  // The entry the analyzer shows: the pinned one, else the most recent entry worth
  // inspecting, so the panel follows the live fight instead of freezing on the first hit.
  // Prefer richness: an analyst trace beats bare evidence beats a plain classified hit.
  // Edge-block log lines carry no payload, so they never auto-win the panel.
  const autoEntry = useMemo(() => {
    let withAnalyst: LogEntry | null = null;
    let withEvidence: LogEntry | null = null;
    let classified: LogEntry | null = null;
    for (let i = state.log.length - 1; i >= 0; i--) {
      const e = state.log[i];
      if (!withAnalyst && e.analyst) withAnalyst = e;
      if (!withEvidence && e.evidence) withEvidence = e;
      if (!classified && e.attackClass && e.kind !== 'edge') classified = e;
    }
    return withAnalyst ?? withEvidence ?? classified;
  }, [state.log]);

  const selectedEntry: LogEntry | null = useMemo(() => {
    if (pinnedId) return state.log.find((e) => e.id === pinnedId) ?? autoEntry;
    return autoEntry;
  }, [pinnedId, state.log, autoEntry]);

  const edgeBlockCount = Object.keys(state.edgeBlocks).length;
  const lastAnalystMs = useMemo(() => {
    for (let i = state.log.length - 1; i >= 0; i--) {
      if (state.log[i].analyst) return state.log[i].analyst!.latencyMs;
    }
    return null;
  }, [state.log]);

  return (
    <div className="flex flex-col min-h-screen bg-zinc-950 text-zinc-100">
      <div className="flex-none sticky top-0 z-50 bg-zinc-950/80 backdrop-blur-md border-b border-zinc-800/80">
        <Header connection={state.connection} analystMs={lastAnalystMs} />
      </div>

      <div className="fixed bottom-6 right-6 z-50">
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="h-10 px-4 gap-2 border-zinc-700 bg-zinc-900/90 backdrop-blur shadow-xl hover:bg-zinc-800 rounded-full">
              <Swords className="h-4 w-4 text-rose-400" />
              Red Team Console
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md bg-zinc-950/95 border-zinc-800">
            <DialogHeader>
              <DialogTitle>Red Team Console</DialogTitle>
            </DialogHeader>
            <div className="mt-4">
              <RedTeamConsole
                history={state.edge.history}
                knownIps={knownIps}
                onResults={actions.recordEdge}
                onReset={() => {
                  actions.clear();
                  setPinnedId(null);
                  void actions.refreshRules();
                }}
              />
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <main className="flex-1 grid grid-cols-12 relative p-4 gap-4">
        <div className="col-span-4 relative z-10">
          <TrafficFeed
            entries={state.log}
            selectedId={selectedEntry?.id || null}
            onSelect={(e) => setPinnedId(e.id)}
          />
        </div>

        <div className="col-span-5 relative z-10">
          <PayloadAnalyzer entry={selectedEntry} />
        </div>

        <div className="col-span-3 relative z-10">
          <ActiveMitigations cards={state.mitigations} now={now} edgeBlocks={edgeBlockCount} campaigns={Object.values(state.campaigns)} />
        </div>

        <div className="fixed top-1/4 left-1/4 w-96 h-96 bg-violet-500/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="fixed bottom-1/4 right-1/4 w-96 h-96 bg-emerald-500/5 rounded-full blur-[120px] pointer-events-none" />
      </main>
    </div>
  );
}
