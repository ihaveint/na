"use client"
import type { Transaction, UISchema } from "@/lib/types"
import { cn, categoryColor, fieldLabel, formatDate, formatAmount } from "@/lib/utils"

interface Props {
  transactions: Transaction[]
  schema: UISchema
  onTransactionClick?: (tx: Transaction) => void
}

export default function ListView({ transactions, schema, onTransactionClick }: Props) {
  return (
    <div className="flex flex-col divide-y divide-zinc-100">
      {transactions.map((tx) => (
        <div
          key={tx.id}
          onClick={() => onTransactionClick?.(tx)}
          className={cn(
            "flex gap-4 px-4 py-3 hover:bg-zinc-50 transition-colors",
            onTransactionClick && "cursor-pointer",
            tx.is_flagged && "bg-amber-50/40"
          )}
        >
          <div className="w-9 h-9 rounded-full bg-zinc-100 flex items-center justify-center text-sm font-bold text-zinc-600 flex-shrink-0">
            {tx.merchant[0]?.toUpperCase()}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-sm font-medium text-zinc-900 truncate">{tx.merchant}</span>
              <span className={cn("text-sm font-mono flex-shrink-0", tx.type === "income" ? "text-emerald-600" : "text-zinc-800")}>
                {tx.type === "income" ? "+" : "−"}{formatAmount(tx.amount)}
              </span>
            </div>

            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs text-zinc-400">{formatDate(tx.date)}</span>
              {schema.card_fields.includes("category") && (
                <span className={cn("text-xs px-1.5 py-0.5 rounded border", categoryColor(tx.category))}>{tx.category}</span>
              )}
              {schema.card_fields.includes("account") && (
                <span className="text-xs text-zinc-500">{tx.account}</span>
              )}
              {schema.card_fields.includes("type") && (
                <span className={cn("text-xs font-medium capitalize", tx.type === "income" ? "text-emerald-600" : "text-zinc-400")}>{tx.type}</span>
              )}
              {tx.is_flagged && <span className="text-xs text-amber-500 font-semibold">⚑</span>}
              {schema.card_fields.includes("tags") && tx.tags.length > 0 && (
                <div className="flex gap-1">
                  {tx.tags.slice(0, 2).map((tag) => (
                    <span key={tag} className="text-xs bg-violet-50 text-violet-600 px-1.5 py-0.5 rounded">{tag}</span>
                  ))}
                </div>
              )}
            </div>

            {schema.card_fields.includes("description") && tx.description && (
              <p className="text-xs text-zinc-400 truncate mt-0.5">{tx.description}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
