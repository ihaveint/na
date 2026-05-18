"use client"
import { useEffect, useRef, useState, type ComponentType } from "react"
import type { Item, UISchema, Version, ChatMessage } from "./types"
import { applySchema } from "./utils"
import { useVersionHistory } from "./useVersionHistory"
import ListView from "./ListView"
import KanbanView from "./KanbanView"
import TableView from "./TableView"
import DynamicView from "./DynamicView"
import ChatModal from "./ChatModal"
import InspectOverlay from "./InspectOverlay"
import HistoryDrawer from "./HistoryDrawer"

interface DetailPanelProps {
  item: Item | null
  onClose: () => void
}

interface MalleableRuntimeProps {
  apiUrl: string
  storagePrefix: string
  schema: UISchema
  defaultSchema: UISchema
  onSchemaChange: (s: UISchema) => void
  personaId: string
  detailPanel?: ComponentType<DetailPanelProps>
  extraScope?: Record<string, unknown>
  extraUI?: React.ReactNode
  manifestEnabled?: boolean
  customDataSources?: Record<string, string>
  chatPlaceholder?: string
  onItemSelect?: (item: Item) => void
  layoutExtraProps?: Record<string, unknown>
}

export default function MalleableRuntime({
  apiUrl,
  storagePrefix,
  schema,
  defaultSchema,
  onSchemaChange,
  personaId,
  detailPanel: DetailPanel,
  extraScope,
  extraUI,
  manifestEnabled,
  customDataSources,
  chatPlaceholder,
  onItemSelect,
  layoutExtraProps,
}: MalleableRuntimeProps) {
  const [items, setItems] = useState<Item[]>([])
  const [manifest, setManifest] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(true)
  const [applying, setApplying] = useState(false)
  const [justApplied, setJustApplied] = useState(false)

  const [store] = useState<Storage>(() => {
    if (typeof window === "undefined") return undefined as unknown as Storage
    return sessionStorage.getItem(`${storagePrefix}:share-mode`) ? sessionStorage : localStorage
  })

  const { versions, currentIndex, push: pushVersion, restore: restoreVersion, clear: clearVersions } = useVersionHistory(`${storagePrefix}:history:${personaId}`, store)
  const savedVersion = versions[currentIndex] ?? null

  const sharedArtifact = useRef((() => {
    if (typeof window === "undefined") return null
    try {
      const raw = sessionStorage.getItem(`${storagePrefix}:share`)
      if (raw) { sessionStorage.removeItem(`${storagePrefix}:share`); return JSON.parse(raw) }
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
      const raw = store.getItem(`${storagePrefix}:chat:${personaId}`)
      return raw ? JSON.parse(raw) : (savedVersion?.chatSnapshot ?? [])
    } catch { return [] }
  })

  const [showCode, setShowCode] = useState(false)
  const [inspectMode, setInspectMode] = useState(false)
  const [inspectContext, setInspectContext] = useState<string | null>(null)
  const [showHistory, setShowHistory] = useState(false)
  const [selectedItem, setSelectedItem] = useState<Item | null>(null)
  const [shareState, setShareState] = useState<"idle" | "loading" | "copied" | "error">("idle")
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [shareCopied, setShareCopied] = useState(false)
  const [mounted, setMounted] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)
  const isFirstRender = useRef(true)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    try { store.setItem(`${storagePrefix}:chat:${personaId}`, JSON.stringify(chatHistory)) } catch {}
  }, [chatHistory, personaId, store])

  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return }
    blurIn()
  }, [schema, componentCode])

  useEffect(() => {
    if (!manifestEnabled) return
    fetch(`${apiUrl}/manifest`)
      .then((r) => r.json())
      .then((m) => setManifest(m))
      .catch(() => {})
  }, [manifestEnabled, apiUrl])

  useEffect(() => {
    // If manifest fetching is enabled but hasn't arrived yet, wait silently.
    if (manifestEnabled && manifest === null) return

    const endpoints = (manifest?.endpoints as Array<Record<string, string>> | undefined) ?? []
    const ep = endpoints.find((e) => e.intent === schema.data_source)
    const path = ep?.path ?? customDataSources?.[schema.data_source]
    if (!path) {
      console.warn(`[MalleableRuntime] No endpoint path found for data_source="${schema.data_source}".`)
      setLoading(false)
      return
    }

    setLoading(true)
    fetch(`${apiUrl}${path}`)
      .then((r) => r.json())
      .then((data) => { setItems(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [schema.data_source, manifest, manifestEnabled, apiUrl, customDataSources])

  const displayed = applySchema(items, schema)

  function blurIn() {
    setTimeout(() => {
      const anim = contentRef.current?.animate(
        [
          { opacity: 0, filter: "blur(8px)", transform: "scale(1.02)" },
          { opacity: 1, filter: "blur(0px)", transform: "scale(1)" },
        ],
        { duration: 400, easing: "cubic-bezier(0.16, 1, 0.3, 1)", fill: "both" }
      )
      if (anim) anim.onfinish = () => anim.cancel()
    }, 0)
  }

  function flash() {
    setJustApplied(true)
    setTimeout(() => setJustApplied(false), 1500)
  }

  function handleItemClick(item: Item) {
    setSelectedItem(item)
    onItemSelect?.(item)
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
      const res = await fetch(`${apiUrl}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: apiMessages,
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
      const newSystemMessage: ChatMessage = { role: "assistant", content: `\u21a9 Restored to: ${v.label}`, isSystem: true }
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
      const res = await fetch(`${apiUrl}/share`, {
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
      <div className={`
        border-b flex items-center bg-zinc-50 flex-shrink-0 min-w-0
        transition-all duration-500
        ${justApplied ? "border-violet-400 bg-violet-50" : "border-zinc-200"}
      `}>
        <div className="flex-1 overflow-x-auto min-w-0">
          <div className="flex items-center gap-2 px-4 py-2.5 w-max min-w-full">
            {renderMode === "schema" ? (
              <>
                <LayoutBadge layout={schema.layout} />
                {schema.group_by && <Pill label="group" value={schema.group_by} />}
                {schema.sort_by && <Pill label="sort" value={`${schema.sort_by} ${schema.sort_direction}`} />}
                {schema.filters.map((f, i) => (
                  <Pill key={i} label={f.field} value={`${f.op} ${f.value}`} />
                ))}
              </>
            ) : (
              <>
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-violet-100 text-violet-700">custom</span>
                <button
                  onClick={() => setShowCode((v) => !v)}
                  className="text-xs text-violet-600 hover:underline whitespace-nowrap"
                >
                  {showCode ? "Hide code" : "View code"}
                </button>
                <button
                  onClick={() => {
                    onSchemaChange(defaultSchema)
                    setComponentCode(null)
                    setRenderMode("schema")
                    setInspectContext(null)
                    setInspectMode(false)
                    const systemMessage: ChatMessage = { role: "assistant", content: "\u21a9 Reset to default view", isSystem: true }
                    setChatHistory((prev) => {
                      const filtered = prev.filter((m) => !(m.isSystem && m.content.startsWith("\u21a9 Reset")))
                      return [...filtered, systemMessage]
                    })
                    pushVersion({ label: "Reset to default view", schema: defaultSchema, componentCode: null, renderMode: "schema", chatSnapshot: chatHistory.filter((m) => !m.isSystem) })
                  }}
                  className="text-xs text-zinc-400 hover:text-zinc-600 hover:underline whitespace-nowrap"
                >
                  Reset
                </button>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 px-2 py-2.5 flex-shrink-0 border-l border-zinc-100">
          <span className={`text-xs font-medium text-violet-600 transition-opacity duration-300 ${justApplied ? "opacity-100" : "opacity-0"}`}>
            Applied
          </span>
          {mounted && <span className="text-xs text-zinc-400 hidden sm:inline">{displayed.length}</span>}

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
            <span className="hidden sm:inline">{inspectMode ? "Inspecting\u2026" : "Inspect"}</span>
          </button>

          <button
            onClick={() => setShowHistory((v) => !v)}
            title="View history"
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
              showHistory
                ? "bg-zinc-800 text-white border-zinc-800"
                : "text-zinc-500 border-zinc-200 hover:bg-zinc-100"
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
              title="Copy shareable link"
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors text-zinc-500 border-zinc-200 hover:bg-zinc-100 disabled:opacity-50"
            >
              {shareState === "copied" ? (
                <>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                  <span className="hidden sm:inline">Link ready \u00d7</span>
                </>
              ) : shareState === "error" ? (
                <span className="text-red-500">!</span>
              ) : (
                <>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/>
                  </svg>
                  <span className="hidden sm:inline">{shareState === "loading" ? "Sharing\u2026" : "Share"}</span>
                </>
              )}
            </button>

            {shareUrl && (
              <div className="absolute right-0 top-full mt-1.5 z-50 bg-white border border-zinc-200 rounded-lg shadow-lg p-2 flex items-center gap-1.5" style={{ minWidth: 260 }}>
                <input
                  readOnly
                  value={shareUrl}
                  onFocus={(e) => e.target.select()}
                  className="flex-1 text-xs text-zinc-700 font-mono bg-zinc-50 border border-zinc-200 rounded px-2 py-1 outline-none min-w-0"
                  autoFocus
                />
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(shareUrl).catch(() => {})
                    setShareCopied(true)
                    setTimeout(() => setShareCopied(false), 2000)
                  }}
                  className="text-xs px-2 py-1 rounded bg-violet-600 text-white hover:bg-violet-700 whitespace-nowrap"
                >
                  {shareCopied ? "Copied!" : "Copy"}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {renderMode === "component" && showCode && componentCode && (
        <div className="border-b border-zinc-200 bg-zinc-950 text-zinc-300 text-xs font-mono p-4 max-h-64 overflow-auto flex-shrink-0">
          <pre className="whitespace-pre-wrap">{componentCode}</pre>
        </div>
      )}

      <div ref={contentRef} className="flex-1 overflow-auto relative min-h-0">
        {loading ? (
          <div className="flex items-center justify-center h-full text-zinc-400 text-sm">Loading\u2026</div>
        ) : renderMode === "component" && componentCode ? (
          <DynamicView code={componentCode} items={displayed} onItemClick={handleItemClick} extraScope={extraScope} {...layoutExtraProps} />
        ) : schema.layout === "kanban" ? (
          <KanbanView items={displayed} schema={schema} onItemClick={handleItemClick} {...layoutExtraProps} />
        ) : schema.layout === "table" ? (
          <TableView items={displayed} schema={schema} onItemClick={handleItemClick} {...layoutExtraProps} />
        ) : (
          <ListView items={displayed} schema={schema} onItemClick={handleItemClick} {...layoutExtraProps} />
        )}

        <InspectOverlay active={inspectMode} onElementClick={handleElementClick} />
      </div>

      {extraUI}

      <HistoryDrawer
        versions={versions}
        currentIndex={currentIndex}
        open={showHistory}
        onClose={() => setShowHistory(false)}
        onRestore={handleRestore}
      />

      {DetailPanel && (
        <DetailPanel
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
        />
      )}

      <ChatModal
        messages={chatHistory}
        applying={applying}
        hasComponent={renderMode === "component"}
        inspectContext={inspectContext}
        onClearInspectContext={() => setInspectContext(null)}
        onSend={handleSend}
        placeholder={chatPlaceholder}
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
