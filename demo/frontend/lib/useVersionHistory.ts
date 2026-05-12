"use client"
import { useState, useCallback } from "react"
import type { Version } from "./types"

export function useVersionHistory(storageKey: string) {
  const [versions, setVersions] = useState<Version[]>(() => {
    if (typeof window === "undefined") return []
    try {
      const raw = localStorage.getItem(storageKey)
      return raw ? JSON.parse(raw) : []
    } catch { return [] }
  })

  const push = useCallback((entry: Omit<Version, "id" | "timestamp">) => {
    const v: Version = { id: crypto.randomUUID(), timestamp: Date.now(), ...entry }
    setVersions(prev => {
      const next = [...prev, v]
      try { localStorage.setItem(storageKey, JSON.stringify(next)) } catch {}
      return next
    })
  }, [storageKey])

  const clear = useCallback(() => {
    setVersions([])
    try { localStorage.removeItem(storageKey) } catch {}
  }, [storageKey])

  return { versions, push, clear }
}
