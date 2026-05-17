"use client"
import type { Item, UISchema } from "./types"
import { fieldLabel, formatDate } from "./utils"

interface Props {
  items: Item[]
  schema: UISchema
  onItemClick?: (item: Item) => void
}

export default function TableView({ items, schema, onItemClick }: Props) {
  const fields = schema.card_fields
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-200 bg-zinc-50">
            {fields.map((f) => (
              <th key={f} className="text-left px-4 py-2 text-xs font-semibold text-zinc-500 uppercase tracking-wide">
                {fieldLabel(f)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {items.map((item) => {
            const id = String(item.id ?? item.name ?? item.title ?? Math.random())
            return (
              <tr
                key={id}
                onClick={() => onItemClick?.(item)}
                className="hover:bg-zinc-50 transition-colors cursor-pointer"
              >
                {fields.map((f) => {
                  const val = item[f]
                  return (
                    <td key={f} className="px-4 py-2 max-w-xs">
                      {renderCell(f, val)}
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function renderCell(field: string, val: unknown) {
  if (val == null) return <span className="text-zinc-400">\u2014</span>
  if (typeof val === "boolean") {
    return val
      ? <span className="text-emerald-600 font-medium">Yes</span>
      : <span className="text-zinc-400">No</span>
  }
  if (field.includes("date") || field.endsWith("_at")) {
    return <span className="text-zinc-500">{formatDate(String(val))}</span>
  }
  if (Array.isArray(val)) {
    return (
      <div className="flex gap-1 flex-wrap">
        {(val as string[]).map((v, i) => (
          <span key={i} className="bg-violet-50 text-violet-600 px-1.5 py-0.5 rounded text-xs">{v}</span>
        ))}
      </div>
    )
  }
  return <span className="text-zinc-700 truncate block max-w-xs">{String(val)}</span>
}
