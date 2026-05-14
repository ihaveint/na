"use client"
import type { Item, UISchema } from "@/lib/types"
import { cn, groupItems, formatDate } from "@/lib/utils"

interface Props {
  items: Item[]
  schema: UISchema
  onItemClick?: (item: Item) => void
}

const COLUMN_COLORS = [
  "border-t-blue-400",
  "border-t-violet-400",
  "border-t-emerald-400",
  "border-t-orange-400",
  "border-t-pink-400",
  "border-t-cyan-400",
]

function columnColor(index: number) {
  return COLUMN_COLORS[index % COLUMN_COLORS.length]
}

function KanbanCard({
  item,
  schema,
  onItemClick,
}: {
  item: Item
  schema: UISchema
  onItemClick?: (item: Item) => void
}) {
  const title = String(item.subject ?? item.title ?? item.name ?? "(untitled)")
  const isUnread = item.is_read === false
  const titleFields = new Set(["subject", "title", "name", "id"])
  const metaFields = schema.card_fields.filter((f) => !titleFields.has(f))

  return (
    <div
      onClick={() => onItemClick?.(item)}
      className={cn(
        "bg-white border border-zinc-100 rounded-md p-3 shadow-sm hover:shadow-md transition-shadow cursor-pointer",
        isUnread && "border-l-2 border-l-blue-400"
      )}
    >
      <p className={cn("text-sm leading-snug", isUnread ? "font-semibold text-zinc-900" : "text-zinc-700")}>
        {title}
      </p>
      <div className="mt-2 flex flex-wrap gap-1">
        {metaFields.map((field) => {
          const val = item[field]
          if (val == null || val === false) return null
          if (Array.isArray(val)) {
            return (val as string[]).slice(0, 2).map((v) => (
              <span key={v} className="text-xs bg-violet-50 text-violet-600 px-1.5 py-0.5 rounded">{v}</span>
            ))
          }
          if (field.includes("date") || field.endsWith("_at")) {
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
  )
}

export default function KanbanView({ items, schema, onItemClick }: Props) {
  const groups = groupItems(items, schema.group_by)
  const columns = Object.entries(groups)

  return (
    <>
      {/* Desktop: horizontal columns */}
      <div className="hidden md:flex gap-4 p-4 overflow-x-auto h-full">
        {columns.map(([group, colItems], colIdx) => (
          <div key={group} className="flex-shrink-0 w-72">
            <div className={cn("bg-white rounded-lg border border-zinc-200 border-t-4 flex flex-col", columnColor(colIdx))}>
              <div className="px-3 py-2 border-b border-zinc-100 flex items-center justify-between">
                <span className="text-sm font-semibold text-zinc-700">{group || "Ungrouped"}</span>
                <span className="text-xs text-zinc-400 bg-zinc-100 px-1.5 py-0.5 rounded-full">{colItems.length}</span>
              </div>
              <div className="flex flex-col gap-2 p-2 overflow-y-auto">
                {colItems.map((item) => (
                  <KanbanCard key={String(item.id ?? item.subject ?? item.name)} item={item} schema={schema} onItemClick={onItemClick} />
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Mobile: stacked vertical sections */}
      <div className="md:hidden flex flex-col gap-3 p-3 overflow-y-auto">
        {columns.map(([group, colItems], colIdx) => (
          <div key={group}>
            <div className={cn("flex items-center justify-between px-3 py-2 rounded-t-lg border border-b-0 border-zinc-200 bg-white border-t-4", columnColor(colIdx))}>
              <span className="text-sm font-semibold text-zinc-700">{group || "Ungrouped"}</span>
              <span className="text-xs text-zinc-400 bg-zinc-100 px-1.5 py-0.5 rounded-full">{colItems.length}</span>
            </div>
            <div className="flex flex-col gap-2 p-2 bg-zinc-50 rounded-b-lg border border-t-0 border-zinc-200">
              {colItems.map((item) => (
                <KanbanCard key={String(item.id ?? item.subject ?? item.name)} item={item} schema={schema} onItemClick={onItemClick} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
