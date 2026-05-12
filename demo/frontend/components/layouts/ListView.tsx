"use client"
import type { Thread, UISchema } from "@/lib/types"
import { cn, urgencyColor, fieldLabel, formatDate } from "@/lib/utils"

interface Props {
  threads: Thread[]
  schema: UISchema
  onThreadClick?: (thread: Thread) => void
}

export default function ListView({ threads, schema, onThreadClick }: Props) {
  return (
    <div className="flex flex-col divide-y divide-zinc-100">
      {threads.map((t) => (
        <div
          key={t.id}
          onClick={() => onThreadClick?.(t)}
          className={cn(
            "flex gap-4 px-4 py-3 hover:bg-zinc-50 transition-colors",
            onThreadClick && "cursor-pointer",
            !t.is_read && "bg-blue-50/40"
          )}
        >
          <div className="mt-1 flex-shrink-0">
            <div className={cn("w-2 h-2 rounded-full mt-1.5", !t.is_read ? "bg-blue-500" : "bg-transparent")} />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-baseline justify-between gap-2">
              <span className={cn("text-sm truncate", !t.is_read ? "font-semibold text-zinc-900" : "text-zinc-700")}>
                {t.subject}
              </span>
              <span className="text-xs text-zinc-400 flex-shrink-0">{formatDate(t.date)}</span>
            </div>

            <div className="flex items-center gap-2 mt-0.5">
              {schema.card_fields.includes("sender_name") && (
                <span className="text-xs text-zinc-500">{t.sender_name}</span>
              )}
              {schema.card_fields.includes("project") && t.project && (
                <span className="text-xs bg-zinc-100 text-zinc-600 px-1.5 py-0.5 rounded">{t.project}</span>
              )}
              {schema.card_fields.includes("due_date") && t.due_date && (
                <span className="text-xs text-orange-600">Due {formatDate(t.due_date)}</span>
              )}
              {schema.card_fields.includes("urgency_score") && (
                <span className={cn("text-xs px-1.5 py-0.5 rounded border", urgencyColor(t.urgency_score))}>
                  {t.urgency_score}
                </span>
              )}
              {schema.card_fields.includes("tags") && t.tags.length > 0 && (
                <div className="flex gap-1">
                  {t.tags.slice(0, 2).map((tag) => (
                    <span key={tag} className="text-xs bg-violet-50 text-violet-600 px-1.5 py-0.5 rounded">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {schema.card_fields.includes("preview") && (
              <p className="text-xs text-zinc-400 truncate mt-0.5">{t.preview}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
