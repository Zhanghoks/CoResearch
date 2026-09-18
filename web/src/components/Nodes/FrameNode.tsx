import type { NodeProps } from '@xyflow/react'
import { memo } from 'react'

import { getAccentTokens, resolveAccent } from '../../lib/accent'
import type { FrameNode as FrameNodeType } from '../../data/seedGraph'

export const FrameNode = memo(({ data, selected }: NodeProps<FrameNodeType>) => {
  const accentColor = resolveAccent(data.accent)
  const accentTokens = accentColor ? getAccentTokens(accentColor) : null

  return (
    <div
      className="h-full w-full rounded-xl border-2 border-dashed"
      style={{
        borderColor: selected ? 'var(--info)' : (accentTokens?.divider ?? 'var(--edge-default)'),
        background: accentTokens?.softBg ?? 'transparent',
      }}
    >
      <div
        className="w-fit rounded-br-md rounded-tl-lg px-2.5 py-1 text-[11px] font-semibold tracking-wide uppercase"
        style={{ background: accentTokens?.bg, color: accentTokens?.fg }}
      >
        {data.label}
      </div>
    </div>
  )
})
FrameNode.displayName = 'FrameNode'
