export type ChatMessage = {
  role: "user" | "assistant"
  content: string
  generatedComponent?: boolean
  isSystem?: boolean
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
}

export interface UISchema {
  layout: "list" | "kanban" | "calendar" | "table"
  data_source: "list_all" | "list_actionable"
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
