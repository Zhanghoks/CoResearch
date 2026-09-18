import clsx from 'clsx'
import type { ReactNode } from 'react'

import { getAccentTokens, resolveAccent } from '../../lib/accent'
import type { ResearchNodePresentation } from '../../lib/entity'
import { NODE_VISUALS } from '../../lib/nodeVisuals'

export type EntityLod = 'preview' | 'compact' | 'mark'

interface EntityCardProps {
  data: ResearchNodePresentation
  lod: EntityLod
  selected?: boolean
  /** Slot for xyflow handles — rendered inside the card root so they anchor to it. */
  children?: ReactNode
}

function StatusBadge({ data }: { data: ResearchNodePresentation }) {
  if (data.displayState === 'blocked') {
    return <span className="bg-danger-bg text-danger rounded px-1.5 py-0.5 text-[10px] font-medium">blocked</span>
  }
  if (data.stale) {
    return <span className="bg-warning-bg text-warning rounded px-1.5 py-0.5 text-[10px] font-medium">stale</span>
  }
  if (data.confirmed) {
    return <span className="bg-success-bg text-success rounded px-1.5 py-0.5 text-[10px] font-medium">confirmed</span>
  }
  return <span className="text-fg-subtle rounded px-1.5 py-0.5 text-[10px] font-medium">{data.status}</span>
}

/**
 * Presentational research node card — the same body the canvas renders, so the
 * home gallery and the canvas cannot drift apart.
 */
export function EntityCard({ data, lod, selected, children }: EntityCardProps) {
  const visual = NODE_VISUALS[data.entityKind]
  const Icon = visual.icon
  const accentColor = resolveAccent(visual.accent)
  const accentTokens = accentColor ? getAccentTokens(accentColor) : null

  if (lod === 'mark') {
    return (
      <div
        className="flex h-full w-full items-center justify-center rounded-full border-3"
        style={{ background: accentTokens?.bg, borderColor: accentTokens?.border }}
        title={data.title}
      >
        <Icon size={14} style={{ color: accentTokens?.fg }} />
        {children}
      </div>
    )
  }

  return (
    <div
      className={clsx(
        'group relative flex h-full w-full flex-col overflow-hidden rounded-lg border-3 transition-shadow duration-120',
        selected ? 'shadow-md' : 'ring-edge-default hover:shadow-sm hover:ring',
      )}
      style={{
        background: accentTokens?.bg ?? 'var(--bg-surface)',
        borderColor: selected ? 'var(--info)' : (accentTokens?.border ?? 'var(--edge-default)'),
      }}
    >
      {children}

      <div className="flex min-w-0 items-start gap-2 px-3 pt-2.5">
        <Icon size={15} className="mt-0.5 shrink-0" style={{ color: accentTokens?.fg }} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-semibold tracking-wide uppercase" style={{ color: accentTokens?.fg }}>
              {visual.typeLabel}
            </span>
            <StatusBadge data={data} />
          </div>
          {lod === 'preview' ? (
            <div className="text-fg-default mt-0.5 line-clamp-2 text-[13px] leading-snug font-medium wrap-break-word">
              {data.title}
            </div>
          ) : (
            <div className="text-fg-default mt-0.5 truncate text-[12px] leading-snug font-medium">{data.title}</div>
          )}
        </div>
      </div>

      {lod === 'preview' && data.summary && (
        <div className="text-fg-muted line-clamp-3 px-3 pt-1.5 pb-2.5 text-[11.5px] leading-snug wrap-break-word">
          {data.summary}
        </div>
      )}

      {lod === 'preview' && data.entityKind === 'seed' && data.seedDetail && (
        // Seed isn't proven by sources yet — it's the user's own framing — so
        // the footer reports scope breadth and how far exploration has gone
        // instead of source/unresolved counts.
        <div
          className="border-edge-default text-fg-subtle mt-auto flex items-center gap-3 border-t px-3 py-1.5 text-[10px]"
          style={{ borderTopColor: accentTokens?.divider }}
        >
          <span>{data.seedDetail.objects.length} 个核心对象</span>
          <span className="ml-auto">→ {data.seedDetail.directionCount} 个方向</span>
        </div>
      )}

      {lod === 'preview' && data.entityKind !== 'seed' && (
        <div
          className="border-edge-default text-fg-subtle mt-auto flex items-center gap-3 border-t px-3 py-1.5 text-[10px]"
          style={{ borderTopColor: accentTokens?.divider }}
        >
          {data.sourceCount > 0 && <span>sources {data.sourceCount}</span>}
          {data.relationCounts.unresolved > 0 && (
            <span className="text-warning">unresolved {data.relationCounts.unresolved}</span>
          )}
          <span className="ml-auto">
            {data.relationCounts.incoming}↦ ↦{data.relationCounts.outgoing}
          </span>
        </div>
      )}
    </div>
  )
}
