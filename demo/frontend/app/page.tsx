"use client"
import { useState, useEffect } from "react"
import type { UISchema } from "@malleable/react"
import { MalleableRuntime } from "@malleable/react"
import { PERSONAS } from "@/lib/personas"
import ItemDetailPanel from "@/components/ItemDetailPanel"

const PERSONA_KEY = "malleable:persona"
const SCHEMAS_KEY  = "malleable:schemas"

function loadSchemas(): Record<string, UISchema> {
  try {
    const raw = localStorage.getItem(SCHEMAS_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return {}
}

function saveSchemas(schemas: Record<string, UISchema>) {
  localStorage.setItem(SCHEMAS_KEY, JSON.stringify(schemas))
}

export default function Home() {
  const [activePersona, setActivePersona] = useState(PERSONAS[0].id)
  const [schema, setSchema] = useState<UISchema>(PERSONAS[0].schema)
  const [schemas, setSchemas] = useState<Record<string, UISchema>>({})
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    const saved = loadSchemas()
    const lastPersona = localStorage.getItem(PERSONA_KEY) ?? PERSONAS[0].id
    const persona = PERSONAS.find((p) => p.id === lastPersona) ? lastPersona : PERSONAS[0].id
    const activeSchema = saved[persona] ?? PERSONAS.find((p) => p.id === persona)!.schema
    setSchemas(saved)

    const shareId = new URLSearchParams(window.location.search).get("share")
    if (shareId) {
      fetch("http://localhost:8000/share/" + shareId)
        .then((r) => r.ok ? r.json() : null)
        .then((artifact) => {
          if (!artifact) return
          const targetPersona = PERSONAS.find((p) => p.id === artifact.personaId)?.id ?? persona
          sessionStorage.setItem("na:share-mode", "1")
          if (artifact.componentCode) {
            sessionStorage.setItem("na:share", JSON.stringify({
              componentCode: artifact.componentCode,
              renderMode: artifact.renderMode,
            }))
          }
          setActivePersona(targetPersona)
          setSchema(artifact.schema)
          window.history.replaceState({}, "", window.location.pathname)
        })
        .catch(() => {
          setActivePersona(persona)
          setSchema(activeSchema)
        })
    } else {
      setActivePersona(persona)
      setSchema(activeSchema)
    }
  }, [])

  function updateSchema(persona: string, s: UISchema) {
    const next = { ...schemas, [persona]: s }
    setSchemas(next)
    saveSchemas(next)
    localStorage.setItem(PERSONA_KEY, persona)
  }

  function selectPersona(id: string) {
    const p = PERSONAS.find((p) => p.id === id)
    if (!p) return
    const restored = schemas[id] ?? p.schema
    setActivePersona(id)
    setSchema(restored)
    localStorage.setItem(PERSONA_KEY, id)
  }

  const SidebarContent = () => (
    <>
      <div className="px-4 py-4 border-b border-zinc-200">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-violet-600 flex items-center justify-center">
            <span className="text-white text-xs font-bold">M</span>
          </div>
          <span className="text-sm font-semibold text-zinc-800">N/A</span>
        </div>
      </div>

      <div className="px-3 py-4 flex flex-col gap-1">
        <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide px-2 mb-2">Personas</p>
        {PERSONAS.map((p) => (
          <div key={p.id} className="relative group">
            <button
              onClick={() => { selectPersona(p.id); setSidebarOpen(false) }}
              className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors ${
                activePersona === p.id
                  ? "bg-violet-100 text-violet-800"
                  : "text-zinc-600 hover:bg-zinc-100"
              }`}
            >
              <div className="text-sm font-medium">{p.label}</div>
              <div className="text-xs text-zinc-500 leading-tight mt-0.5">{p.description}</div>
            </button>
            {schemas[p.id] && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  const next = { ...schemas }
                  delete next[p.id]
                  setSchemas(next)
                  saveSchemas(next)
                  if (activePersona === p.id) setSchema(p.schema)
                }}
                title="Restore default"
                className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity text-zinc-400 hover:text-zinc-600 text-xs px-1.5 py-0.5 rounded hover:bg-zinc-200"
              >
                ↺
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="mt-auto px-4 py-4 border-t border-zinc-100">
        <a
          href="https://na-landing.netlify.app"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-zinc-400 hover:text-zinc-600 transition-colors"
        >
          About this project ↗
        </a>
      </div>
    </>
  )

  return (
    <div className="flex h-screen bg-white font-sans">
      <aside className="hidden md:flex w-56 flex-shrink-0 border-r border-zinc-200 flex-col bg-zinc-50">
        <SidebarContent />
      </aside>

      {sidebarOpen && (
        <>
          <div className="fixed inset-0 z-[9998] bg-black/30 md:hidden" onClick={() => setSidebarOpen(false)} />
          <aside className="fixed left-0 top-0 h-full w-64 bg-zinc-50 border-r border-zinc-200 flex flex-col z-[9999] md:hidden">
            <SidebarContent />
          </aside>
        </>
      )}

      <main className="flex-1 flex flex-col overflow-hidden min-w-0">
        <header className="px-4 md:px-6 py-3 border-b border-zinc-200 flex items-center justify-between gap-2">
          <button
            onClick={() => setSidebarOpen(true)}
            className="md:hidden flex items-center justify-center w-8 h-8 rounded hover:bg-zinc-100 text-zinc-500 flex-shrink-0"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          </button>
          <h1 className="text-sm font-semibold text-zinc-700 truncate">
            {PERSONAS.find((p) => p.id === activePersona)?.label}&apos;s inbox
          </h1>
          <span className="text-xs text-zinc-400 font-mono bg-zinc-100 px-2 py-1 rounded flex-shrink-0 hidden sm:inline">
            {schema.layout} · {schema.data_source}
          </span>
        </header>

        <div className="flex-1 overflow-hidden min-h-0">
          <MalleableRuntime
            key={activePersona}
            apiUrl="http://localhost:8000"
            storagePrefix="na"
            schema={schema}
            defaultSchema={PERSONAS.find((p) => p.id === activePersona)!.schema}
            onSchemaChange={(s) => { setSchema(s); updateSchema(activePersona, s) }}
            personaId={activePersona}
            manifestEnabled={true}
            detailPanel={ItemDetailPanel}
          />
        </div>
      </main>
    </div>
  )
}
