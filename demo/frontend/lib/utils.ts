// Re-export shared utilities from the framework package.
// Email-specific display logic (field labels, cell renderers) lives in the backend's
// BaseComponentGenerator — no overrides needed here.
export { cn, applySchema, groupItems, fieldLabel, formatDate } from "@malleable/react"
