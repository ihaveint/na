"use client"
import { useEffect, useRef, useState } from "react"
import type { Transaction, UISchema, ChatMessage } from "@/lib/types"
import TransactionDetailPanel from "./TransactionDetailPanel"
import { applySchema } from "@/lib/utils"
import { useVersionHistory } from "@/lib/useVersionHistory"
import ListView from "./layouts/ListView"
import KanbanView from "./layouts/KanbanView"
import TableView from "./layouts/TableView"
import DynamicView from "./DynamicView"
import ChatModal from "./ChatModal"
import InspectOverlay from "./InspectOverlay"
import HistoryDrawer from "./HistoryDrawer"

const API = "http://localhost:8001"

interface Props {
  schema: UISchema
  defaultSchema: UISchema
  onSchemaChange: (s: UISchema) => void
  personaId: string
}

export default function MalleableRuntime({ schema, defaultSchema, onSchemaChange, personaId }: Props) {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [applying, setApplying] = useState(false)
  const [justApplied, setJustApplied] = useState(false)

  const [store] = useState<Storage>(() => {
    if (typeof window === "undefined") return undefined as unknown as Storage
    return sessionStorage.getItem("ledger:share-mode") ? sessionStorage : localStorage
  })

  const { versions, currentIndex, push: pushVersion, restore: restoreVersion } = useVersionHistory(`ledger:history:${personaId}`, store)
  const savedVersion = versions[currentIndex] ?? null

  const sharedArtifact = useRef((() => {
    if (typeof window === "undefined") return null
    try {
      const raw = sessionStorage.getItem("ledger:share")
      if (raw) { sessionStorage.removeItem("ledger:share"); return JSON.parse(raw) }
    } catch {}
    return null
  })())

  const [renderMode, setRenderMode] = useState<"schema" | "component">(
    () => sharedArtifact.current?.renderMode ?? savedVersion?.renderMode ?? "schema"
  )
  const [componentCode, setComponentCode] = useState<string | null>(
    () => sharedArtifact.current?.componentCode ?? savedVersion?.componentCode ?? null
  )
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>(() => {
    if (typeof window === "undefined") return []
    try {
      const raw = store.getItem(`ledger:chat:${personaId}`)
      return raw ? JSON.parse(raw) : (savedVersion?.chatSnapshot ?? [])
    } catch { return [] }
  })

  const [showCode, setShowCode] = useState(false)
  const [inspectMode, setInspectMode] = useState(false)
  const [inspectContext, setInspectContext] = useState<string | null>(null)
  const [showHistory, setShowHistory] = useState(false)
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null)
  const [shareState, setShareState] = useState<"idle" | "loading" | "copied" | "error">("idle")
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [shareCopied, setShareCopied] = useState(false)
  // Prevents SSR/client hydration mismatches on localStorage-derived UI (e.g. version badge).
  const [mounted, setMounted] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)
  const isFirstRender = useRef(true)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    try { store.setItem(`ledger:chat:${personaId}`, JSON.stringify(chatHistory)) } catch {}
  }, [chatHistory, personaId, store])

  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return }
    blurIn()
  }, [schema, componentCode])

  useEffect(() => {
    const endpoint =
      schema.data_source === "list_expenses" ? "/transactions/expenses"
      : schema.data_source === "list_income" ? "/transactions/income"
      : "/transactions"
    setLoading(true)
    fetch(`${API}${endpoint}`)
      .then((r) => r.json())
      .then((data) => { setTransactions(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [schema.data_source])

  const displayed = applySchema(transactions, schema)

  function blurIn() {
    setTimeout(() => {
      const anim = contentRef.current?.animate(
        [{ opacity: 0, filter: "blur(8px)", transform: "scale(1.02)" }, { opacity: 1, filter: "blur(0px)", transform: "scale(1)" }],
        { duration: 400, easing: "cubic-bezier(0.16, 1, 0.3, 1)", fill: "both" }
      )
      if (anim) anim.onfinish = () => anim.cancel()
    }, 0)
  }

  function flash() {
    setJustApplied(true)
    setTimeout(() => setJustApplied(false), 1500)
  }

  async function handleSend(message: string) {
    const userMessage: ChatMessage = { role: "user", content: message }
    const nextHistory = [...chatHistory, userMessage]
    setChatHistory(nextHistory)
    setApplying(true)

    const apiMessages = nextHistory
      .filter((m) => !m.isSystem)
      .map((m) => ({ role: m.role, content: m.content }))

    try {
      const res = await fetch(`${API}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: apiMessages, current_schema: schema, current_code: componentCode }),
      })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()

      const isGenerated = data.action === "schema" || data.action === "component"
      const assistantMessage: ChatMessage = { role: "assistant", content: data.message, generatedComponent: isGenerated }
      const fullHistory = [...nextHistory, assistantMessage]
      setChatHistory(fullHistory)
      const chatSnapshot = fullHistory.filter((m) => !m.isSystem)

      if (data.action === "schema" && data.schema) {
        onSchemaChange(data.schema)
        setRenderMode("schema")
        setComponentCode(null)
        flash()
        pushVersion({ label: data.message, schema: data.schema, componentCode: null, renderMode: "schema", chatSnapshot })
      } else if (data.action === "component" && data.code) {
        setComponentCode(data.code)
        setRenderMode("component")
        flash()
        pushVersion({ label: data.message, schema, componentCode: data.code, renderMode: "component", chatSnapshot })
      }
    } catch (e) {
      alert(`Error: ${e}`)
    } finally {
      setApplying(false)
    }
  }

  function handleRestore(index: number) {
    const v = versions[index]
    if (!v) return
    setRenderMode(v.renderMode)
    setComponentCode(v.componentCode)
    setChatHistory(() => {
      const newSystemMessage: ChatMessage = { role: "assistant", content: `↩ Restored to: ${v.label}`, isSystem: true }
      return [...v.chatSnapshot, newSystemMessage]
    })
    setInspectContext(null)
    setInspectMode(false)
    setShowHistory(false)
    if (v.schema !== schema) onSchemaChange(v.schema)
    restoreVersion(index)
  }

  function handleElementClick(context: string) {
    setInspectMode(false)
    setInspectContext(context)
  }

  async function handleShare() {
    setShareState("loading")
    try {
      const label = versions[currentIndex]?.label ?? "Custom view"
      const res = await fetch(`${API}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schema, componentCode, renderMode, label, personaId }),
      })
      const { id } = await res.json()
      const url = `${window.location.origin}${window.location.pathname}?share=${id}`
      setShareUrl(url)
      setShareState("copied")
    } catch {
      setShareState("error")
      setTimeout(() => setShareState("idle"), 2000)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className={`px-4 py-2.5 border-b flex items-center gap-2 flex-wrap bg-zinc-50 flex-shrink-0 transition-all duration-500 ${justApplied ? "border-violet-400 bg-violet-50" : "border-zinc-200"}`}>
        {renderMode === "schema" ? (
          <>
            <LayoutBadge layout={schema.layout} />
            {schema.group_by && <Pill label="group" value={schema.group_by} />}
            {schema.sort_by && <Pill label="sort" value={`${schema.sort_by} ${schema.sort_direction}`} />}
            {schema.data_source !== "list_all" && <Pill label="filter" value={schema.data_source === "list_expenses" ? "expenses only" : "income only"} />}
            {schema.filters.map((f, i) => <Pill key={i} label={f.field} value={`${f.op} ${f.value}`} />)}
          </>
        ) : (
          <>
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-violet-100 text-violet-700">custom</span>
            <button onClick={() => setShowCode((v) => !v)} className="text-xs text-violet-600 hover:underline">
              {showCode ? "Hide code" : "View code"}
            </button>
            <button
              onClick={() => {
                onSchemaChange(defaultSchema)
                setComponentCode(null)
                setRenderMode("schema")
                setInspectContext(null)
                setInspectMode(false)
                const systemMessage: ChatMessage = { role: "assistant", content: "↩ Reset to default view", isSystem: true }
                setChatHistory((prev) => {
                  const filtered = prev.filter((m) => !(m.isSystem && m.content.startsWith("↩ Reset")))
                  return [...filtered, systemMessage]
                })
                pushVersion({ label: "Reset to default view", schema: defaultSchema, componentCode: null, renderMode: "schema", chatSnapshot: chatHistory.filter((m) => !m.isSystem) })
              }}
              className="text-xs text-zinc-400 hover:text-zinc-600 hover:underline"
            >
              Reset
            </button>
          </>
        )}

        <button
          onClick={() => setInspectMode((v) => !v)}
          title="Click any element to chat about it"
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
            inspectMode ? "bg-violet-600 text-white border-violet-600" : "text-zinc-500 border-zinc-200 hover:bg-zinc-100"
          }`}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          {inspectMode ? "Inspecting…" : "Inspect"}
        </button>

        {mounted && <span className="ml-auto text-xs text-zinc-400">{displayed.length} transactions</span>}
        <span className={`text-xs font-medium text-violet-600 transition-opacity duration-300 ${justApplied ? "opacity-100" : "opacity-0"}`}>Applied</span>

        <button
          onClick={() => setShowHistory((v) => !v)}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
            showHistory ? "bg-zinc-800 text-white border-zinc-800" : "text-zinc-500 border-zinc-200 hover:bg-zinc-100"
          }`}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
          </svg>
          {mounted && versions.length > 0 && <span>{versions.length}</span>}
        </button>

        <div className="relative">
          <button
            onClick={shareUrl ? () => { setShareUrl(null); setShareState("idle") } : handleShare}
            disabled={shareState === "loading"}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors text-zinc-500 border-zinc-200 hover:bg-zinc-100 disabled:opacity-50"
          >
            {shareState === "copied" ? (
              <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg> Link ready ×</>
            ) : shareState === "error" ? (
              <span className="text-red-500">Failed</span>
            ) : (
              <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>{shareState === "loading" ? "Sharing…" : "Share"}</>
            )}
          </button>
          {shareUrl && (
            <div className="absolute right-0 top-full mt-1.5 z-50 bg-white border border-zinc-200 rounded-lg shadow-lg p-2 flex items-center gap-1.5" style={{ minWidth: 280 }}>
              <input readOnly value={shareUrl} onFocus={(e) => e.target.select()} className="flex-1 text-xs text-zinc-700 font-mono bg-zinc-50 border border-zinc-200 rounded px-2 py-1 outline-none" autoFocus />
              <button
                onClick={() => { navigator.clipboard.writeText(shareUrl).catch(() => {}); setShareCopied(true); setTimeout(() => setShareCopied(false), 2000) }}
                className="text-xs px-2 py-1 rounded bg-violet-600 text-white hover:bg-violet-700 whitespace-nowrap"
              >
                {shareCopied ? "Copied!" : "Copy"}
              </button>
            </div>
          )}
        </div>
      </div>

      {renderMode === "component" && showCode && componentCode && (
        <div className="border-b border-zinc-200 bg-zinc-950 text-zinc-300 text-xs font-mono p-4 max-h-64 overflow-auto flex-shrink-0">
          <pre className="whitespace-pre-wrap">{componentCode}</pre>
        </div>
      )}

      <div ref={contentRef} className="flex-1 overflow-auto relative min-h-0">
        {loading ? (
          <div className="flex items-center justify-center h-full text-zinc-400 text-sm">Loading…</div>
        ) : renderMode === "component" && componentCode ? (
          <DynamicView code={componentCode} transactions={displayed} onTransactionClick={setSelectedTx} />
        ) : schema.layout === "kanban" ? (
          <KanbanView transactions={displayed} schema={schema} onTransactionClick={setSelectedTx} />
        ) : schema.layout === "table" ? (
          <TableView transactions={displayed} schema={schema} onTransactionClick={setSelectedTx} />
        ) : (
          <ListView transactions={displayed} schema={schema} onTransactionClick={setSelectedTx} />
        )}
        <InspectOverlay active={inspectMode} onElementClick={handleElementClick} />
      </div>

      <HistoryDrawer versions={versions} currentIndex={currentIndex} open={showHistory} onClose={() => setShowHistory(false)} onRestore={handleRestore} />
      <TransactionDetailPanel transaction={selectedTx} onClose={() => setSelectedTx(null)} />
      <ChatModal messages={chatHistory} applying={applying} hasComponent={renderMode === "component"} inspectContext={inspectContext} onClearInspectContext={() => setInspectContext(null)} onSend={handleSend} />
    </div>
  )
}

function LayoutBadge({ layout }: { layout: string }) {
  const colors: Record<string, string> = {
    list:   "bg-blue-100 text-blue-700",
    kanban: "bg-violet-100 text-violet-700",
    table:  "bg-emerald-100 text-emerald-700",
  }
  return <span className={`px-2 py-0.5 rounded text-xs font-semibold ${colors[layout] ?? "bg-zinc-100 text-zinc-600"}`}>{layout}</span>
}

function Pill({ label, value }: { label: string; value: string }) {
  return (
    <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-100 text-xs">
      <span className="text-zinc-400 font-medium">{label}:</span>
      <span className="text-zinc-700 font-mono">{value}</span>
    </span>
  )
}
