import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import type { Item, UISchema } from "./types"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function applySchema(items: Item[], schema: UISchema): Item[] {
  let result = [...items]

  for (const f of schema.filters) {
    result = result.filter((item) => {
      const val = (item as Record<string, unknown>)[f.field]
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
      const av = (a as Record<string, unknown>)[key]
      const bv = (b as Record<string, unknown>)[key]
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

export function groupItems(
  items: Item[],
  groupBy: string | null
): Record<string, Item[]> {
  if (!groupBy) return { "": items }

  const groups: Record<string, Item[]> = {}
  for (const item of items) {
    const key = String(item[groupBy] ?? "Other")
    if (!groups[key]) groups[key] = []
    groups[key].push(item)
  }
  return groups
}

export function formatDate(iso: string | null): string {
  if (!iso) return "\u2014"
  const d = new Date(iso)
  const now = new Date()
  const diffDays = Math.floor((d.getTime() - now.getTime()) / 86400000)
  if (diffDays === 0) return "Today"
  if (diffDays === 1) return "Tomorrow"
  if (diffDays === -1) return "Yesterday"
  if (Math.abs(diffDays) < 7) return d.toLocaleDateString("en-US", { weekday: "short" })
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

export function fieldLabel(field: string): string {
  return field.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}
