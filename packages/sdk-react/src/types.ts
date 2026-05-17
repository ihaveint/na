export type Item = Record<string, unknown>

export type ChatMessage = {
  role: "user" | "assistant"
  content: string
  generatedComponent?: boolean
  isSystem?: boolean
}

export interface UISchema {
  layout: string
  data_source: string
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
