import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import type { Transaction, UISchema } from "./types"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function applySchema(transactions: Transaction[], schema: UISchema): Transaction[] {
  let result = [...transactions]

  for (const f of schema.filters) {
    result = result.filter((t) => {
      const val = (t as unknown as Record<string, unknown>)[f.field]
      const coerce = (v: unknown) => {
        if (v === "true") return true
        if (v === "false") return false
        const n = Number(v)
        return isNaN(n) ? v : n
      }
      const a = typeof val === "boolean" || typeof val === "number" ? val : coerce(val)
      const b = coerce(f.value)
      const strEq = typeof a === "string" && typeof b === "string"
        ? a.toLowerCase() === b.toLowerCase()
        : a === b
      if (f.op === "eq") return strEq
      if (f.op === "neq") return !strEq
      if (f.op === "gt") return Number(a) > Number(b)
      if (f.op === "lt") return Number(a) < Number(b)
      return true
    })
  }

  if (schema.sort_by) {
    const key = schema.sort_by
    result.sort((a, b) => {
      const av = (a as unknown as Record<string, unknown>)[key]
      const bv = (b as unknown as Record<string, unknown>)[key]
      if (av == null) return 1
      if (bv == null) return -1
      if (typeof av === "string" && typeof bv === "string") {
        return schema.sort_direction === "asc"
          ? av.localeCompare(bv)
          : bv.localeCompare(av)
      }
      return schema.sort_direction === "asc"
        ? Number(av) - Number(bv)
        : Number(bv) - Number(av)
    })
  }

  return result
}

function computeVirtualField(t: Transaction, field: string): string {
  if (field === "month") {
    const d = new Date(t.date)
    return d.toLocaleDateString("en-US", { month: "long", year: "numeric" })
  }
  if (field === "type") return t.type
  return String((t as unknown as Record<string, unknown>)[field] ?? "Other")
}

const COLUMN_ORDER: Record<string, string[]> = {
  type: ["income", "expense", "transfer"],
}

export function groupTransactions(
  transactions: Transaction[],
  groupBy: string | null
): Record<string, Transaction[]> {
  if (!groupBy) return { "": transactions }

  const groups: Record<string, Transaction[]> = {}
  for (const t of transactions) {
    const key = computeVirtualField(t, groupBy)
    if (!groups[key]) groups[key] = []
    groups[key].push(t)
  }

  const order = COLUMN_ORDER[groupBy]
  if (order) {
    const ordered: Record<string, Transaction[]> = {}
    for (const col of order) if (groups[col]) ordered[col] = groups[col]
    for (const key of Object.keys(groups)) if (!ordered[key]) ordered[key] = groups[key]
    return ordered
  }

  // Sort groups by total amount descending for category/merchant grouping
  const sorted = Object.entries(groups).sort(([, a], [, b]) => {
    const sumA = a.reduce((s, t) => s + t.amount, 0)
    const sumB = b.reduce((s, t) => s + t.amount, 0)
    return sumB - sumA
  })
  return Object.fromEntries(sorted)
}

const CATEGORY_COLORS: Record<string, string> = {
  "Food & Drink":   "bg-orange-100 text-orange-700 border-orange-200",
  "Transport":      "bg-blue-100 text-blue-700 border-blue-200",
  "Entertainment":  "bg-purple-100 text-purple-700 border-purple-200",
  "Housing":        "bg-red-100 text-red-700 border-red-200",
  "Shopping":       "bg-pink-100 text-pink-700 border-pink-200",
  "Health":         "bg-green-100 text-green-700 border-green-200",
  "Travel":         "bg-sky-100 text-sky-700 border-sky-200",
  "Income":         "bg-emerald-100 text-emerald-700 border-emerald-200",
  "Subscriptions":  "bg-violet-100 text-violet-700 border-violet-200",
}

export function categoryColor(category: string): string {
  return CATEGORY_COLORS[category] ?? "bg-zinc-100 text-zinc-600 border-zinc-200"
}

export function formatAmount(amount: number): string {
  return amount.toLocaleString("en-US", { style: "currency", currency: "USD" })
}

export function fieldLabel(field: string): string {
  const map: Record<string, string> = {
    date: "Date",
    amount: "Amount",
    merchant: "Merchant",
    category: "Category",
    account: "Account",
    description: "Note",
    type: "Type",
    is_flagged: "Flagged",
    tags: "Tags",
  }
  return map[field] ?? field
}

export function formatDate(iso: string | null): string {
  if (!iso) return "—"
  const d = new Date(iso)
  const now = new Date()
  const diffDays = Math.floor((d.getTime() - now.getTime()) / 86400000)
  if (diffDays === 0) return "Today"
  if (diffDays === 1) return "Tomorrow"
  if (diffDays === -1) return "Yesterday"
  if (Math.abs(diffDays) < 7) return d.toLocaleDateString("en-US", { weekday: "short" })
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}
