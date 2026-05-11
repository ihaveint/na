"use client"
import { useEffect, useRef, useState } from "react"
import type { Thread } from "@/lib/types"
import { formatDate, urgencyColor, groupThreads } from "@/lib/utils"

interface Props {
  code: string
  threads: Thread[]
}

export default function DynamicView({ code, threads }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const rootRef = useRef<ReturnType<typeof import("react-dom/client")["createRoot"]> | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!code || !containerRef.current) return

    let cancelled = false

    async function render() {
      try {
        const [Babel, ReactDOM, React] = await Promise.all([
          import("@babel/standalone"),
          import("react-dom/client"),
          import("react"),
        ])

        if (cancelled) return

        const transpiled = Babel.default.transform(code, {
          presets: [["react", { runtime: "classic" }]],
          filename: "dynamic.jsx",
        }).code!

        const scope = {
          React: React.default,
          useState: React.useState,
          useEffect: React.useEffect,
          useMemo: React.useMemo,
          formatDate,
          urgencyColor,
          groupThreads,
        }

        // eslint-disable-next-line no-new-func
        const factory = new Function(...Object.keys(scope), `${transpiled}; return Layout;`)
        const Layout = factory(...Object.values(scope))

        if (cancelled || !containerRef.current) return

        if (!rootRef.current) {
          rootRef.current = ReactDOM.createRoot(containerRef.current)
        }

        rootRef.current.render(React.default.createElement(Layout, { threads }))
        setError(null)
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e))
      }
    }

    render()
    return () => { cancelled = true }
  }, [code, threads])

  if (error) {
    return (
      <div className="m-4 p-4 rounded-lg bg-red-50 border border-red-200 text-sm font-mono text-red-700">
        <p className="font-semibold mb-1">Component error</p>
        <p className="whitespace-pre-wrap">{error}</p>
      </div>
    )
  }

  return <div ref={containerRef} className="h-full" />
}
