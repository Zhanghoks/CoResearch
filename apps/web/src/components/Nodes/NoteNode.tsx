import { type Node, type NodeProps } from '@xyflow/react'
import { memo } from 'react'

export type NoteFlowNode = Node<
  { content?: string; label?: string; type?: string },
  'note'
>

export const NoteNode = memo(({ data, selected }: NodeProps<NoteFlowNode>) => {
  const content = typeof data.content === 'string' ? data.content : ''
  const label = typeof data.label === 'string' ? data.label : 'Note'

  return (
    <div
      className={`bg-bg-surface rounded-md border px-3 py-2 shadow-sm ${
        selected ? 'border-info' : 'border-edge-default'
      }`}
      style={{ minWidth: 200, minHeight: 88 }}
    >
      <div className="text-fg-muted mb-1 text-[11px] tracking-wide uppercase">{label}</div>
      <div className="text-fg-default whitespace-pre-wrap text-sm leading-5">
        {content || <span className="text-fg-subtle">双击编辑…</span>}
      </div>
    </div>
  )
})
NoteNode.displayName = 'NoteNode'
