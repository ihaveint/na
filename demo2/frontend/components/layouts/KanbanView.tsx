"use client"
import type { Transaction, UISchema } from "@/lib/types"
import { cn, categoryColor, formatDate, formatAmount, groupTransactions } from "@/lib/utils"

interface Props {
  transactions: Transaction[]
  schema: UISchema
  onTransactionClick?: (tx: Transaction) => void
}

export default function KanbanView({ transactions, schema, onTransactionClick }: Props) {
  const groups = groupTransactions(transactions, schema.group_by)
  const columns = Object.keys(groups)

  return (
    <div className="flex gap-4 p-4 overflow-x-auto h-full items-start">
      {columns.map((col) => {
        const items = groups[col]
        const total = items.reduce((s, tx) => s + (tx.type === "income" ? tx.amount : -tx.amount), 0)
        return (
          <div key={col} className="flex-shrink-0 flex flex-col" style={{ width: 260 }}>
            <div className="flex items-center justify-between px-1 mb-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-zinc-700">{col || "Uncategorized"}</span>
                <span className="text-[10px] bg-zinc-100 text-zinc-500 px-1.5 py-0.5 rounded-full">{items.length}</span>
              </div>
              <span className={cn("text-xs font-mono font-semibold", total >= 0 ? "text-emerald-600" : "text-zinc-600")}>
                {total >= 0 ? "+" : "−"}{formatAmount(Math.abs(total))}
              </span>
            </div>

            <div className="flex flex-col gap-2">
              {items.map((tx) => (
                <div
                  key={tx.id}
                  onClick={() => onTransactionClick?.(tx)}
                  className={cn(
                    "bg-white border border-zinc-200 p-3 hover:border-zinc-300 hover:shadow-sm transition-all",
                    onTransactionClick && "cursor-pointer",
                    tx.is_flagged && "border-amber-200 bg-amber-50/30"
                  )}
                  style={{ borderRadius: "0.5rem" }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-sm font-medium text-zinc-900 leading-tight">{tx.merchant}</span>
                    <span className={cn("text-sm font-mono font-semibold flex-shrink-0", tx.type === "income" ? "text-emerald-600" : "text-zinc-800")}>
                      {tx.type === "income" ? "+" : ""}{formatAmount(tx.amount)}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                    <span className="text-xs text-zinc-400">{formatDate(tx.date)}</span>
                    {schema.card_fields.includes("category") && schema.group_by !== "category" && (
                      <span className={cn("text-xs px-1.5 py-0.5 rounded border", categoryColor(tx.category))}>{tx.category}</span>
                    )}
                    {schema.card_fields.includes("account") && (
                      <span className="text-xs text-zinc-400">{tx.account}</span>
                    )}
                    {tx.is_flagged && <span className="text-xs text-amber-500">⚑</span>}
                  </div>

                  {schema.card_fields.includes("description") && tx.description && (
                    <p className="text-xs text-zinc-400 truncate mt-1">{tx.description}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
