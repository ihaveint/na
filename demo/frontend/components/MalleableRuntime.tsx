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

type Mode = "schema" | "code"

interface Props {
  schema: UISchema
  onSchemaChange: (s: UISchema) => void
}

export default function MalleableRuntime({ schema, onSchemaChange }: Props) {
  const [threads, setThreads] = useState<Thread[]>([])
  const [loading, setLoading] = useState(true)
  const [prompt, setPrompt] = useState("")
  const [applying, setApplying] = useState(false)
  const [justApplied, setJustApplied] = useState(false)
  const [mode, setMode] = useState<Mode>("schema")
  const [componentCode, setComponentCode] = useState<string | null>(null)
  const [showCode, setShowCode] = useState(false)
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([])
  const [inspectMode, setInspectMode] = useState(false)
  const [inspectContext, setInspectContext] = useState<string | null>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const isFirstRender = useRef(true)

  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return }
    if (mode === "schema") blurIn()
  }, [schema, mode])

  useEffect(() => {
    const endpoint = schema.data_source === "list_actionable" ? "/threads/actionable" : "/threads"
    setLoading(true)
    fetch(`${API}${endpoint}`)
      .then((r) => r.json())
      .then((data) => { setThreads(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [schema.data_source])

  useEffect(() => {
    setChatHistory([])
    setComponentCode(null)
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

  async function handleSchemaGenerate() {
    if (!prompt.trim()) return
    setApplying(true)
    try {
      const res = await fetch(`${API}/generate-schema`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_message: prompt, current_schema: schema }),
      })
      if (!res.ok) throw new Error(await res.text())
      const newSchema: UISchema = await res.json()
      onSchemaChange(newSchema)
      blurIn()
      setPrompt("")
      flash()
    } catch (e) {
      alert(`Error: ${e}`)
    } finally {
      setApplying(false)
    }
  }

  async function handleComponentSend(message: string) {
    const userMessage: ChatMessage = { role: "user", content: message }
    const nextHistory = [...chatHistory, userMessage]
    setChatHistory(nextHistory)
    setApplying(true)

    try {
      const res = await fetch(`${API}/generate-component`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextHistory.map((m) => ({ role: m.role, content: m.content })),
          current_code: componentCode,
        }),
      })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()

      const assistantMessage: ChatMessage = {
        role: "assistant",
        content: data.message,
        generatedComponent: data.action === "component",
      }
      setChatHistory([...nextHistory, assistantMessage])

      if (data.action === "component" && data.code) {
        setComponentCode(data.code)
        blurIn()
        flash()
      }
    } catch (e) {
      alert(`Error: ${e}`)
    } finally {
      setApplying(false)
    }
  }

  function flash() {
    setJustApplied(true)
    setTimeout(() => setJustApplied(false), 1500)
  }

  function handleElementClick(context: string) {
    setInspectMode(false)
    setInspectContext(context)
  }

  return (
    <div className="flex flex-col h-full relative">
      {/* Top bar */}
      <div className={`
        px-4 py-2.5 border-b flex items-center gap-2 flex-wrap bg-zinc-50 flex-shrink-0
        transition-all duration-500
        ${justApplied ? "border-violet-400 bg-violet-50" : "border-zinc-200"}
      `}>
        {/* Mode toggle */}
        <div className="flex items-center rounded-lg border border-zinc-200 overflow-hidden text-xs font-semibold">
          <button
            onClick={() => { setMode("schema"); setInspectMode(false) }}
            className={`px-3 py-1.5 transition-colors ${mode === "schema" ? "bg-violet-600 text-white" : "text-zinc-500 hover:bg-zinc-100"}`}
          >
            Schema
          </button>
          <button
            onClick={() => setMode("code")}
            className={`px-3 py-1.5 transition-colors ${mode === "code" ? "bg-violet-600 text-white" : "text-zinc-500 hover:bg-zinc-100"}`}
          >
            Code
          </button>
        </div>

        {mode === "schema" ? (
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
            {componentCode && (
              <>
                {/* Inspect toggle */}
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
                  onClick={() => { setChatHistory([]); setComponentCode(null); setInspectContext(null); setInspectMode(false) }}
                  className="text-xs text-zinc-400 hover:text-zinc-600 hover:underline"
                >
                  Reset
                </button>
              </>
            )}
          </>
        )}

        <span className="ml-auto text-xs text-zinc-400">{displayed.length} threads</span>
        <span className={`text-xs font-medium text-violet-600 transition-opacity duration-300 ${justApplied ? "opacity-100" : "opacity-0"}`}>
          Applied
        </span>
      </div>

      {/* Generated code panel */}
      {mode === "code" && showCode && componentCode && (
        <div className="border-b border-zinc-200 bg-zinc-950 text-zinc-300 text-xs font-mono p-4 max-h-64 overflow-auto flex-shrink-0">
          <pre className="whitespace-pre-wrap">{componentCode}</pre>
        </div>
      )}

      {/* Content area */}
      <div ref={contentRef} className="flex-1 overflow-auto relative min-h-0">
        {loading ? (
          <div className="flex items-center justify-center h-full text-zinc-400 text-sm">Loading…</div>
        ) : mode === "code" ? (
          componentCode ? (
            <DynamicView code={componentCode} threads={displayed} />
          ) : (
            <div className="flex items-center justify-center h-full text-center px-8">
              <div>
                <div className="w-10 h-10 rounded-full bg-violet-100 flex items-center justify-center mx-auto mb-3">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                  </svg>
                </div>
                <p className="text-zinc-600 text-sm font-medium mb-1">Chat with the agent</p>
                <p className="text-zinc-400 text-xs">Tap the button below to describe a layout. The agent will ask follow-up questions if it needs more detail.</p>
              </div>
            </div>
          )
        ) : schema.layout === "kanban" ? (
          <KanbanView threads={displayed} schema={schema} />
        ) : schema.layout === "table" ? (
          <TableView threads={displayed} schema={schema} />
        ) : (
          <ListView threads={displayed} schema={schema} />
        )}

        {/* Inspect overlay — sits over content area */}
        {mode === "code" && (
          <InspectOverlay active={inspectMode} onElementClick={handleElementClick} />
        )}
      </div>

      {/* Schema mode prompt bar */}
      {mode === "schema" && (
        <div className="border-t border-zinc-200 px-4 py-3 bg-white flex-shrink-0">
          <div className="flex gap-2">
            <input
              className="flex-1 text-sm text-zinc-900 border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-400 placeholder:text-zinc-400"
              placeholder='Try "show as kanban grouped by project" or "sort by urgency"…'
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !applying && handleSchemaGenerate()}
            />
            <button
              onClick={handleSchemaGenerate}
              disabled={applying || !prompt.trim()}
              className="px-4 py-2 bg-violet-600 text-white text-sm font-medium rounded-lg hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors min-w-[80px]"
            >
              {applying ? "Applying…" : "Apply"}
            </button>
          </div>
        </div>
      )}

      {/* Floating chat button + modal (Code mode only) */}
      {mode === "code" && (
        <ChatModal
          messages={chatHistory}
          applying={applying}
          hasComponent={!!componentCode}
          inspectContext={inspectContext}
          onClearInspectContext={() => setInspectContext(null)}
          onSend={handleComponentSend}
        />
      )}
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
