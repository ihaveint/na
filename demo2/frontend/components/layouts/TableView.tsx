"use client"
import type { Transaction, UISchema } from "@/lib/types"
import { cn, categoryColor, fieldLabel, formatDate, formatAmount } from "@/lib/utils"

interface Props {
  transactions: Transaction[]
  schema: UISchema
  onTransactionClick?: (tx: Transaction) => void
}

export default function TableView({ transactions, schema, onTransactionClick }: Props) {
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
          {transactions.map((tx) => (
            <tr
              key={tx.id}
              onClick={() => onTransactionClick?.(tx)}
              className={cn(
                "hover:bg-zinc-50 transition-colors",
                onTransactionClick && "cursor-pointer",
                tx.is_flagged && "bg-amber-50/20"
              )}
            >
              {cols.map((col) => (
                <td key={col} className="px-4 py-2 max-w-xs">
                  <CellValue tx={tx} field={col} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function CellValue({ tx, field }: { tx: Transaction; field: string }) {
  if (field === "amount") {
    return (
      <span className={cn("font-mono", tx.type === "income" ? "text-emerald-600 font-semibold" : "text-zinc-800")}>
        {tx.type === "income" ? "+" : "−"}{formatAmount(tx.amount)}
      </span>
    )
  }
  if (field === "date") {
    return <span className="text-zinc-500 whitespace-nowrap">{formatDate(tx.date)}</span>
  }
  if (field === "category") {
    return <span className={cn("px-1.5 py-0.5 rounded border text-xs whitespace-nowrap", categoryColor(tx.category))}>{tx.category}</span>
  }
  if (field === "type") {
    return (
      <span className={cn("capitalize text-xs font-medium", tx.type === "income" ? "text-emerald-600" : tx.type === "transfer" ? "text-blue-600" : "text-zinc-500")}>
        {tx.type}
      </span>
    )
  }
  if (field === "is_flagged") {
    return tx.is_flagged ? <span className="text-amber-500 text-xs font-semibold">⚑ Flagged</span> : <span className="text-zinc-300">—</span>
  }
  if (field === "merchant") {
    return <span className="font-medium text-zinc-900 truncate block max-w-xs">{tx.merchant}</span>
  }
  if (field === "tags") {
    return (
      <div className="flex gap-1 flex-wrap">
        {tx.tags.map((tag) => (
          <span key={tag} className="bg-violet-50 text-violet-600 px-1.5 py-0.5 rounded text-xs">{tag}</span>
        ))}
      </div>
    )
  }
  const val = (tx as unknown as Record<string, unknown>)[field]
  return <span className="text-zinc-700 truncate block max-w-xs">{String(val ?? "—")}</span>
}
