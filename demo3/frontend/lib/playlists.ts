import type { Playlist, UISchema } from "./types"

export interface PlaylistDef extends Playlist {
  schema: UISchema
}

export const PLAYLISTS: PlaylistDef[] = [
  {
    id: "chill-vibes",
    name: "Chill Vibes",
    description: "Lo-fi beats and ambient sounds",
    color: "violet",
    track_count: 5,
    schema: {
      layout: "list",
      data_source: "list_tracks",
      group_by: null,
      sort_by: "title",
      sort_direction: "asc",
      card_fields: ["title", "artist", "genre", "duration_sec"],
      filters: [],
      actions: [],
    },
  },
  {
    id: "focus-flow",
    name: "Focus Flow",
    description: "Instrumental tracks for deep work",
    color: "blue",
    track_count: 5,
    schema: {
      layout: "list",
      data_source: "list_tracks",
      group_by: null,
      sort_by: "bpm",
      sort_direction: "asc",
      card_fields: ["title", "artist", "bpm", "duration_sec"],
      filters: [],
      actions: [],
    },
  },
  {
    id: "energy-boost",
    name: "Energy Boost",
    description: "High-BPM tracks for working out",
    color: "orange",
    track_count: 6,
    schema: {
      layout: "kanban",
      data_source: "list_tracks",
      group_by: "bpm_bucket",
      sort_by: "bpm",
      sort_direction: "desc",
      card_fields: ["title", "artist", "bpm", "genre"],
      filters: [],
      actions: [],
    },
  },
  {
    id: "late-night-jazz",
    name: "Late Night Jazz",
    description: "Smooth jazz and soul for late nights",
    color: "emerald",
    track_count: 5,
    schema: {
      layout: "table",
      data_source: "list_tracks",
      group_by: null,
      sort_by: "artist",
      sort_direction: "asc",
      card_fields: ["title", "artist", "album", "bpm", "duration_sec"],
      filters: [],
      actions: [],
    },
  },
]

export const ALL_TRACKS_PLAYLIST: PlaylistDef = {
  id: "all",
  name: "All Tracks",
  description: "Every track in your library",
  color: "zinc",
  track_count: 21,
  schema: {
    layout: "list",
    data_source: "all_tracks",
    group_by: null,
    sort_by: "artist",
    sort_direction: "asc",
    card_fields: ["title", "artist", "album", "genre", "bpm", "duration_sec"],
    filters: [],
    actions: [],
  },
}
