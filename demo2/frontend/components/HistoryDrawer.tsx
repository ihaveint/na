"use client"
import type { Version } from "@/lib/types"

interface Props {
  versions: Version[]
  currentIndex: number
  open: boolean
  onClose: () => void
  onRestore: (index: number) => void
}

function relativeTime(ts: number): string {
  const diff = Date.now() - ts
  if (diff < 60_000) return "just now"
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
}

export default function HistoryDrawer({ versions, currentIndex, open, onClose, onRestore }: Props) {
  if (!open) return null

  const displayed = versions.map((v, i) => ({ ...v, originalIndex: i })).reverse()

  return (
    <>
      <div className="fixed inset-0 z-[9998] bg-black/20" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full bg-white border-l border-zinc-200 shadow-2xl flex flex-col z-[9999]" style={{ width: 300 }}>
        <div className="px-4 py-3 border-b border-zinc-100 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-zinc-500">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
            <span className="text-sm font-semibold text-zinc-700">History</span>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700 w-6 h-6 flex items-center justify-center rounded hover:bg-zinc-100 text-lg leading-none">×</button>
        </div>

        <div className="flex-1 overflow-y-auto min-h-0">
          {displayed.length === 0 ? (
            <p className="text-xs text-zinc-400 text-center py-12 px-4">No history yet. Changes will appear here.</p>
          ) : (
            <div className="relative">
              <div className="absolute left-[27px] top-0 bottom-0 w-px bg-zinc-100" />
              {displayed.map((v) => {
                const isCurrent = v.originalIndex === currentIndex
                const isFuture = v.originalIndex > currentIndex
                return (
                  <div key={v.id} className="flex gap-3 px-4 py-3 group">
                    <div className="flex-shrink-0 mt-1 relative z-10">
                      <div className={`w-3 h-3 rounded-full border-2 transition-colors ${
                        isCurrent ? "bg-violet-500 border-violet-500"
                        : isFuture ? "bg-white border-zinc-300 border-dashed group-hover:border-violet-300"
                        : "bg-white border-zinc-300 group-hover:border-violet-300"
                      }`} />
                    </div>
                    <div className="flex-1 min-w-0 pb-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className={`text-xs leading-snug ${
                          isCurrent ? "text-zinc-800 font-medium"
                          : isFuture ? "text-zinc-400 italic"
                          : "text-zinc-500"
                        }`}>{v.label}</p>
                        {isCurrent && <span className="text-[10px] font-semibold text-violet-600 bg-violet-50 px-1.5 py-0.5 rounded flex-shrink-0">current</span>}
                        {isFuture && (
                          <button onClick={() => onRestore(v.originalIndex)} className="text-[10px] font-medium text-zinc-400 hover:text-violet-600 flex-shrink-0 transition-colors">Jump to ↑</button>
                        )}
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <div className="flex items-center gap-1.5">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                            isFuture ? "bg-zinc-50 text-zinc-400"
                            : v.renderMode === "component" ? "bg-violet-100 text-violet-600"
                            : "bg-zinc-100 text-zinc-500"
                          }`}>{v.renderMode === "component" ? "custom" : v.schema.layout}</span>
                          <span className="text-[10px] text-zinc-400">{relativeTime(v.timestamp)}</span>
                        </div>
                        {!isCurrent && !isFuture && (
                          <button onClick={() => onRestore(v.originalIndex)} className="text-[10px] font-medium opacity-0 group-hover:opacity-100 transition-opacity text-violet-600 hover:text-violet-800">Restore</button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
