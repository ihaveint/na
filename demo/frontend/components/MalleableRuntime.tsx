"use client"
import { useEffect, useRef, useState } from "react"
import type { Thread, UISchema } from "@/lib/types"
import { applySchema } from "@/lib/utils"
import ListView from "./layouts/ListView"
import KanbanView from "./layouts/KanbanView"
import TableView from "./layouts/TableView"
import DynamicView from "./DynamicView"
import ChatPanel, { type ChatMessage } from "./ChatPanel"

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
  const contentRef = useRef<HTMLDivElement>(null)
  const isFirstRender = useRef(true)
  const inputRef = useRef<HTMLInputElement>(null)

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

  // Reset conversation when switching personas (schema changes from outside)
  useEffect(() => {
    setChatHistory([])
    setComponentCode(null)
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
      setJustApplied(true)
      setTimeout(() => setJustApplied(false), 1500)
    } catch (e) {
      alert(`Error: ${e}`)
    } finally {
      setApplying(false)
    }
  }

  async function handleComponentGenerate() {
    if (!prompt.trim()) return

    const userMessage: ChatMessage = { role: "user", content: prompt }
    const nextHistory = [...chatHistory, userMessage]
    setChatHistory(nextHistory)
    setPrompt("")
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
        setJustApplied(true)
        setTimeout(() => setJustApplied(false), 1500)
      }
    } catch (e) {
      alert(`Error: ${e}`)
    } finally {
      setApplying(false)
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }

  function handleGenerate() {
    if (mode === "schema") handleSchemaGenerate()
    else handleComponentGenerate()
  }

  function resetCodeMode() {
    setChatHistory([])
    setComponentCode(null)
  }

  return (
    <div className="flex flex-col h-full">
      {/* top bar */}
      <div className={`
        px-4 py-2.5 border-b flex items-center gap-2 flex-wrap bg-zinc-50
        transition-all duration-500
        ${justApplied ? "border-violet-400 bg-violet-50" : "border-zinc-200"}
      `}>
        <div className="flex items-center rounded-lg border border-zinc-200 overflow-hidden text-xs font-semibold">
          <button
            onClick={() => setMode("schema")}
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
            {componentCode ? (
              <>
                <button
                  onClick={() => setShowCode((v) => !v)}
                  className="text-xs text-violet-600 hover:underline"
                >
                  {showCode ? "Hide code" : "View code"}
                </button>
                <button
                  onClick={resetCodeMode}
                  className="text-xs text-zinc-400 hover:text-zinc-600 hover:underline"
                >
                  Reset
                </button>
              </>
            ) : (
              <span className="text-xs text-zinc-400">Describe a layout to get started</span>
            )}
          </>
        )}

        <span className="ml-auto text-xs text-zinc-400">{displayed.length} threads</span>
        <span className={`text-xs font-medium text-violet-600 transition-opacity duration-300 ${justApplied ? "opacity-100" : "opacity-0"}`}>
          Applied
        </span>
      </div>

      {/* code panel */}
      {mode === "code" && showCode && componentCode && (
        <div className="border-b border-zinc-200 bg-zinc-950 text-zinc-300 text-xs font-mono p-4 max-h-64 overflow-auto">
          <pre className="whitespace-pre-wrap">{componentCode}</pre>
        </div>
      )}

      {/* chat history (code mode only) */}
      {mode === "code" && <ChatPanel messages={chatHistory} />}

      {/* content */}
      <div ref={contentRef} className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full text-zinc-400 text-sm">Loading…</div>
        ) : mode === "code" ? (
          componentCode ? (
            <DynamicView code={componentCode} threads={displayed} />
          ) : (
            <div className="flex items-center justify-center h-full text-center px-8">
              <div>
                <p className="text-zinc-500 text-sm font-medium mb-1">No component yet</p>
                <p className="text-zinc-400 text-xs">Describe what you want below — the agent will ask follow-up questions if it needs more detail.</p>
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
      </div>

      {/* prompt bar */}
      <div className="border-t border-zinc-200 px-4 py-3 bg-white">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            className="flex-1 text-sm text-zinc-900 border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-400 placeholder:text-zinc-400"
            placeholder={
              mode === "schema"
                ? 'Try "show as kanban grouped by project" or "sort by urgency"…'
                : chatHistory.length === 0
                ? 'Describe a layout — e.g. "heatmap", "timeline", "split pane with preview"…'
                : "Reply to continue the conversation…"
            }
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !applying && handleGenerate()}
          />
          <button
            onClick={handleGenerate}
            disabled={applying || !prompt.trim()}
            className="px-4 py-2 bg-violet-600 text-white text-sm font-medium rounded-lg hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors min-w-[80px]"
          >
            {applying ? "Thinking…" : "Send"}
          </button>
        </div>
      </div>
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
