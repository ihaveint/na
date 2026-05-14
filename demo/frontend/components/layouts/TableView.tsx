"use client"
import type { Item, UISchema } from "@/lib/types"
import { cn, fieldLabel, formatDate } from "@/lib/utils"

interface Props {
  items: Item[]
  schema: UISchema
  onItemClick?: (item: Item) => void
}

export default function TableView({ items, schema, onItemClick }: Props) {
  const cols = schema.card_fields
  const titleFields = new Set(["subject", "title", "name"])
  const primaryCols = cols.filter((c) => titleFields.has(c))
  const metaCols = cols.filter((c) => !titleFields.has(c))

  return (
    <>
      {/* Desktop: full table */}
      <div className="hidden md:block overflow-x-auto">
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
            {items.map((item) => (
              <tr
                key={String(item.id ?? item.subject ?? item.name)}
                onClick={() => onItemClick?.(item)}
                className={cn("hover:bg-zinc-50 transition-colors", onItemClick && "cursor-pointer")}
              >
                {cols.map((col) => (
                  <td key={col} className="px-4 py-2 max-w-xs">
                    <CellValue item={item} field={col} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: card list */}
      <div className="md:hidden divide-y divide-zinc-100">
        {items.map((item) => (
          <div
            key={String(item.id ?? item.subject ?? item.name)}
            onClick={() => onItemClick?.(item)}
            className={cn(
              "px-4 py-3 flex flex-col gap-1.5",
              onItemClick && "cursor-pointer",
              "hover:bg-zinc-50 transition-colors"
            )}
          >
            {primaryCols.map((col) => (
              <p key={col} className="text-sm leading-snug truncate text-zinc-800 font-medium">
                {String(item[col] ?? "—")}
              </p>
            ))}
            <div className="flex items-center gap-2 flex-wrap">
              {metaCols.map((col) => (
                <span key={col} className="text-xs text-zinc-400">
                  <CellValue item={item} field={col} />
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  )
}

function CellValue({ item, field }: { item: Item; field: string }) {
  const val = item[field]

  if (Array.isArray(val)) {
    return (
      <div className="flex gap-1 flex-wrap">
        {(val as string[]).map((v) => (
          <span key={v} className="bg-violet-50 text-violet-600 px-1.5 py-0.5 rounded text-xs">{v}</span>
        ))}
      </div>
    )
  }
  if (typeof val === "boolean") {
    return <span className={val ? "text-zinc-400" : "text-blue-600 font-medium"}>{val ? "Yes" : "No"}</span>
  }
  if (field.includes("date") || field.endsWith("_at")) {
    return <span className="text-zinc-500">{formatDate(val as string | null)}</span>
  }
  if (field === "subject" || field === "title" || field === "name") {
    return (
      <span className={cn("truncate block max-w-xs", item.is_read === false ? "font-semibold text-zinc-900" : "text-zinc-600")}>
        {String(val ?? "—")}
      </span>
    )
  }
  return <span className="text-zinc-700 truncate block max-w-xs">{String(val ?? "—")}</span>
}
