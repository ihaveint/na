import type { Persona } from "./types"

export const PERSONAS: Persona[] = [
  {
    id: "executive",
    label: "Executive",
    description: "Kanban by urgency — I need to see what's on fire",
    schema: {
      layout: "kanban",
      data_source: "list_actionable",
      group_by: "project",
      sort_by: "urgency_score",
      sort_direction: "desc",
      card_fields: ["subject", "sender_name", "urgency_score", "due_date"],
      filters: [],
      actions: ["MarkDone", "SnoozeThread"],
    },
  },
  {
    id: "student",
    label: "Student",
    description: "List by deadline — I track what's due when",
    schema: {
      layout: "list",
      data_source: "list_all",
      group_by: null,
      sort_by: "due_date",
      sort_direction: "asc",
      card_fields: ["subject", "sender_name", "due_date", "tags"],
      filters: [],
      actions: ["MarkDone", "TagProject"],
    },
  },
  {
    id: "developer",
    label: "Developer",
    description: "Table with all fields — I want density and control",
    schema: {
      layout: "table",
      data_source: "list_all",
      group_by: null,
      sort_by: "date",
      sort_direction: "desc",
      card_fields: ["subject", "sender_name", "project", "urgency_score", "date", "is_read"],
      filters: [],
      actions: ["MarkDone", "SnoozeThread", "TagProject"],
    },
  },
]
