"use client"
import { useState, useCallback } from "react"
import type { Version } from "./types"

interface HistoryState {
  versions: Version[]
  currentIndex: number
}

export function useVersionHistory(storageKey: string, storage?: Storage) {
  const store = storage ?? (typeof window !== "undefined" ? localStorage : null)

  const [state, setState] = useState<HistoryState>(() => {
    if (!store) return { versions: [], currentIndex: -1 }
    try {
      const raw = store.getItem(storageKey)
      return raw ? JSON.parse(raw) : { versions: [], currentIndex: -1 }
    } catch { return { versions: [], currentIndex: -1 } }
  })

  const save = (s: HistoryState) => {
    try { store?.setItem(storageKey, JSON.stringify(s)) } catch {}
  }

  const push = useCallback((entry: Omit<Version, "id" | "timestamp">) => {
    const v: Version = { id: crypto.randomUUID(), timestamp: Date.now(), ...entry }
    setState(prev => {
      const next: HistoryState = { versions: [...prev.versions, v], currentIndex: prev.versions.length }
      save(next)
      return next
    })
  }, [storageKey])

  const restore = useCallback((index: number) => {
    setState(prev => {
      const next: HistoryState = { ...prev, currentIndex: index }
      save(next)
      return next
    })
  }, [storageKey])

  const clear = useCallback(() => {
    const empty: HistoryState = { versions: [], currentIndex: -1 }
    setState(empty)
    try { store?.removeItem(storageKey) } catch {}
  }, [storageKey, store])

  return { versions: state.versions, currentIndex: state.currentIndex, push, restore, clear }
}
