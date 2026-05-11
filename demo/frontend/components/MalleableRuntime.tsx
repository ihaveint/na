"use client"
import { useEffect, useRef, useState } from "react"
import type { Thread, UISchema } from "@/lib/types"
import { applySchema } from "@/lib/utils"
import ListView from "./layouts/ListView"
import KanbanView from "./layouts/KanbanView"
import TableView from "./layouts/TableView"

const API = "http://localhost:8000"

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
  const contentRef = useRef<HTMLDivElement>(null)
  const isFirstRender = useRef(true)

  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return }
    contentRef.current?.animate(
      [
        { opacity: 0, filter: "blur(8px)", transform: "scale(1.02)" },
        { opacity: 1, filter: "blur(0px)", transform: "scale(1)" },
      ],
      { duration: 400, easing: "cubic-bezier(0.16, 1, 0.3, 1)", fill: "both" }
    )
  }, [schema])

  useEffect(() => {
    const endpoint = schema.data_source === "list_actionable" ? "/threads/actionable" : "/threads"
    setLoading(true)
    fetch(`${API}${endpoint}`)
      .then((r) => r.json())
      .then((data) => { setThreads(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [schema.data_source])

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

  async function handleGenerate() {
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

  return (
    <div className="flex flex-col h-full">
      {/* schema bar — flashes a violet ring when AI applies a change */}
      <div className={`
        px-4 py-2.5 border-b flex items-center gap-2 flex-wrap bg-zinc-50
        transition-all duration-500
        ${justApplied ? "border-violet-400 bg-violet-50" : "border-zinc-200"}
      `}>
        <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mr-1">Schema</span>
        <LayoutBadge layout={schema.layout} />
        {schema.group_by && <Pill label="group" value={schema.group_by} />}
        {schema.sort_by && <Pill label="sort" value={`${schema.sort_by} ${schema.sort_direction}`} />}
        {schema.data_source === "list_actionable" && <Pill label="filter" value="actionable only" />}
        {schema.filters.map((f, i) => (
          <Pill key={i} label={f.field} value={`${f.op} ${f.value}`} />
        ))}
        <span className="ml-auto text-xs text-zinc-400">{displayed.length} threads</span>
        <span className={`text-xs font-medium text-violet-600 transition-opacity duration-300 ${justApplied ? "opacity-100" : "opacity-0"}`}>
          ✓ Applied
        </span>
      </div>

      {/* content — fades out then in on schema change */}
      <div ref={contentRef} className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full text-zinc-400 text-sm">Loading…</div>
        ) : schema.layout === "kanban" ? (
          <KanbanView threads={displayed} schema={schema} />
        ) : schema.layout === "table" ? (
          <TableView threads={displayed} schema={schema} />
        ) : (
          <ListView threads={displayed} schema={schema} />
        )}
      </div>

      {/* AI prompt bar */}
      <div className="border-t border-zinc-200 px-4 py-3 bg-white">
        <div className="flex gap-2">
          <input
            className="flex-1 text-sm text-zinc-900 border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-400 placeholder:text-zinc-400"
            placeholder='Try "show as kanban grouped by project" or "sort by urgency"…'
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleGenerate()}
          />
          <button
            onClick={handleGenerate}
            disabled={applying || !prompt.trim()}
            className="px-4 py-2 bg-violet-600 text-white text-sm font-medium rounded-lg hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors min-w-[80px]"
          >
            {applying ? "Applying…" : "Apply"}
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
