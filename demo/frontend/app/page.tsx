import Link from "next/link"

const EXAMPLE_PROMPTS = [
  "Show me a heatmap of emails by project and day of week",
  "Group by urgency, hide anything older than a week",
  "Make this look like a task manager with due dates front and center",
]

export default function IntroPage() {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-6">
      <div className="max-w-lg w-full">
        {/* Logo mark */}
        <div className="flex items-center gap-2 mb-10">
          <div className="w-7 h-7 rounded bg-violet-600 flex items-center justify-center">
            <span className="text-white text-xs font-bold">M</span>
          </div>
          <span className="text-sm font-semibold text-zinc-500">N/A</span>
        </div>

        {/* Headline */}
        <h1 className="text-4xl font-bold text-zinc-900 leading-tight mb-3">
          Your inbox, your way
        </h1>

        {/* Subhead */}
        <p className="text-lg text-zinc-500 leading-relaxed mb-8">
          An AI-powered email client that reshapes itself around how you work.
          No settings. Just describe what you want.
        </p>

        {/* Example prompt chips */}
        <div className="flex flex-col gap-2 mb-8">
          {EXAMPLE_PROMPTS.map((prompt) => (
            <div
              key={prompt}
              className="px-4 py-2.5 rounded-lg border border-zinc-200 bg-zinc-50 text-sm text-zinc-600 font-mono"
            >
              &ldquo;{prompt}&rdquo;
            </div>
          ))}
        </div>

        {/* Explainer */}
        <p className="text-sm text-zinc-400 leading-relaxed mb-8">
          Switch personas to see different starting points. Chat with the AI to
          reshape any part of the interface. Inspect any element to target
          changes. Every change is a restore point.
        </p>

        {/* CTAs */}
        <div className="flex items-center gap-4">
          <Link
            href="/demo"
            className="inline-flex items-center px-5 py-2.5 rounded-lg bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 transition-colors"
          >
            Enter demo →
          </Link>
          <a
            href="https://na-landing.netlify.app"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-zinc-400 hover:text-zinc-600 transition-colors"
          >
            About this project ↗
          </a>
        </div>
      </div>
    </div>
  )
}
