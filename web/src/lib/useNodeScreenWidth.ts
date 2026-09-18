import { useStore, useViewport } from '@xyflow/react'

/**
 * Screen-space width of a node (canvas width × zoom), used to pick a
 * semantic-zoom LOD. Ported from Huabu's `useNodeLOD` — thresholds are
 * judged against what actually reaches the screen, not canvas coordinates,
 * so LOD stays consistent regardless of how far the user has panned.
 */
export function useNodeScreenWidth(id: string, fallbackWidth = 260) {
  const { zoom } = useViewport()
  const width = useStore((s) => {
    const node = s.nodeLookup.get(id)
    return (node?.measured?.width as number) || fallbackWidth
  })
  return width * zoom
}
