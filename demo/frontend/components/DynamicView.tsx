"use client"
import { useEffect, useRef, useState, Component, type ReactNode } from "react"
import type { Item } from "@/lib/types"
import { formatDate, groupItems } from "@/lib/utils"

interface Props {
  code: string
  items: Item[]
  onItemClick?: (item: Item) => void
}

interface BoundaryProps { children?: ReactNode; onError: (msg: string) => void }
interface BoundaryState { caught: boolean }

class ErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { caught: false }
  componentDidCatch(e: Error) { this.props.onError(e.message) }
  static getDerivedStateFromError() { return { caught: true } }
  render() { return this.state.caught ? null : this.props.children }
}

export default function DynamicView({ code, items, onItemClick }: Props) {
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

        const d = new Date()
        const scope = {
          React: React.default,
          useState: React.useState,
          useEffect: React.useEffect,
          useMemo: React.useMemo,
          formatDate,
          groupItems,
          onItemClick,
          // Local-timezone YYYY-MM-DD — safe to compare against date-only ISO strings
          today: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
        }

        // eslint-disable-next-line no-new-func
        const factory = new Function(...Object.keys(scope), `${transpiled}; return Layout;`)
        const Layout = factory(...Object.values(scope))

        if (cancelled || !containerRef.current) return

        // Always recreate the root so a previously errored root never gets reused.
        if (rootRef.current) {
          rootRef.current.unmount()
          rootRef.current = null
        }
        rootRef.current = ReactDOM.createRoot(containerRef.current)

        const onRenderError = (msg: string) => { if (!cancelled) setError(msg) }
        rootRef.current.render(
          React.default.createElement(
            ErrorBoundary,
            { onError: onRenderError },
            React.default.createElement(Layout, { items, onItemClick })
          )
        )
        setError(null)
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e))
      }
    }

    render()
    return () => {
      cancelled = true
      // Unmount immediately so the next code change starts from a clean root.
      if (rootRef.current) {
        rootRef.current.unmount()
        rootRef.current = null
      }
    }
  }, [code, items])

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
