"use client"
import type { Thread, UISchema } from "@/lib/types"
import { cn, groupThreads, urgencyColor, formatDate } from "@/lib/utils"

interface Props {
  threads: Thread[]
  schema: UISchema
  onThreadClick?: (thread: Thread) => void
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

function KanbanCard({ t, schema, onThreadClick }: { t: Thread; schema: UISchema; onThreadClick?: (t: Thread) => void }) {
  return (
    <div
      onClick={() => onThreadClick?.(t)}
      className={cn(
        "bg-white border border-zinc-100 rounded-md p-3 shadow-sm hover:shadow-md transition-shadow cursor-pointer",
        !t.is_read && "border-l-2 border-l-blue-400"
      )}
    >
      <p className={cn("text-sm leading-snug", !t.is_read ? "font-semibold text-zinc-900" : "text-zinc-700")}>
        {t.subject}
      </p>
      <div className="mt-2 flex flex-wrap gap-1">
        {schema.card_fields.includes("sender_name") && (
          <span className="text-xs text-zinc-400">{t.sender_name}</span>
        )}
      </div>
      <div className="mt-2 flex items-center justify-between">
        {schema.card_fields.includes("urgency_score") && (
          <span className={cn("text-xs px-1.5 py-0.5 rounded border", urgencyColor(t.urgency_score))}>
            {t.urgency_score}
          </span>
        )}
        {schema.card_fields.includes("due_date") && t.due_date && (
          <span className="text-xs text-orange-500">Due {formatDate(t.due_date)}</span>
        )}
        {schema.card_fields.includes("date") && !t.due_date && (
          <span className="text-xs text-zinc-400">{formatDate(t.date)}</span>
        )}
      </div>
    </div>
  )
}

export default function KanbanView({ threads, schema, onThreadClick }: Props) {
  const groups = groupThreads(threads, schema.group_by)
  const columns = Object.entries(groups)

  return (
    <>
      {/* Desktop: horizontal columns */}
      <div className="hidden md:flex gap-4 p-4 overflow-x-auto h-full">
        {columns.map(([group, items], colIdx) => (
          <div key={group} className="flex-shrink-0 w-72">
            <div className={cn("bg-white rounded-lg border border-zinc-200 border-t-4 flex flex-col", columnColor(colIdx))}>
              <div className="px-3 py-2 border-b border-zinc-100 flex items-center justify-between">
                <span className="text-sm font-semibold text-zinc-700">{group || "No project"}</span>
                <span className="text-xs text-zinc-400 bg-zinc-100 px-1.5 py-0.5 rounded-full">{items.length}</span>
              </div>
              <div className="flex flex-col gap-2 p-2 overflow-y-auto">
                {items.map((t) => (
                  <KanbanCard key={t.id} t={t} schema={schema} onThreadClick={onThreadClick} />
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Mobile: stacked vertical sections */}
      <div className="md:hidden flex flex-col gap-3 p-3 overflow-y-auto">
        {columns.map(([group, items], colIdx) => (
          <div key={group}>
            <div className={cn("flex items-center justify-between px-3 py-2 rounded-t-lg border border-b-0 border-zinc-200 bg-white border-t-4", columnColor(colIdx))}>
              <span className="text-sm font-semibold text-zinc-700">{group || "No project"}</span>
              <span className="text-xs text-zinc-400 bg-zinc-100 px-1.5 py-0.5 rounded-full">{items.length}</span>
            </div>
            <div className="flex flex-col gap-2 p-2 bg-zinc-50 rounded-b-lg border border-t-0 border-zinc-200">
              {items.map((t) => (
                <KanbanCard key={t.id} t={t} schema={schema} onThreadClick={onThreadClick} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
