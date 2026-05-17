// Framework types — single source of truth lives in @malleable/react
import type { UISchema } from "@malleable/react"
export type { UISchema, ChatMessage, Version } from "@malleable/react"

// Finance-specific types
export interface Transaction {
  id: string
  date: string
  amount: number
  merchant: string
  category: string
  account: string
  description: string
  type: "expense" | "income" | "transfer"
  is_flagged: boolean
  tags: string[]
}

export interface Persona {
  id: string
  label: string
  description: string
  schema: UISchema
}
