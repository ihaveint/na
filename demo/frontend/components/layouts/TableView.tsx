"use client"
import type { Thread, UISchema } from "@/lib/types"
import { cn, urgencyColor, fieldLabel, formatDate } from "@/lib/utils"

interface Props {
  threads: Thread[]
  schema: UISchema
  onThreadClick?: (thread: Thread) => void
}

export default function TableView({ threads, schema, onThreadClick }: Props) {
  const cols = schema.card_fields

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-200 bg-zinc-50">
            {cols.map((col) => (
              <th key={col} className="text-left px-4 py-2 text-xs font-semibold text-zinc-500 uppercase tracking-wide">
                {fieldLabel(col)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {threads.map((t) => (
            <tr
              key={t.id}
              onClick={() => onThreadClick?.(t)}
              className={cn("hover:bg-zinc-50 transition-colors", onThreadClick && "cursor-pointer", !t.is_read && "bg-blue-50/30")}
            >
              {cols.map((col) => (
                <td key={col} className="px-4 py-2 max-w-xs">
                  <CellValue thread={t} field={col} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function CellValue({ thread, field }: { thread: Thread; field: string }) {
  const val = (thread as unknown as Record<string, unknown>)[field]

  if (field === "urgency_score") {
    return (
      <span className={cn("px-1.5 py-0.5 rounded border text-xs", urgencyColor(Number(val)))}>
        {String(val)}
      </span>
    )
  }
  if (field === "date" || field === "due_date") {
    return <span className="text-zinc-500">{formatDate(val as string | null)}</span>
  }
  if (field === "is_read") {
    return <span className={val ? "text-zinc-400" : "text-blue-600 font-medium"}>{val ? "Read" : "Unread"}</span>
  }
  if (field === "project" && val) {
    return <span className="bg-zinc-100 text-zinc-600 px-1.5 py-0.5 rounded text-xs">{String(val)}</span>
  }
  if (field === "tags" && Array.isArray(val)) {
    return (
      <div className="flex gap-1 flex-wrap">
        {(val as string[]).map((tag) => (
          <span key={tag} className="bg-violet-50 text-violet-600 px-1.5 py-0.5 rounded text-xs">{tag}</span>
        ))}
      </div>
    )
  }
  if (field === "subject") {
    return (
      <span className={cn("truncate block max-w-xs", !thread.is_read ? "font-semibold text-zinc-900" : "text-zinc-600")}>
        {String(val ?? "—")}
      </span>
    )
  }
  return <span className="text-zinc-700 truncate block max-w-xs">{String(val ?? "—")}</span>
}
