"use client"
import type { Item } from "@malleable/react"
import type { Transaction } from "@/lib/types"
import { categoryColor, formatAmount, formatDate } from "@/lib/utils"

export default function TransactionDetailPanel({ item, onClose }: { item: Item | null; onClose: () => void }) {
  const transaction = item as Transaction | null
  if (!transaction) return null

  const tx = transaction
  const isIncome = tx.type === "income"

  return (
    <>
      <div className="fixed inset-0 z-[9998] bg-black/20" onClick={onClose} />
      <div
        className="fixed right-0 top-0 h-full bg-white border-l border-zinc-200 shadow-2xl flex flex-col z-[9999]"
        style={{ width: 400 }}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-zinc-100 flex-shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold flex-shrink-0 ${
                isIncome ? "bg-emerald-100 text-emerald-700" : "bg-zinc-100 text-zinc-600"
              }`}>
                {tx.merchant[0]?.toUpperCase()}
              </div>
              <div>
                <h2 className="text-sm font-semibold text-zinc-900">{tx.merchant}</h2>
                <p className="text-xs text-zinc-500 mt-0.5">{tx.account}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-zinc-400 hover:text-zinc-700 w-6 h-6 flex items-center justify-center rounded hover:bg-zinc-100 text-lg leading-none flex-shrink-0"
            >
              ×
            </button>
          </div>

          <div className="mt-4">
            <p className={`text-3xl font-bold font-mono ${isIncome ? "text-emerald-600" : "text-zinc-900"}`}>
              {isIncome ? "+" : "−"}{formatAmount(tx.amount)}
            </p>
            <p className="text-sm text-zinc-500 mt-1">{new Date(tx.date).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>
          </div>
        </div>

        {/* Details */}
        <div className="flex-1 overflow-y-auto min-h-0 px-5 py-4">
          <div className="space-y-4">
            <Row label="Category">
              <span className={`text-xs px-2 py-1 rounded border font-medium ${categoryColor(tx.category)}`}>
                {tx.category}
              </span>
            </Row>

            <Row label="Type">
              <span className={`text-sm font-medium capitalize ${
                tx.type === "income" ? "text-emerald-600" : tx.type === "transfer" ? "text-blue-600" : "text-zinc-700"
              }`}>
                {tx.type}
              </span>
            </Row>

            <Row label="Account">
              <span className="text-sm text-zinc-700">{tx.account}</span>
            </Row>

            {tx.description && (
              <Row label="Note">
                <span className="text-sm text-zinc-700">{tx.description}</span>
              </Row>
            )}

            {tx.is_flagged && (
              <Row label="Status">
                <span className="text-sm text-amber-600 font-medium">⚑ Flagged for review</span>
              </Row>
            )}

            {tx.tags.length > 0 && (
              <Row label="Tags">
                <div className="flex gap-1.5 flex-wrap">
                  {tx.tags.map((tag) => (
                    <span key={tag} className="text-xs bg-violet-50 text-violet-600 px-2 py-0.5 rounded border border-violet-200">
                      {tag}
                    </span>
                  ))}
                </div>
              </Row>
            )}

            <div className="pt-2 border-t border-zinc-100">
              <p className="text-xs text-zinc-400 font-mono">ID: {tx.id}</p>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-xs font-medium text-zinc-400 uppercase tracking-wide w-20 flex-shrink-0 pt-0.5">{label}</span>
      <div className="flex-1">{children}</div>
    </div>
  )
}
