"use client"
import { useState, useEffect, useRef, useCallback } from "react"
import type { Item, UISchema } from "@malleable/react"
import { MalleableRuntime } from "@malleable/react"
import { PLAYLISTS, ALL_TRACKS_PLAYLIST, type PlaylistDef } from "@/lib/playlists"
import { formatDuration } from "@/lib/utils"
import PlayerBar from "@/components/PlayerBar"

const PLAYLIST_KEY = "groove:playlist"
const SCHEMAS_KEY  = "groove:schemas"

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

const ALL_PLAYLISTS: PlaylistDef[] = [...PLAYLISTS, ALL_TRACKS_PLAYLIST]

const ACCENT_COLORS: Record<string, string> = {
  violet:  "bg-violet-500",
  blue:    "bg-blue-500",
  orange:  "bg-orange-500",
  emerald: "bg-emerald-500",
  zinc:    "bg-zinc-400",
}

export default function Home() {
  const [activePlaylist, setActivePlaylist] = useState(PLAYLISTS[0].id)
  const [schema, setSchema]   = useState<UISchema>(PLAYLISTS[0].schema)
  const [schemas, setSchemas] = useState<Record<string, UISchema>>({})
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const audioRef    = useRef<HTMLAudioElement | null>(null)
  const [currentTrack, setCurrentTrack] = useState<Item | null>(null)
  const [isPlaying,    setIsPlaying]    = useState(false)
  const [progress,     setProgress]     = useState(0)
  const [currentTime,  setCurrentTime]  = useState(0)
  const [audioDuration, setAudioDuration] = useState(0)

  useEffect(() => {
    const saved      = loadSchemas()
    const lastId     = localStorage.getItem(PLAYLIST_KEY) ?? PLAYLISTS[0].id
    const pl         = ALL_PLAYLISTS.find((p) => p.id === lastId) ?? PLAYLISTS[0]
    const savedSchema = saved[pl.id] ?? pl.schema
    setSchemas(saved)
    setActivePlaylist(pl.id)
    setSchema(savedSchema)
  }, [])

  useEffect(() => {
    const audio = new Audio()
    audioRef.current  = audio

    audio.addEventListener("timeupdate", () => {
      if (audio.duration) {
        setCurrentTime(audio.currentTime)
        setProgress((audio.currentTime / audio.duration) * 100)
      }
    })
    audio.addEventListener("loadedmetadata", () => setAudioDuration(audio.duration))
    audio.addEventListener("ended",  () => setIsPlaying(false))
    audio.addEventListener("play",   () => setIsPlaying(true))
    audio.addEventListener("pause",  () => setIsPlaying(false))

    return () => { audio.pause(); audioRef.current = null }
  }, [])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !currentTrack) return
    audio.src = currentTrack.audio_url as string
    audio.play().catch(() => {})
  }, [currentTrack])

  const handleItemSelect = useCallback((item: Item) => {
    if (currentTrack?.id === item.id) {
      const audio = audioRef.current
      if (!audio) return
      if (isPlaying) audio.pause()
      else audio.play().catch(() => {})
    } else {
      setCurrentTrack(item)
    }
  }, [currentTrack, isPlaying])

  const handlePlayPause = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    if (isPlaying) audio.pause()
    else audio.play().catch(() => {})
  }, [isPlaying])

  const handleSeek = useCallback((pct: number) => {
    const audio = audioRef.current
    if (!audio || !audio.duration) return
    audio.currentTime = (pct / 100) * audio.duration
  }, [])

  function updateSchema(playlistId: string, s: UISchema) {
    const next = { ...schemas, [playlistId]: s }
    setSchemas(next)
    saveSchemas(next)
    localStorage.setItem(PLAYLIST_KEY, playlistId)
  }

  function selectPlaylist(pl: PlaylistDef) {
    const restored = schemas[pl.id] ?? pl.schema
    setActivePlaylist(pl.id)
    setSchema(restored)
    localStorage.setItem(PLAYLIST_KEY, pl.id)
    setSidebarOpen(false)
  }

  const activeDef = ALL_PLAYLISTS.find((p) => p.id === activePlaylist) ?? PLAYLISTS[0]
  const currentTrackId = (currentTrack?.id as string) ?? null

  const SidebarContent = () => (
    <>
      <div className="px-4 py-4 border-b border-zinc-200">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="white">
              <path d="M9 18V5l12-2v13M9 18c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2 2 .9 2 2zm12-2c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2 2 .9 2 2z"/>
            </svg>
          </div>
          <span className="text-sm font-semibold text-zinc-800">Groove</span>
        </div>
      </div>

      <div className="px-3 py-4 flex flex-col gap-1">
        <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide px-2 mb-2">Playlists</p>
        {ALL_PLAYLISTS.map((pl) => (
          <div key={pl.id} className="relative group">
            <button
              onClick={() => selectPlaylist(pl)}
              className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors ${
                activePlaylist === pl.id
                  ? "bg-emerald-50 text-emerald-800"
                  : "text-zinc-600 hover:bg-zinc-100"
              }`}
            >
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${ACCENT_COLORS[pl.color] ?? "bg-zinc-400"}`} />
                <span className="text-sm font-medium truncate">{pl.name}</span>
              </div>
              <div className="text-xs text-zinc-400 mt-0.5 pl-4 truncate">{pl.description}</div>
            </button>
            {schemas[pl.id] && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  const next = { ...schemas }
                  delete next[pl.id]
                  setSchemas(next)
                  saveSchemas(next)
                  if (activePlaylist === pl.id) setSchema(pl.schema)
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
        <p className="text-[10px] text-zinc-400 leading-relaxed">
          Groove · Malleable UI demo. Chat to reshape the track list.
        </p>
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
        <header className="px-4 md:px-6 py-3 border-b border-zinc-200 flex items-center justify-between gap-2 flex-shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="md:hidden flex items-center justify-center w-8 h-8 rounded hover:bg-zinc-100 text-zinc-500 flex-shrink-0"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          </button>
          <h1 className="text-sm font-semibold text-zinc-700 truncate flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${ACCENT_COLORS[activeDef.color] ?? "bg-zinc-400"}`} />
            {activeDef.name}
          </h1>
          <span className="text-xs text-zinc-400 font-mono bg-zinc-100 px-2 py-1 rounded flex-shrink-0 hidden sm:inline">
            {schema.layout} · {activeDef.track_count} tracks
          </span>
        </header>

        <div className="flex-1 overflow-hidden min-h-0">
          <MalleableRuntime
            key={activePlaylist}
            apiUrl="http://localhost:8002"
            storagePrefix="groove"
            schema={schema}
            defaultSchema={activeDef.schema}
            onSchemaChange={(s) => { setSchema(s); updateSchema(activePlaylist, s) }}
            personaId={activePlaylist}
            manifestEnabled={false}
            customDataSources={{ list_tracks: "/tracks" }}
            extraScope={{ formatDuration, currentTrackId }}
            layoutExtraProps={{ currentTrackId }}
            extraUI={
              <PlayerBar
                track={currentTrack}
                isPlaying={isPlaying}
                progress={progress}
                currentTime={currentTime}
                duration={audioDuration}
                onPlayPause={handlePlayPause}
                onSeek={handleSeek}
              />
            }
            onItemSelect={handleItemSelect}
          />
        </div>
      </main>
    </div>
  )
}
