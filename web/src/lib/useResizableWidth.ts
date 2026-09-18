import { useCallback, useRef, useState } from 'react'

interface ResizableWidthOptions {
  defaultWidth: number
  min: number
  max: number
  /**
   * Which edge of the panel is pinned to the screen (doesn't move) — i.e.
   * the edge *opposite* the handle. A left-hand panel (handle on its right
   * edge) grows when the handle moves *right*; a right-hand panel (handle
   * on its left edge) grows when the handle moves *left*. Defaults to
   * 'left' — the common case of a left-hand panel.
   */
  anchor?: 'left' | 'right'
}

/**
 * Drag-to-resize width, ported in spirit from Huabu's `MainLayout` side-panel
 * resizer: pointer capture on the handle, width clamped to [min, max],
 * suspended CSS transitions while dragging so the panel tracks 1:1.
 *
 * The drag-active flag lives in a ref, not state: a `pointermove` can fire
 * before React commits the `pointerdown` state update, and gating the move
 * handler on stale state would silently drop the first movement of a fast
 * drag.
 */
export function useResizableWidth({ defaultWidth, min, max, anchor = 'left' }: ResizableWidthOptions) {
  const [width, setWidth] = useState(defaultWidth)
  const [isResizing, setIsResizing] = useState(false)
  const dragRef = useRef({ active: false, x: 0, width: defaultWidth })

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault()
      dragRef.current = { active: true, x: e.clientX, width }
      setIsResizing(true)
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    },
    [width],
  )

  const sign = anchor === 'left' ? 1 : -1

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!dragRef.current.active) return
      const next = dragRef.current.width + sign * (e.clientX - dragRef.current.x)
      setWidth(Math.min(max, Math.max(min, next)))
    },
    [min, max, sign],
  )

  const onPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    dragRef.current.active = false
    setIsResizing(false)
    ;(e.target as HTMLElement).releasePointerCapture(e.pointerId)
  }, [])

  return {
    width,
    isResizing,
    handleProps: { onPointerDown, onPointerMove, onPointerUp },
  }
}
