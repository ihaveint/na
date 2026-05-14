export type ChatMessage = {
  role: "user" | "assistant"
  content: string
  generatedComponent?: boolean
  isSystem?: boolean
}

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

export interface UISchema {
  layout: "list" | "table" | "kanban"
  data_source: "list_all" | "list_expenses" | "list_income"
  group_by: string | null
  sort_by: string | null
  sort_direction: "asc" | "desc"
  card_fields: string[]
  filters: { field: string; op: string; value: string }[]
  actions: string[]
}

export interface Version {
  id: string
  timestamp: number
  label: string
  schema: UISchema
  componentCode: string | null
  renderMode: "schema" | "component"
  chatSnapshot: ChatMessage[]
}

export interface Persona {
  id: string
  label: string
  description: string
  schema: UISchema
}
