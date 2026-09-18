import { Handle, Position, type Node, type NodeProps } from '@xyflow/react'
import { BookOpen } from 'lucide-react'
import { memo } from 'react'

import { getAccentTokens, resolveAccent } from '../../lib/accent'
import type { PaperNodeData, PaperReadStatus } from '../../lib/paper'
import { useNodeScreenWidth } from '../../lib/useNodeScreenWidth'

export type PaperNode = Node<PaperNodeData, 'paper'>

// Same thresholds as CrEntityNode — one canvas-wide semantic zoom contract.
const PREVIEW_MIN_SCREEN_WIDTH = 200
const COMPACT_MIN_SCREEN_WIDTH = 90

function ReadStatusBadge({ status }: { status: PaperReadStatus }) {
  if (status === 'read') {
    return <span className="bg-success-bg text-success rounded px-1.5 py-0.5 text-[10px] font-medium">read</span>
  }
  if (status === 'reading') {
    return <span className="bg-info-bg text-info rounded px-1.5 py-0.5 text-[10px] font-medium">reading</span>
  }
  return <span className="text-fg-subtle rounded px-1.5 py-0.5 text-[10px] font-medium">unread</span>
}

/**
 * One node per paper, ported from Huabu's PDFNode + PreviewCard
 * (apps/web/src/components/Nodes/pdf/PDFNode.tsx, ../PreviewCard.tsx):
 * cover image (top-cropped, no placeholder graphic when absent — the info
 * area just starts immediately) → accent-tinted divider → floating icon +
 * title wrapping under it → metadata row → abstract → status/tag footer.
 */
export const PaperNode = memo(({ id, data, selected }: NodeProps<PaperNode>) => {
  const screenWidth = useNodeScreenWidth(id)
  const accentColor = resolveAccent(data.accent)
  const accentTokens = accentColor ? getAccentTokens(accentColor) : null

  const lod: 'preview' | 'compact' | 'mark' =
    screenWidth >= PREVIEW_MIN_SCREEN_WIDTH
      ? 'preview'
      : screenWidth >= COMPACT_MIN_SCREEN_WIDTH
        ? 'compact'
        : 'mark'

  const handles = (
    <>
      <Handle
        type="target"
        position={Position.Left}
        className={lod === 'mark' ? 'opacity-0' : '!bg-edge-default !h-2 !w-2'}
      />
      <Handle
        type="source"
        position={Position.Right}
        className={lod === 'mark' ? 'opacity-0' : '!bg-edge-default !h-2 !w-2'}
      />
    </>
  )

  if (lod === 'mark') {
    return (
      <div
        className="flex h-full w-full items-center justify-center rounded-full border-3"
        style={{ background: accentTokens?.bg, borderColor: accentTokens?.border }}
        title={data.title}
      >
        <BookOpen size={14} style={{ color: accentTokens?.fg }} />
        {handles}
      </div>
    )
  }

  return (
    <div
      className={
        'bg-surface group relative flex h-full w-full flex-col overflow-hidden rounded-lg border-3 transition-shadow duration-120 ' +
        (selected ? 'shadow-md' : 'ring-edge-default hover:shadow-sm hover:ring')
      }
      style={{ borderColor: selected ? 'var(--info)' : (accentTokens?.border ?? 'var(--edge-default)') }}
    >
      {handles}

      {lod === 'preview' && data.coverUrl && (
        <img
          src={data.coverUrl}
          alt=""
          className="bg-bg-default w-full shrink object-cover"
          style={{ height: 88, objectPosition: 'top' }}
          loading="lazy"
          draggable={false}
          onError={(e) => {
            e.currentTarget.style.display = 'none'
          }}
        />
      )}

      <div
        className="flex min-h-0 flex-1 flex-col"
        style={{ borderTop: `2px solid ${accentTokens?.divider ?? 'var(--edge-default)'}`, background: accentTokens?.softBg }}
      >
        <div className="min-w-0 shrink-0 px-3 pt-2">
          <div className="float-left mr-1.5 flex translate-y-0.5 items-center" style={{ color: accentTokens?.fg }}>
            <BookOpen size={14} />
          </div>
          {lod === 'preview' ? (
            <span
              className="text-fg-default min-w-0 text-[13px] leading-snug font-medium wrap-break-word"
              style={{ color: accentTokens?.fg }}
            >
              {data.title}
            </span>
          ) : (
            <span className="text-fg-default block truncate text-[12px] leading-snug font-medium" style={{ color: accentTokens?.fg }}>
              {data.title}
            </span>
          )}
        </div>

        {lod === 'preview' && (
          <div className="text-fg-muted px-3 pt-1 text-[10.5px] leading-snug">
            {data.authors.slice(0, 3).join(', ')}
            {data.authors.length > 3 && ' et al.'}
            {' · '}
            {data.venue} · {data.year}
          </div>
        )}

        {lod === 'preview' && data.abstract && (
          <div className="text-fg-muted line-clamp-3 px-3 pt-1.5 pb-2 text-[11.5px] leading-snug wrap-break-word">
            {data.abstract}
          </div>
        )}

        {lod === 'preview' && (
          <div
            className="border-edge-default text-fg-subtle mt-auto flex items-center gap-2 border-t px-3 py-1.5 text-[10px]"
            style={{ borderTopColor: accentTokens?.divider }}
          >
            <ReadStatusBadge status={data.readStatus} />
            {data.tags.slice(0, 2).map((tag) => (
              <span key={tag} className="bg-hover rounded px-1.5 py-0.5">
                {tag}
              </span>
            ))}
            <span className="ml-auto">
              {data.pageCount != null && `${data.pageCount}p`}
              {data.citedByCount != null && ` · cited ${data.citedByCount}`}
            </span>
          </div>
        )}
      </div>
    </div>
  )
})
PaperNode.displayName = 'PaperNode'
