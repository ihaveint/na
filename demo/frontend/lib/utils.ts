import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import type { Item, UISchema } from "./types"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function applySchema(items: Item[], schema: UISchema): Item[] {
  let result = [...items]

  // filters
  for (const f of schema.filters) {
    result = result.filter((item) => {
      const val = (item as unknown as Record<string, unknown>)[f.field]
      // coerce both sides so boolean fields work when Claude emits "true"/"false" strings
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

  // sort
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

// Virtual fields Claude may generate that don't exist on items directly
const URGENCY_BUCKET_ORDER = ["Critical", "Normal", "Low"]

function computeVirtualField(t: Item, field: string): string {
  if (field === "urgency_bucket") {
    const score = Number(t["urgency_score"] ?? 0)
    if (score >= 75) return "Critical"
    if (score >= 40) return "Normal"
    return "Low"
  }
  if (field === "has_deadline") {
    return t["due_date"] ? "Has deadline" : "No deadline"
  }
  return String((t as Record<string, unknown>)[field] ?? "Other")
}

const COLUMN_ORDER: Record<string, string[]> = {
  urgency_bucket: URGENCY_BUCKET_ORDER,
  has_deadline: ["Has deadline", "No deadline"],
}


export function groupItems(
  items: Item[],
  groupBy: string | null
): Record<string, Item[]> {
  if (!groupBy) return { "": items }

  const groups: Record<string, Item[]> = {}
  for (const item of items) {
    let key: string
    if (groupBy === "urgency_bucket") {
      const score = Number(item["urgency_score"] ?? 0)
      key = score >= 75 ? "Critical" : score >= 40 ? "Normal" : "Low"
    } else if (groupBy === "has_deadline") {
      key = item["due_date"] ? "Has deadline" : "No deadline"
    } else {
      key = String(item[groupBy] ?? "Other")
    }
    if (!groups[key]) groups[key] = []
    groups[key].push(item)
  }

  const order = COLUMN_ORDER[groupBy]
  if (order) {
    const ordered: Record<string, Item[]> = {}
    for (const col of order) if (groups[col]) ordered[col] = groups[col]
    for (const key of Object.keys(groups)) if (!ordered[key]) ordered[key] = groups[key]
    return ordered
  }
  return groups
}


export function fieldLabel(field: string): string {
  const overrides: Record<string, string> = {
    subject: "Subject",
    sender: "Email",
    sender_name: "From",
    preview: "Preview",
    project: "Project",
    urgency_score: "Urgency",
    date: "Date",
    is_read: "Read",
    is_snoozed: "Snoozed",
    due_date: "Due",
    tags: "Tags",
  }
  return overrides[field] ?? field.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
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
