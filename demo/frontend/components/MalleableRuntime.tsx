"use client"
import { useEffect, useRef, useState } from "react"
import type { Thread, UISchema } from "@/lib/types"
import { applySchema } from "@/lib/utils"
import ListView from "./layouts/ListView"
import KanbanView from "./layouts/KanbanView"
import TableView from "./layouts/TableView"
import DynamicView from "./DynamicView"
import ChatModal from "./ChatModal"
import InspectOverlay from "./InspectOverlay"
import type { ChatMessage } from "./ChatPanel"

const API = "http://localhost:8000"

interface Props {
  schema: UISchema
  onSchemaChange: (s: UISchema) => void
}

export default function MalleableRuntime({ schema, onSchemaChange }: Props) {
  const [threads, setThreads] = useState<Thread[]>([])
  const [loading, setLoading] = useState(true)
  const [applying, setApplying] = useState(false)
  const [justApplied, setJustApplied] = useState(false)
  const [renderMode, setRenderMode] = useState<"schema" | "component">("schema")
  const [componentCode, setComponentCode] = useState<string | null>(null)
  const [showCode, setShowCode] = useState(false)
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([])
  const [inspectMode, setInspectMode] = useState(false)
  const [inspectContext, setInspectContext] = useState<string | null>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const isFirstRender = useRef(true)

  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return }
    blurIn()
  }, [schema, componentCode])

  useEffect(() => {
    const endpoint = schema.data_source === "list_actionable" ? "/threads/actionable" : "/threads"
    setLoading(true)
    fetch(`${API}${endpoint}`)
      .then((r) => r.json())
      .then((data) => { setThreads(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [schema.data_source])

  // Reset conversation when persona switches (schema changes from parent)
  useEffect(() => {
    setChatHistory([])
    setComponentCode(null)
    setRenderMode("schema")
    setInspectContext(null)
    setInspectMode(false)
  }, [schema])

  const displayed = applySchema(threads, schema)

  function blurIn() {
    setTimeout(() => {
      contentRef.current?.animate(
        [
          { opacity: 0, filter: "blur(8px)", transform: "scale(1.02)" },
          { opacity: 1, filter: "blur(0px)", transform: "scale(1)" },
        ],
        { duration: 400, easing: "cubic-bezier(0.16, 1, 0.3, 1)", fill: "both" }
      )
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

    try {
      const res = await fetch(`${API}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextHistory.map((m) => ({ role: m.role, content: m.content })),
          current_schema: schema,
          current_code: componentCode,
        }),
      })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()

      const isGenerated = data.action === "schema" || data.action === "component"
      const assistantMessage: ChatMessage = {
        role: "assistant",
        content: data.message,
        generatedComponent: isGenerated,
      }
      setChatHistory([...nextHistory, assistantMessage])

      if (data.action === "schema" && data.schema) {
        onSchemaChange(data.schema)
        setRenderMode("schema")
        setComponentCode(null)
        flash()
      } else if (data.action === "component" && data.code) {
        setComponentCode(data.code)
        setRenderMode("component")
        flash()
      }
    } catch (e) {
      alert(`Error: ${e}`)
    } finally {
      setApplying(false)
    }
  }

  function handleElementClick(context: string) {
    setInspectMode(false)
    setInspectContext(context)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className={`
        px-4 py-2.5 border-b flex items-center gap-2 flex-wrap bg-zinc-50 flex-shrink-0
        transition-all duration-500
        ${justApplied ? "border-violet-400 bg-violet-50" : "border-zinc-200"}
      `}>
        {renderMode === "schema" ? (
          <>
            <LayoutBadge layout={schema.layout} />
            {schema.group_by && <Pill label="group" value={schema.group_by} />}
            {schema.sort_by && <Pill label="sort" value={`${schema.sort_by} ${schema.sort_direction}`} />}
            {schema.data_source === "list_actionable" && <Pill label="filter" value="actionable only" />}
            {schema.filters.map((f, i) => (
              <Pill key={i} label={f.field} value={`${f.op} ${f.value}`} />
            ))}
          </>
        ) : (
          <>
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-violet-100 text-violet-700">custom</span>
            <button
              onClick={() => setInspectMode((v) => !v)}
              title="Click any element to chat about it"
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                inspectMode
                  ? "bg-violet-600 text-white border-violet-600"
                  : "text-zinc-500 border-zinc-200 hover:bg-zinc-100"
              }`}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
              {inspectMode ? "Inspecting…" : "Inspect"}
            </button>
            <button
              onClick={() => setShowCode((v) => !v)}
              className="text-xs text-violet-600 hover:underline"
            >
              {showCode ? "Hide code" : "View code"}
            </button>
            <button
              onClick={() => {
                setChatHistory([])
                setComponentCode(null)
                setRenderMode("schema")
                setInspectContext(null)
                setInspectMode(false)
              }}
              className="text-xs text-zinc-400 hover:text-zinc-600 hover:underline"
            >
              Reset
            </button>
          </>
        )}

        <span className="ml-auto text-xs text-zinc-400">{displayed.length} threads</span>
        <span className={`text-xs font-medium text-violet-600 transition-opacity duration-300 ${justApplied ? "opacity-100" : "opacity-0"}`}>
          Applied
        </span>
      </div>

      {/* Generated code panel */}
      {renderMode === "component" && showCode && componentCode && (
        <div className="border-b border-zinc-200 bg-zinc-950 text-zinc-300 text-xs font-mono p-4 max-h-64 overflow-auto flex-shrink-0">
          <pre className="whitespace-pre-wrap">{componentCode}</pre>
        </div>
      )}

      {/* Content */}
      <div ref={contentRef} className="flex-1 overflow-auto relative min-h-0">
        {loading ? (
          <div className="flex items-center justify-center h-full text-zinc-400 text-sm">Loading…</div>
        ) : renderMode === "component" && componentCode ? (
          <DynamicView code={componentCode} threads={displayed} />
        ) : schema.layout === "kanban" ? (
          <KanbanView threads={displayed} schema={schema} />
        ) : schema.layout === "table" ? (
          <TableView threads={displayed} schema={schema} />
        ) : (
          <ListView threads={displayed} schema={schema} />
        )}

        {renderMode === "component" && (
          <InspectOverlay active={inspectMode} onElementClick={handleElementClick} />
        )}
      </div>

      {/* Floating chat */}
      <ChatModal
        messages={chatHistory}
        applying={applying}
        hasComponent={renderMode === "component"}
        inspectContext={inspectContext}
        onClearInspectContext={() => setInspectContext(null)}
        onSend={handleSend}
      />
    </div>
  )
}

function LayoutBadge({ layout }: { layout: string }) {
  const colors: Record<string, string> = {
    list:     "bg-blue-100 text-blue-700",
    kanban:   "bg-violet-100 text-violet-700",
    table:    "bg-emerald-100 text-emerald-700",
    calendar: "bg-orange-100 text-orange-700",
  }
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${colors[layout] ?? "bg-zinc-100 text-zinc-600"}`}>
      {layout}
    </span>
  )
}

function Pill({ label, value }: { label: string; value: string }) {
  return (
    <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-100 text-xs">
      <span className="text-zinc-400 font-medium">{label}:</span>
      <span className="text-zinc-700 font-mono">{value}</span>
    </span>
  )
}
