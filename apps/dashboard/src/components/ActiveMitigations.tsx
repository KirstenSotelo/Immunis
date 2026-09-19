import { Shield, Server } from "lucide-react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import type { MitigationCard } from "@/lib/types"

interface ActiveMitigationsProps {
  cards: MitigationCard[]
  now: number
}

function timeAgo(ms: number, now: number) {
  const diff = now - ms
  if (diff < 60000) return "Just now"
  return `${Math.floor(diff / 60000)}m ago`
}

export function ActiveMitigations({ cards, now }: ActiveMitigationsProps) {
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
          <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Active Rules</div>
          <div className="font-mono text-xl text-zinc-200">{cards.length}</div>
        </div>
        <div className="bg-zinc-950/80 p-4">
          <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Block Rate</div>
          <div className="font-mono text-xl text-emerald-400">99.4%</div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4">
        <Table>
          <TableHeader>
            <TableRow className="border-zinc-800/60 hover:bg-transparent">
              <TableHead className="text-xs text-zinc-500 h-8">Target</TableHead>
              <TableHead className="text-xs text-zinc-500 h-8">Rule / Pattern</TableHead>
              <TableHead className="text-xs text-zinc-500 h-8 text-right">Age</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cards.length === 0 ? (
              <TableRow className="hover:bg-transparent border-none">
                <TableCell colSpan={3} className="text-center text-zinc-600 py-8">
                  No active mitigations in KV
                </TableCell>
              </TableRow>
            ) : (
              cards.map((card) => (
                <TableRow key={card.id} className="border-zinc-800/60">
                  <TableCell className="py-3">
                    <div className="flex flex-col gap-1">
                      <span className="font-mono text-xs text-zinc-300">{card.ip}</span>
                      {card.attackClass && (
                        <Badge variant="outline" className="w-fit text-[9px] h-4 px-1">{card.attackClass}</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="py-3 max-w-[120px]">
                    <div className="font-mono text-[10px] text-emerald-400 truncate bg-emerald-500/10 px-1 py-0.5 rounded border border-emerald-500/20">
                      {card.pattern || card.kind}
                    </div>
                  </TableCell>
                  <TableCell className="py-3 text-right text-xs text-zinc-500">
                    {timeAgo(card.deployedAt, now)}
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
