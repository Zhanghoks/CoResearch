import { FilePenLine } from 'lucide-react'

import type { ProposalRecord } from '@coresearch/shared'

function changePreview(proposal: ProposalRecord): string {
  return proposal.changes
    .map((change) => {
      const after = change.after
      if (after && typeof after === 'object' && !Array.isArray(after)) {
        const rec = after as Record<string, unknown>
        if (typeof rec.text === 'string') return `${change.target}: ${rec.text}`
        if (typeof rec.summary === 'string') return `${change.target}: ${rec.summary}`
        if (typeof rec.title === 'string') return `${change.target}: ${rec.title}`
      }
      if (typeof after === 'string') return `${change.target}: ${after}`
      return change.target
    })
    .join(' · ')
}

export function ProposalCard({
  proposal,
  busy,
  onAccept,
  onReject,
}: {
  proposal: ProposalRecord
  busy?: boolean
  onAccept: (id: string) => void
  onReject: (id: string) => void
}) {
  return (
    <div className="bg-bg-default border-edge-default rounded-lg border p-2.5">
      <div className="mb-1 flex items-center gap-1.5">
        <div className="bg-ai-bg text-ai flex h-5 w-5 items-center justify-center rounded">
          <FilePenLine size={12} />
        </div>
        <span className="text-fg-subtle text-[10px] font-semibold tracking-wide uppercase">
          {proposal.kind} · rev {proposal.baseStateRevision}
        </span>
      </div>
      {proposal.rationale ? (
        <p className="text-fg-default text-[12.5px] font-medium">{proposal.rationale}</p>
      ) : (
        <p className="text-fg-default text-[12.5px] font-medium">Pending revision</p>
      )}
      <p className="text-fg-muted mt-1 text-[11.5px] leading-snug">{changePreview(proposal)}</p>
      <div className="mt-2 flex gap-1.5">
        <button
          type="button"
          disabled={busy}
          onClick={() => onAccept(proposal.id)}
          className="bg-info rounded-md px-2.5 py-1 text-[11.5px] font-medium text-white disabled:opacity-50"
        >
          Accept
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => onReject(proposal.id)}
          className="bg-hover text-fg-default rounded-md px-2.5 py-1 text-[11.5px] font-medium disabled:opacity-50"
        >
          Reject
        </button>
      </div>
    </div>
  )
}
