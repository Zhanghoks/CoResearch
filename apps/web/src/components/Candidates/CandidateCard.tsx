import { Compass } from 'lucide-react'

import type { CandidatePart } from '@coresearch/shared'

import { getAccentTokens, resolveAccent } from '../../lib/accent'
import { NODE_VISUALS } from '../../lib/nodeVisuals'
import type { ResearchEntityKind } from '../../lib/entity'

const CANDIDATE_MIME = 'application/x-coresearch-candidate'

export { CANDIDATE_MIME }

function titleOf(candidate: CandidatePart): string {
  if (candidate.payload && typeof candidate.payload === 'object') {
    const rec = candidate.payload as Record<string, unknown>
    if (typeof rec.title === 'string') return rec.title
    if (typeof rec.summary === 'string') return rec.summary
  }
  return candidate.kind
}

function summaryOf(candidate: CandidatePart): string | null {
  if (candidate.payload && typeof candidate.payload === 'object') {
    const rec = candidate.payload as Record<string, unknown>
    if (typeof rec.summary === 'string') return rec.summary
  }
  return null
}

export function CandidateCard({ candidate }: { candidate: CandidatePart }) {
  const kind = candidate.kind as ResearchEntityKind
  const visual = NODE_VISUALS[kind] ?? { icon: Compass, accent: 'teal' as const, typeLabel: candidate.kind.toUpperCase() }
  const Icon = visual.icon
  const accent = resolveAccent(visual.accent)
  const tokens = accent ? getAccentTokens(accent) : null
  const title = titleOf(candidate)
  const summary = summaryOf(candidate)

  return (
    <div
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData(CANDIDATE_MIME, JSON.stringify(candidate))
        event.dataTransfer.effectAllowed = 'copy'
      }}
      className="bg-bg-default border-edge-default cursor-grab rounded-lg border p-2.5 active:cursor-grabbing"
    >
      <div className="mb-1 flex items-center gap-1.5">
        <div
          className="flex h-5 w-5 items-center justify-center rounded"
          style={{ background: tokens?.bg, color: tokens?.fg }}
        >
          <Icon size={12} />
        </div>
        <span className="text-fg-subtle text-[10px] font-semibold tracking-wide uppercase">
          {visual.typeLabel} · candidate
        </span>
      </div>
      <div className="text-fg-default text-[12.5px] font-medium">{title}</div>
      {summary ? <p className="text-fg-muted mt-1 text-[11.5px] leading-snug">{summary}</p> : null}
      <div className="text-fg-subtle mt-1.5 text-[10.5px]">Drag onto the canvas to accept</div>
    </div>
  )
}
