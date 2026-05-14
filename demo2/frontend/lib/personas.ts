import type { Persona } from "./types"

export const PERSONAS: Persona[] = [
  {
    id: "spender",
    label: "Spender",
    description: "Table of all transactions — I want to see everything",
    schema: {
      layout: "table",
      data_source: "list_all",
      group_by: null,
      sort_by: "date",
      sort_direction: "desc",
      card_fields: ["date", "merchant", "amount", "category", "account"],
      filters: [],
      actions: ["FlagTransaction", "Recategorize"],
    },
  },
  {
    id: "budgeter",
    label: "Budgeter",
    description: "Expenses by category — I track where money goes",
    schema: {
      layout: "kanban",
      data_source: "list_expenses",
      group_by: "category",
      sort_by: "amount",
      sort_direction: "desc",
      card_fields: ["date", "merchant", "amount", "description"],
      filters: [],
      actions: ["Recategorize"],
    },
  },
  {
    id: "analyst",
    label: "Analyst",
    description: "Sorted by amount — I find the big spends",
    schema: {
      layout: "table",
      data_source: "list_all",
      group_by: null,
      sort_by: "amount",
      sort_direction: "desc",
      card_fields: ["date", "merchant", "amount", "category", "account", "type", "is_flagged"],
      filters: [],
      actions: ["FlagTransaction"],
    },
  },
]
