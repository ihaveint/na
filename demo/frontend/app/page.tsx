"use client"
import { useState, useEffect } from "react"
import type { UISchema } from "@/lib/types"
import { PERSONAS } from "@/lib/personas"
import MalleableRuntime from "@/components/MalleableRuntime"

const PERSONA_KEY = "malleable:persona"
const SCHEMAS_KEY  = "malleable:schemas" // per-persona map

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

  useEffect(() => {
    const saved = loadSchemas()
    const lastPersona = localStorage.getItem(PERSONA_KEY) ?? PERSONAS[0].id
    const persona = PERSONAS.find((p) => p.id === lastPersona) ? lastPersona : PERSONAS[0].id
    const activeSchema = saved[persona] ?? PERSONAS.find((p) => p.id === persona)!.schema
    setSchemas(saved)

    // Load a shared artifact if ?share= is in the URL
    const shareId = new URLSearchParams(window.location.search).get("share")
    if (shareId) {
      fetch(`http://localhost:8000/share/${shareId}`)
        .then((r) => r.ok ? r.json() : null)
        .then((artifact) => {
          if (!artifact) return
          const targetPersona = PERSONAS.find((p) => p.id === artifact.personaId)?.id ?? persona
          // Mark this tab as a share session — MalleableRuntime will use
          // sessionStorage instead of localStorage, keeping it fully isolated
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
    // restore saved schema for this persona, falling back to its default
    const restored = schemas[id] ?? p.schema
    setActivePersona(id)
    setSchema(restored)
    localStorage.setItem(PERSONA_KEY, id)
  }

  return (
    <div className="flex h-screen bg-white font-sans">
      {/* sidebar */}
      <aside className="w-56 flex-shrink-0 border-r border-zinc-200 flex flex-col bg-zinc-50">
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
                onClick={() => selectPersona(p.id)}
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

        <div className="mt-auto" />
      </aside>

      {/* main */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="px-6 py-3 border-b border-zinc-200 flex items-center justify-between">
          <h1 className="text-sm font-semibold text-zinc-700">
            {PERSONAS.find((p) => p.id === activePersona)?.label}&apos;s inbox
          </h1>
          <span className="text-xs text-zinc-400 font-mono bg-zinc-100 px-2 py-1 rounded">
            {schema.layout} · {schema.data_source}
          </span>
        </header>

        <div className="flex-1 overflow-hidden min-h-0">
          <MalleableRuntime
            key={activePersona}
            schema={schema}
            onSchemaChange={(s) => { setSchema(s); updateSchema(activePersona, s) }}
            personaId={activePersona}
          />
        </div>
      </main>
    </div>
  )
}
