"use client"
import type { Thread } from "@/lib/types"

interface Props {
  thread: Thread | null
  onClose: () => void
}

function initials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()
}

function formatTimestamp(iso: string) {
  const d = new Date(iso)
  return d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
}

export default function ThreadDetailPanel({ thread, onClose }: Props) {
  if (!thread) return null

  return (
    <>
      <div className="fixed inset-0 z-[9998] bg-black/20" onClick={onClose} />

      <div className="fixed inset-0 md:inset-auto md:right-0 md:top-0 md:h-full md:w-[480px] bg-white border-l border-zinc-200 shadow-2xl flex flex-col z-[9999]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-zinc-100 flex-shrink-0">
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-sm font-semibold text-zinc-900 leading-snug">{thread.subject}</h2>
            <button
              onClick={onClose}
              className="text-zinc-400 hover:text-zinc-700 w-6 h-6 flex items-center justify-center rounded hover:bg-zinc-100 text-lg leading-none flex-shrink-0"
            >
              ×
            </button>
          </div>

          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {thread.project && (
              <span className="text-xs bg-zinc-100 text-zinc-600 px-1.5 py-0.5 rounded">{thread.project}</span>
            )}
            {thread.tags.slice(0, 3).map((tag) => (
              <span key={tag} className="text-xs bg-violet-50 text-violet-600 px-1.5 py-0.5 rounded">{tag}</span>
            ))}
            <span className="text-xs text-zinc-400 ml-auto">{thread.messages.length} message{thread.messages.length !== 1 ? "s" : ""}</span>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto min-h-0 px-4 py-4 flex flex-col gap-4">
          {thread.messages.map((msg) => (
            <div key={msg.id} className={`flex gap-3 ${msg.is_self ? "flex-row-reverse" : "flex-row"}`}>
              {/* Avatar */}
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5 ${
                  msg.is_self ? "bg-violet-600 text-white" : "bg-zinc-200 text-zinc-600"
                }`}
              >
                {initials(msg.sender_name)}
              </div>

              {/* Bubble */}
              <div className={`max-w-[78%] flex flex-col gap-1 ${msg.is_self ? "items-end" : "items-start"}`}>
                <div className="flex items-baseline gap-2">
                  <span className="text-xs font-medium text-zinc-700">{msg.is_self ? "You" : msg.sender_name}</span>
                  <span className="text-[10px] text-zinc-400">{formatTimestamp(msg.date)}</span>
                </div>
                <div
                  className={`px-3.5 py-2.5 text-sm leading-relaxed rounded-2xl ${
                    msg.is_self
                      ? "bg-violet-600 text-white rounded-tr-sm"
                      : "bg-zinc-50 text-zinc-800 border border-zinc-100 rounded-tl-sm"
                  }`}
                >
                  {msg.body}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
