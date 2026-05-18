"use client"
import { useEffect, useRef, useState } from "react"
import type { Item } from "./types"
import { formatDate, groupItems } from "./utils"

interface Props {
  code: string
  items: Item[]
  onItemClick?: (item: Item) => void
  extraScope?: Record<string, unknown>
}

export default function DynamicView({ code, items, onItemClick, extraScope }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const rootRef = useRef<ReturnType<typeof import("react-dom/client")["createRoot"]> | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!code || !containerRef.current) return

    let cancelled = false

    async function render() {
      try {
        const [babelMod, ReactDOM, React] = await Promise.all([
          import("@babel/standalone"),
          import("react-dom/client"),
          import("react"),
        ])

        if (cancelled) return

        // @babel/standalone may expose transform as a named export (ESM/newer webpack)
        // or under .default (older CJS wrapping) — handle both.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const babelTransform: (code: string, opts: unknown) => { code: string } =
          (babelMod as any).transform ?? (babelMod as any).default?.transform
        if (!babelTransform) throw new Error("Could not resolve Babel.transform")

        const transpiled = babelTransform(code, {
          presets: [["react", { runtime: "classic" }]],
          filename: "dynamic.jsx",
        }).code!

        const scope: Record<string, unknown> = {
          React: React.default,
          useState: React.useState,
          useEffect: React.useEffect,
          useMemo: React.useMemo,
          formatDate,
          groupItems,
          onItemClick,
          ...extraScope,
        }

        const factory = new Function(...Object.keys(scope), `${transpiled}; return Layout;`)
        const Layout = factory(...Object.values(scope))

        if (cancelled || !containerRef.current) return

        if (!rootRef.current) {
          rootRef.current = ReactDOM.createRoot(containerRef.current)
        }

        rootRef.current.render(React.default.createElement(Layout, { items, onItemClick }))
        setError(null)
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e))
      }
    }

    render()
    return () => { cancelled = true }
  }, [code, items, extraScope])

  if (error) {
    return (
      <div className="m-4 p-4 rounded-lg bg-red-50 border border-red-200 text-sm font-mono text-red-700">
        <p className="font-semibold mb-1">Component error</p>
        <p className="whitespace-pre-wrap">{error}</p>
      </div>
    )
  }

  return <div ref={containerRef} className="h-full w-full overflow-auto" />
}
