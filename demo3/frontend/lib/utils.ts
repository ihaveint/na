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

// Virtual groupBy for music tracks
function computeVirtualField(item: Item, field: string): string {
  if (field === "bpm_bucket") {
    const bpm = Number(item["bpm"] ?? 0)
    if (bpm > 120) return "High"
    if (bpm >= 90) return "Mid"
    return "Low"
  }
  return String((item as Record<string, unknown>)[field] ?? "Other")
}

const COLUMN_ORDER: Record<string, string[]> = {
  bpm_bucket: ["Low", "Mid", "High"],
}

export function groupItems(
  items: Item[],
  groupBy: string | null
): Record<string, Item[]> {
  if (!groupBy) return { "": items }

  const groups: Record<string, Item[]> = {}
  for (const item of items) {
    let key: string
    if (groupBy === "bpm_bucket") {
      const bpm = Number(item["bpm"] ?? 0)
      key = bpm > 120 ? "High" : bpm >= 90 ? "Mid" : "Low"
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
    title: "Title",
    artist: "Artist",
    album: "Album",
    genre: "Genre",
    duration_sec: "Duration",
    bpm: "BPM",
    playlist_id: "Playlist",
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

export function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s.toString().padStart(2, "0")}`
}
