export type Item = Record<string, unknown>

export interface Track {
  id: string
  title: string
  artist: string
  album: string
  genre: string[]
  duration_sec: number
  bpm: number
  audio_url: string
  playlist_id: string
}

export interface Playlist {
  id: string
  name: string
  description: string
  color: string
  track_count: number
}

export interface UISchema {
  layout: "list" | "kanban" | "table"
  data_source: string
  group_by: string | null
  sort_by: string | null
  sort_direction: "asc" | "desc"
  card_fields: string[]
  filters: Array<{ field: string; op: string; value: string }>
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

export interface ChatMessage {
  role: "user" | "assistant"
  content: string
  generatedComponent?: boolean
  isSystem?: boolean
}
