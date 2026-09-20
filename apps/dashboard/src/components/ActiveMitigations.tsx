import { Server, Radio } from "lucide-react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import type { CampaignSummary, MitigationCard } from "@/lib/types"

interface ActiveMitigationsProps {
  cards: MitigationCard[]
  now: number
  /** Requests the Shield itself reported refusing at the edge. */
  edgeBlocks: number
  campaigns: CampaignSummary[]
}

function countdown(expiresAt: number, now: number) {
  const s = Math.floor((expiresAt - now) / 1000)
  if (s <= 0) return "expired"
  if (s >= 3600) return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`
  if (s >= 60) return `${Math.floor(s / 60)}m ${s % 60}s`
  return `${s}s`
}

export function ActiveMitigations({ cards, now, edgeBlocks, campaigns }: ActiveMitigationsProps) {
  const live = cards.filter((c) => c.expiresAt > now)
  const distributed = campaigns.filter((c) => c.distributed)

  return (
    <div className="flex flex-col h-full bg-zinc-950/40 border-l border-zinc-800/80">
      <div className="flex items-center justify-between p-4 border-b border-zinc-800/80">
        <h2 className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
          <Server className="h-4 w-4 text-emerald-400" />
          Active Mitigations
        </h2>
      </div>

      <div className="grid grid-cols-2 gap-px bg-zinc-800/80 border-b border-zinc-800/80">
        <div className="bg-zinc-950/80 p-4">
          <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Live at edge</div>
          <div className="font-mono text-xl text-zinc-200">{live.length}</div>
        </div>
        <div className="bg-zinc-950/80 p-4">
          <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Blocked at edge</div>
          <div className="font-mono text-xl text-emerald-400">{edgeBlocks}</div>
        </div>
      </div>

      {distributed.length > 0 && (
        <div className="px-4 py-2 border-b border-zinc-800/80 bg-rose-950/20 flex items-center gap-2 text-[11px] text-rose-300">
          <Radio className="h-3.5 w-3.5 animate-pulse" />
          {distributed.map((c) => (
            <span key={c.fingerprint}>Distributed {c.attackClass} campaign · {c.ipCount} IPs</span>
          ))}
        </div>
      )}

      <div className="flex-1 overflow-auto p-4">
        <Table>
          <TableHeader>
            <TableRow className="border-zinc-800/60 hover:bg-transparent">
              <TableHead className="text-xs text-zinc-500 h-8">Target</TableHead>
              <TableHead className="text-xs text-zinc-500 h-8">Rule / Pattern</TableHead>
              <TableHead className="text-xs text-zinc-500 h-8 text-right">TTL</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {live.length === 0 ? (
              <TableRow className="hover:bg-transparent border-none">
                <TableCell colSpan={3} className="text-center text-zinc-600 py-8">
                  No active mitigations
                </TableCell>
              </TableRow>
            ) : (
              live.map((card) => (
                <TableRow key={card.id} className="border-zinc-800/60">
                  <TableCell className="py-3">
                    <div className="flex flex-col gap-1">
                      <span className="font-mono text-xs text-zinc-300">{card.ip || "—"}</span>
                      {card.attackClass && (
                        <Badge variant="outline" className="w-fit text-[9px] h-4 px-1">{card.attackClass}</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="py-3 max-w-[140px]">
                    <div className="font-mono text-[10px] text-emerald-400 truncate bg-emerald-500/10 px-1 py-0.5 rounded border border-emerald-500/20"
                      title={card.pattern || card.kind}>
                      {card.kind === "pattern_rule" ? (card.pattern ? `/${card.pattern}/` : "pattern") : "IP block"}
                    </div>
                  </TableCell>
                  <TableCell className="py-3 text-right text-xs text-zinc-500 font-mono">
                    {countdown(card.expiresAt, now)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
