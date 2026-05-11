"use client"
import { useRef, useState } from "react"

interface HighlightRect {
  top: number
  left: number
  width: number
  height: number
}

interface Props {
  active: boolean
  onElementClick: (context: string) => void
}

export default function InspectOverlay({ active, onElementClick }: Props) {
  const overlayRef = useRef<HTMLDivElement>(null)
  const [highlight, setHighlight] = useState<HighlightRect | null>(null)
  const [tooltip, setTooltip] = useState<{ text: string; x: number; y: number } | null>(null)

  function getElementUnder(clientX: number, clientY: number): Element | null {
    if (!overlayRef.current) return null
    overlayRef.current.style.pointerEvents = "none"
    const el = document.elementFromPoint(clientX, clientY)
    overlayRef.current.style.pointerEvents = "auto"
    return el
  }

  function buildContext(el: Element): string {
    const text = el.textContent?.trim().replace(/\s+/g, " ").slice(0, 60) ?? ""

    // Walk up to find the nearest data-sc sub-component marker
    let scName: string | null = null
    let cursor: Element | null = el
    while (cursor && !cursor.hasAttribute("data-dynamic-root")) {
      if (cursor.hasAttribute("data-sc")) {
        scName = cursor.getAttribute("data-sc")
        break
      }
      cursor = cursor.parentElement
    }

    const tag = el.tagName.toLowerCase()
    const path: string[] = [tag]
    let parent = el.parentElement
    for (let i = 0; i < 2 && parent && !parent.hasAttribute("data-dynamic-root"); i++) {
      path.unshift(parent.tagName.toLowerCase())
      parent = parent.parentElement
    }

    const domContext = text ? `"${text}" (${path.join(" › ")})` : `(${path.join(" › ")})`
    return scName ? `[${scName}] ${domContext}` : domContext
  }

  function handleMouseMove(e: React.MouseEvent) {
    const el = getElementUnder(e.clientX, e.clientY)
    if (!el || el === document.body || el === document.documentElement) {
      setHighlight(null)
      setTooltip(null)
      return
    }
    const rect = el.getBoundingClientRect()
    setHighlight({ top: rect.top, left: rect.left, width: rect.width, height: rect.height })
    const label = el.textContent?.trim().replace(/\s+/g, " ").slice(0, 36) || el.tagName.toLowerCase()
    setTooltip({ text: label, x: e.clientX, y: Math.max(rect.top - 30, 8) })
  }

  function handleMouseLeave() {
    setHighlight(null)
    setTooltip(null)
  }

  function handleClick(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    const el = getElementUnder(e.clientX, e.clientY)
    if (!el) return
    setHighlight(null)
    setTooltip(null)
    onElementClick(buildContext(el))
  }

  if (!active) return null

  return (
    <>
      {/* Transparent intercept layer */}
      <div
        ref={overlayRef}
        className="absolute inset-0 z-40 cursor-crosshair"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
      />

      {/* Highlight ring — fixed so viewport coords work regardless of scroll */}
      {highlight && (
        <div
          className="pointer-events-none fixed z-50 rounded-sm"
          style={{
            top: highlight.top - 2,
            left: highlight.left - 2,
            width: highlight.width + 4,
            height: highlight.height + 4,
            outline: "2px solid #7c3aed",
            backgroundColor: "rgba(124,58,237,0.07)",
          }}
        />
      )}

      {/* Tooltip */}
      {tooltip && (
        <div
          className="pointer-events-none fixed z-50 px-2 py-1 bg-zinc-900 text-white text-xs rounded-md shadow-lg max-w-xs truncate"
          style={{ top: tooltip.y, left: tooltip.x, transform: "translateX(-50%)" }}
        >
          {tooltip.text}
        </div>
      )}
    </>
  )
}
