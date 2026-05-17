// Shared utilities come from the framework package
export { formatDate } from "@malleable/react"

// Finance-specific display helpers

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
