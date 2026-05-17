"use client"
import type { Item, UISchema } from "./types"
import { groupItems, fieldLabel } from "./utils"

interface Props {
  items: Item[]
  schema: UISchema
  onItemClick?: (item: Item) => void
}

const COLORS = [
  "bg-violet-100 text-violet-700 border-violet-200",
  "bg-blue-100 text-blue-700 border-blue-200",
  "bg-emerald-100 text-emerald-700 border-emerald-200",
  "bg-orange-100 text-orange-700 border-orange-200",
  "bg-pink-100 text-pink-700 border-pink-200",
  "bg-cyan-100 text-cyan-700 border-cyan-200",
  "bg-amber-100 text-amber-700 border-amber-200",
  "bg-rose-100 text-rose-700 border-rose-200",
]

export default function KanbanView({ items, schema, onItemClick }: Props) {
  const groups = groupItems(items, schema.group_by)

  return (
    <div className="flex gap-4 p-4 overflow-x-auto h-full" style={{ alignItems: "flex-start" }}>
      {Object.entries(groups).map(([group, groupItems], i) => (
        <div key={group} className="flex flex-col gap-2 flex-shrink-0 w-56">
          <div className="flex items-center justify-between px-1 py-1 border-b border-zinc-200 mb-1">
            <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">{group || "Other"}</span>
            <span className="text-xs text-zinc-400 bg-zinc-100 px-1.5 py-0.5 rounded-full">{groupItems.length}</span>
          </div>
          {groupItems.map((item) => {
            const id = String(item.id ?? item.name ?? item.title ?? Math.random())
            const title = String(item.subject ?? item.title ?? item.name ?? "(untitled)")
            const colorIdx = i % COLORS.length

            return (
              <div
                key={id}
                onClick={() => onItemClick?.(item)}
                className="p-3 bg-white border border-zinc-200 hover:border-zinc-300 transition-colors cursor-pointer shadow-sm"
                style={{ borderRadius: "0.75rem" }}
              >
                <span className="text-sm font-medium text-zinc-800 truncate block">{title}</span>
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {schema.card_fields
                    .filter((f) => !["subject", "title", "name", "id"].includes(f))
                    .map((f) => {
                      const val = item[f]
                      if (val == null || val === false) return null
                      if (typeof val === "string" && (f.includes("date") || f.endsWith("_at"))) {
                        return (
                          <span key={f} className={`text-xs px-1.5 py-0.5 rounded border ${COLORS[colorIdx]}`}>
                            {String(val)}
                          </span>
                        )
                      }
                      return (
                        <span key={f} className="text-xs bg-zinc-100 text-zinc-600 px-1.5 py-0.5 rounded">
                          {String(val)}
                        </span>
                      )
                    })}
                </div>
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}
