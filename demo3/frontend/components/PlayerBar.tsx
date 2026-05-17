"use client"
import type { Item } from "@/lib/types"
import { formatDuration } from "@/lib/utils"

interface Props {
  track: Item | null
  isPlaying: boolean
  progress: number      // 0–100
  currentTime: number   // seconds
  duration: number      // seconds
  onPlayPause: () => void
  onSeek: (pct: number) => void  // called with 0–100
}

export default function PlayerBar({
  track,
  isPlaying,
  progress,
  currentTime,
  duration,
  onPlayPause,
  onSeek,
}: Props) {
  if (!track) return null

  function handleProgressClick(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const pct = ((e.clientX - rect.left) / rect.width) * 100
    onSeek(Math.max(0, Math.min(100, pct)))
  }

  const title = String(track.title ?? "(untitled)")
  const artist = String(track.artist ?? "")

  return (
    <div className="flex-shrink-0 h-16 bg-white flex items-center px-4 gap-4 border-t border-zinc-200">
      {/* Track info */}
      <div className="flex flex-col min-w-0 w-36 flex-shrink-0">
        <span className="text-xs font-semibold text-zinc-900 truncate">{title}</span>
        <span className="text-[11px] text-zinc-400 truncate">{artist}</span>
      </div>

      {/* Center: play/pause + progress */}
      <div className="flex-1 flex flex-col items-center gap-1 min-w-0">
        <button
          onClick={onPlayPause}
          className="w-8 h-8 rounded-full bg-zinc-900 text-white flex items-center justify-center hover:bg-zinc-700 transition-colors flex-shrink-0"
          aria-label={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="4" width="4" height="16" rx="1"/>
              <rect x="14" y="4" width="4" height="16" rx="1"/>
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5,3 19,12 5,21"/>
            </svg>
          )}
        </button>

        <div className="flex items-center gap-2 w-full max-w-md">
          <span className="text-[10px] text-zinc-400 font-mono w-8 text-right flex-shrink-0">
            {formatDuration(Math.floor(currentTime))}
          </span>
          <div
            className="flex-1 h-1 bg-zinc-200 rounded-full cursor-pointer relative group"
            onClick={handleProgressClick}
          >
            <div
              className="h-full bg-emerald-500 rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />
            <div
              className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white border border-zinc-300 rounded-full shadow opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ left: `calc(${progress}% - 6px)` }}
            />
          </div>
          <span className="text-[10px] text-zinc-400 font-mono w-8 flex-shrink-0">
            {formatDuration(Math.floor(duration))}
          </span>
        </div>
      </div>

      {/* Right: empty spacer to balance layout */}
      <div className="w-36 flex-shrink-0 hidden md:block" />
    </div>
  )
}
