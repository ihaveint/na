"use client"
import type { Item, UISchema } from "@/lib/types"
import { cn, formatDate, fieldLabel } from "@/lib/utils"

interface Props {
  items: Item[]
  schema: UISchema
  onItemClick?: (item: Item) => void
}

export default function ListView({ items, schema, onItemClick }: Props) {
  const titleFields = new Set(["subject", "title", "name", "id"])
  const metaFields = schema.card_fields.filter((f) => !titleFields.has(f))

  return (
    <div className="flex flex-col divide-y divide-zinc-100">
      {items.map((item) => {
        const id = String(item.id ?? item.subject ?? item.name ?? Math.random())
        const title = String(item.subject ?? item.title ?? item.name ?? "(untitled)")
        const isUnread = item.is_read === false
        const dateVal = item.date as string | null | undefined

        return (
          <div
            key={id}
            onClick={() => onItemClick?.(item)}
            className={cn(
              "flex gap-4 px-4 py-3 hover:bg-zinc-50 transition-colors",
              onItemClick && "cursor-pointer",
              isUnread && "bg-blue-50/40"
            )}
          >
            <div className="mt-1 flex-shrink-0">
              <div className={cn("w-2 h-2 rounded-full mt-1.5", isUnread ? "bg-blue-500" : "bg-transparent")} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline justify-between gap-2">
                <span className={cn("text-sm truncate", isUnread ? "font-semibold text-zinc-900" : "text-zinc-700")}>
                  {title}
                </span>
                {dateVal && (
                  <span className="text-xs text-zinc-400 flex-shrink-0">{formatDate(dateVal)}</span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                {metaFields.map((field) => {
                  const val = item[field]
                  if (val == null || val === false) return null
                  if (Array.isArray(val)) {
                    return (val as string[]).slice(0, 3).map((v) => (
                      <span key={v} className="text-xs bg-violet-50 text-violet-600 px-1.5 py-0.5 rounded">{v}</span>
                    ))
                  }
                  if (typeof field === "string" && (field.includes("date") || field.endsWith("_at"))) {
                    return <span key={field} className="text-xs text-zinc-400">{formatDate(String(val))}</span>
                  }
                  return (
                    <span key={field} className="text-xs bg-zinc-100 text-zinc-600 px-1.5 py-0.5 rounded">
                      {String(val)}
                    </span>
                  )
                })}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
