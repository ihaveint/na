"use client"
import type { Item } from "@/lib/types"
import { formatDate, fieldLabel } from "@/lib/utils"

interface Message {
  id: string
  sender: string
  sender_name: string
  date: string
  body: string
  is_self: boolean
}

interface Props {
  item: Item | null
  onClose: () => void
}

function initials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
}

export default function ItemDetailPanel({ item, onClose }: Props) {
  if (!item) return null

  const title = String(item.subject ?? item.title ?? item.name ?? "(untitled)")
  const messages = Array.isArray(item.messages) ? (item.messages as Message[]) : null
  const tags = Array.isArray(item.tags) ? (item.tags as string[]) : []
  // Fields to show in the generic grid: skip well-known structural/display fields
  const skipFields = new Set(["id", "subject", "title", "name", "messages", "preview", "body", "is_read", "is_snoozed", "tags"])
  const metaEntries = Object.entries(item).filter(([k]) => !skipFields.has(k))

  return (
    <>
      <div className="fixed inset-0 z-[9998] bg-black/20" onClick={onClose} />

      <div className="fixed inset-0 md:inset-auto md:right-0 md:top-0 md:h-full md:w-[480px] bg-white border-l border-zinc-200 shadow-2xl flex flex-col z-[9999]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-zinc-100 flex-shrink-0">
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-sm font-semibold text-zinc-900 leading-snug">{title}</h2>
            <button
              onClick={onClose}
              className="text-zinc-400 hover:text-zinc-700 w-6 h-6 flex items-center justify-center rounded hover:bg-zinc-100 text-lg leading-none flex-shrink-0"
            >
              ×
            </button>
          </div>

          {/* Tags / chips */}
          {tags.length > 0 && (
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {tags.slice(0, 4).map((tag) => (
                <span key={tag} className="text-xs bg-violet-50 text-violet-600 px-1.5 py-0.5 rounded">
                  {tag}
                </span>
              ))}
              {messages && (
                <span className="text-xs text-zinc-400 ml-auto">
                  {messages.length} message{messages.length !== 1 ? "s" : ""}
                </span>
              )}
            </div>
          )}
        </div>

        {messages ? (
          /* ── Email-style conversation thread ── */
          <div className="flex-1 overflow-y-auto min-h-0 px-4 py-4 flex flex-col gap-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-3 ${msg.is_self ? "flex-row-reverse" : "flex-row"}`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold ${
                    msg.is_self ? "bg-violet-600 text-white" : "bg-zinc-200 text-zinc-600"
                  }`}
                >
                  {initials(msg.sender_name)}
                </div>
                <div className={`flex flex-col gap-1 max-w-[75%] ${msg.is_self ? "items-end" : "items-start"}`}>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-zinc-700">{msg.sender_name}</span>
                    <span className="text-xs text-zinc-400">{formatDate(msg.date)}</span>
                  </div>
                  <div
                    className={`px-3 py-2 text-sm leading-relaxed ${
                      msg.is_self
                        ? "bg-violet-600 text-white"
                        : "bg-zinc-100 text-zinc-800"
                    }`}
                    style={{ borderRadius: "0.75rem" }}
                  >
                    {msg.body}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* ── Generic field grid ── */
          <div className="flex-1 overflow-y-auto min-h-0 px-5 py-4">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
              {metaEntries.map(([key, value]) => (
                <div key={key} className="col-span-1">
                  <dt className="text-xs font-medium text-zinc-400 uppercase tracking-wide">
                    {fieldLabel(key)}
                  </dt>
                  <dd className="mt-0.5 text-sm text-zinc-900 break-words">
                    {Array.isArray(value)
                      ? (value as string[]).join(", ") || "—"
                      : typeof value === "boolean"
                      ? value ? "Yes" : "No"
                      : String(value ?? "—")}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        )}
      </div>
    </>
  )
}
