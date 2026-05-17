// Framework types — single source of truth lives in @malleable/react
import type { UISchema } from "@malleable/react"
export type { Item, UISchema, ChatMessage, Version } from "@malleable/react"

// Email-specific types
export interface Message {
  id: string
  sender: string
  sender_name: string
  date: string
  body: string
  is_self: boolean
}

export interface Thread {
  id: string
  subject: string
  sender: string
  sender_name: string
  preview: string
  project: string | null
  urgency_score: number
  date: string
  is_read: boolean
  is_snoozed: boolean
  due_date: string | null
  tags: string[]
  messages: Message[]
}

export interface Persona {
  id: string
  label: string
  description: string
  schema: UISchema
}
