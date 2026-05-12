"use client"
import { useEffect, useRef } from "react"
import type { ChatMessage } from "@/lib/types"

export type { ChatMessage }

interface Props {
  messages: ChatMessage[]
}

export default function ChatPanel({ messages }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  if (messages.length === 0) return null

  return (
    <div className="border-b border-zinc-200 bg-zinc-50 px-4 py-3 flex flex-col gap-3 max-h-56 overflow-y-auto">
      {messages.map((msg, i) => (
        <div key={i} className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
          {msg.role === "assistant" && (
            <div className="w-6 h-6 rounded-full bg-violet-600 flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-white text-xs font-bold">A</span>
            </div>
          )}
          <div
            className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm leading-snug ${
              msg.role === "user"
                ? "bg-violet-600 text-white rounded-br-sm"
                : msg.generatedComponent
                ? "bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-bl-sm"
                : "bg-white text-zinc-800 border border-zinc-200 rounded-bl-sm"
            }`}
          >
            {msg.generatedComponent && (
              <span className="text-xs font-semibold text-emerald-600 block mb-0.5">Component generated</span>
            )}
            {msg.content}
          </div>
          {msg.role === "user" && (
            <div className="w-6 h-6 rounded-full bg-zinc-300 flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-zinc-600 text-xs font-bold">U</span>
            </div>
          )}
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  )
}
