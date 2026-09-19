import { Handle, Position, type NodeProps } from '@xyflow/react'
import { memo } from 'react'

import type { CrEntityNode as CrEntityNodeType } from '../../data/seedGraph'
import { useNodeScreenWidth } from '../../lib/useNodeScreenWidth'
import { EntityCard, type EntityLod } from './EntityCard'

// Semantic zoom thresholds, ported from
// docs/design/canvas/huabu-node-presentation-and-links.md §5.
const PREVIEW_MIN_SCREEN_WIDTH = 180
const COMPACT_MIN_SCREEN_WIDTH = 90

export const CrEntityNode = memo(({ id, data, selected }: NodeProps<CrEntityNodeType>) => {
  const screenWidth = useNodeScreenWidth(id)

  const lod: EntityLod =
    screenWidth >= PREVIEW_MIN_SCREEN_WIDTH
      ? 'preview'
      : screenWidth >= COMPACT_MIN_SCREEN_WIDTH
        ? 'compact'
        : 'mark'

  return (
    <EntityCard data={data} lod={lod} selected={selected}>
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
    </EntityCard>
  )
})
CrEntityNode.displayName = 'CrEntityNode'
