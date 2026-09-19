'use client';

import { useEffect, useState } from 'react';
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
  const [selectedEntry, setSelectedEntry] = useState<LogEntry | null>(null);

  const knownIps = [...new Set([...state.knownIps, ...state.mitigations.map((m) => m.ip).filter(Boolean)])];

  // Auto-select latest threat if none selected
  useEffect(() => {
    if (!selectedEntry && state.log.length > 0) {
      const latestThreat = [...state.log].reverse().find(e => e.tone === 'danger' || e.tone === 'warn' || e.attackClass);
      if (latestThreat) setSelectedEntry(latestThreat);
    }
  }, [state.log, selectedEntry]);

  return (
    <div className="flex flex-col h-screen bg-zinc-950 text-zinc-100 overflow-hidden">
      <div className="flex-none">
        <Header connection={state.connection} />
      </div>

      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-50">
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 gap-2 border-zinc-700 bg-zinc-900/50 hover:bg-zinc-800">
              <Swords className="h-3.5 w-3.5 text-rose-400" />
              Simulate Attack
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Red Team Simulator</DialogTitle>
            </DialogHeader>
            <div className="mt-4">
              <RedTeamConsole
                history={state.edge.history}
                knownIps={knownIps}
                onResults={actions.recordEdge}
                onReset={() => {
                  actions.clear();
                  void actions.refreshRules();
                }}
              />
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <main className="flex-1 min-h-0 grid grid-cols-12 relative">
        {/* Left Panel: Traffic Feed (30%) */}
        <div className="col-span-4 h-full relative z-10">
          <TrafficFeed 
            entries={state.log} 
            selectedId={selectedEntry?.id || null} 
            onSelect={setSelectedEntry} 
          />
        </div>

        {/* Center Panel: Payload Analyzer (45%) */}
        <div className="col-span-5 h-full relative z-10">
          <PayloadAnalyzer entry={selectedEntry} />
        </div>

        {/* Right Panel: Mitigations (25%) */}
        <div className="col-span-3 h-full relative z-10">
          <ActiveMitigations cards={state.mitigations} now={now} />
        </div>
        
        {/* Decorative background glows */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-violet-500/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-emerald-500/5 rounded-full blur-[120px] pointer-events-none" />
      </main>
    </div>
  );
}
