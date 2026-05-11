"use client"
import { useEffect, useRef, useState } from "react"
import type { ChatMessage } from "./ChatPanel"

const BUTTON_SIZE = 44
const MODAL_WIDTH = 320
const MODAL_HEIGHT = 420
const GAP = 8
const EDGE = 24

interface Props {
  messages: ChatMessage[]
  applying: boolean
  hasComponent: boolean
  inspectContext: string | null
  onClearInspectContext: () => void
  onSend: (message: string) => void
}

export default function ChatModal({
  messages,
  applying,
  hasComponent,
  inspectContext,
  onClearInspectContext,
  onSend,
}: Props) {
  const [isOpen, setIsOpen] = useState(false)
  const [input, setInput] = useState("")
  // null = use CSS default (bottom-left corner via fixed + bottom/left)
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const drag = useRef<{
    startClientX: number
    startClientY: number
    offsetX: number
    offsetY: number
    moved: boolean
  } | null>(null)

  const lastMessage = messages[messages.length - 1]
  const hasUnread = !isOpen && lastMessage?.role === "assistant" && !lastMessage.generatedComponent

  // Auto-open on agent question or inspect click
  useEffect(() => {
    if (lastMessage?.role === "assistant" && !lastMessage.generatedComponent) setIsOpen(true)
  }, [messages])

  useEffect(() => {
    if (inspectContext) setIsOpen(true)
  }, [inspectContext])

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" })
        inputRef.current?.focus()
      }, 50)
    }
  }, [isOpen, messages.length])

  // ── Drag ──────────────────────────────────────────────────────────────────

  function handleMouseDown(e: React.MouseEvent<HTMLButtonElement>) {
    e.preventDefault()
    const rect = e.currentTarget.getBoundingClientRect()
    drag.current = {
      startClientX: e.clientX,
      startClientY: e.clientY,
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top,
      moved: false,
    }

    function onMouseMove(ev: MouseEvent) {
      if (!drag.current) return
      const dx = ev.clientX - drag.current.startClientX
      const dy = ev.clientY - drag.current.startClientY
      if (!drag.current.moved && Math.sqrt(dx * dx + dy * dy) > 4) drag.current.moved = true
      if (!drag.current.moved) return

      const rawX = ev.clientX - drag.current.offsetX
      const rawY = ev.clientY - drag.current.offsetY
      setPos({
        x: Math.max(0, Math.min(rawX, window.innerWidth - BUTTON_SIZE)),
        y: Math.max(0, Math.min(rawY, window.innerHeight - BUTTON_SIZE)),
      })
    }

    function onMouseUp() {
      if (drag.current && !drag.current.moved) setIsOpen((v) => !v)
      drag.current = null
      document.removeEventListener("mousemove", onMouseMove)
      document.removeEventListener("mouseup", onMouseUp)
    }

    document.addEventListener("mousemove", onMouseMove)
    document.addEventListener("mouseup", onMouseUp)
  }

  // ── Derived positions ──────────────────────────────────────────────────────

  const buttonStyle: React.CSSProperties = pos
    ? { position: "fixed", left: pos.x, top: pos.y, zIndex: 50 }
    : { position: "fixed", bottom: EDGE, left: EDGE, zIndex: 50 }

  const modalStyle: React.CSSProperties = (() => {
    if (!pos) return { position: "fixed", bottom: EDGE + BUTTON_SIZE + GAP, left: EDGE, zIndex: 50 }
    const top = Math.max(GAP, pos.y - MODAL_HEIGHT - GAP)
    const left = Math.max(GAP, Math.min(pos.x, window.innerWidth - MODAL_WIDTH - GAP))
    return { position: "fixed", top, left, zIndex: 50 }
  })()

  // ── Send ──────────────────────────────────────────────────────────────────

  function handleSend() {
    if (!input.trim() || applying) return
    const message = inspectContext ? `About ${inspectContext}: ${input.trim()}` : input.trim()
    onSend(message)
    setInput("")
    onClearInspectContext()
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Modal */}
      {isOpen && (
        <div
          className="bg-white rounded-2xl shadow-2xl border border-zinc-200 flex flex-col overflow-hidden"
          style={{ ...modalStyle, width: MODAL_WIDTH, maxHeight: MODAL_HEIGHT }}
        >
          <div className="px-4 py-2.5 border-b border-zinc-100 flex items-center justify-between bg-zinc-50 flex-shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-violet-500" />
              <span className="text-xs font-semibold text-zinc-700">AI Agent</span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-zinc-400 hover:text-zinc-700 text-xl leading-none w-6 h-6 flex items-center justify-center rounded hover:bg-zinc-100"
            >
              ×
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2.5 min-h-0">
            {messages.length === 0 ? (
              <p className="text-xs text-zinc-400 text-center py-6">
                {hasComponent
                  ? "Ask the agent to modify the layout, or click Inspect to talk about a specific element."
                  : "Describe how you'd like your email displayed. The agent will ask follow-up questions if needed."}
              </p>
            ) : (
              messages.map((msg, i) => (
                <div key={i} className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  {msg.role === "assistant" && (
                    <div className="w-5 h-5 rounded-full bg-violet-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-white text-[10px] font-bold">A</span>
                    </div>
                  )}
                  <div className={`max-w-[85%] px-3 py-2 rounded-2xl text-xs leading-snug ${
                    msg.role === "user"
                      ? "bg-violet-600 text-white rounded-br-sm"
                      : msg.generatedComponent
                      ? "bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-bl-sm"
                      : "bg-zinc-100 text-zinc-800 rounded-bl-sm"
                  }`}>
                    {msg.generatedComponent && (
                      <span className="text-[10px] font-semibold text-emerald-600 block mb-0.5">
                        Component generated
                      </span>
                    )}
                    {msg.content}
                  </div>
                </div>
              ))
            )}
            <div ref={bottomRef} />
          </div>

          {inspectContext && (
            <div className="px-3 pt-2 flex-shrink-0">
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-violet-50 border border-violet-200 rounded-lg text-xs text-violet-700">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                </svg>
                <span className="flex-1 truncate font-mono">{inspectContext}</span>
                <button onClick={onClearInspectContext} className="text-violet-400 hover:text-violet-700 ml-1">×</button>
              </div>
            </div>
          )}

          <div className="px-3 py-2.5 border-t border-zinc-100 flex-shrink-0">
            <div className="flex gap-1.5">
              <input
                ref={inputRef}
                className="flex-1 text-xs border border-zinc-200 rounded-lg px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-violet-400 placeholder:text-zinc-400 disabled:opacity-50"
                placeholder={
                  applying ? "Thinking…" :
                  inspectContext ? "What would you like to change?" :
                  "Message the agent…"
                }
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                disabled={applying}
              />
              <button
                onClick={handleSend}
                disabled={applying || !input.trim()}
                className="px-3 py-2 bg-violet-600 text-white text-xs font-semibold rounded-lg hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {applying ? "…" : "→"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Draggable floating button */}
      <button
        ref={buttonRef}
        onMouseDown={handleMouseDown}
        className={`flex items-center justify-center rounded-full shadow-lg transition-colors select-none ${
          isOpen ? "bg-zinc-800 text-white" : "bg-violet-600 text-white hover:bg-violet-700"
        }`}
        style={{ ...buttonStyle, width: BUTTON_SIZE, height: BUTTON_SIZE, cursor: "grab" }}
      >
        {isOpen ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M18 6 6 18M6 6l12 12"/>
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
        )}
        {hasUnread && (
          <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-red-500 rounded-full border-2 border-white" />
        )}
      </button>
    </>
  )
}
