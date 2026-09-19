import clsx from 'clsx'
import type { PointerEventHandler } from 'react'

interface ResizeHandleProps {
  side: 'left' | 'right'
  isResizing: boolean
  onPointerDown: PointerEventHandler<HTMLDivElement>
  onPointerMove: PointerEventHandler<HTMLDivElement>
  onPointerUp: PointerEventHandler<HTMLDivElement>
}

/** Draggable rail for resizing an adjacent panel, ported in spirit from Huabu's `MainLayout`. */
export function ResizeHandle({ side, isResizing, onPointerDown, onPointerMove, onPointerUp }: ResizeHandleProps) {
  return (
    <div
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      role="separator"
      aria-orientation="vertical"
      title="拖拽调整宽度"
      className={clsx(
        'absolute top-0 z-10 h-full w-3 cursor-col-resize touch-none select-none',
        // `right-0` pins the strip's right edge to the panel's right edge, so
        // centering it ON that boundary (with the neighbouring pane) needs a
        // *positive* shift; `left-0` needs the mirror negative shift. Using
        // the same sign for both sides put the "right" rail entirely inside
        // the panel instead of straddling the border.
        side === 'right' ? 'right-0 translate-x-1/2' : 'left-0 -translate-x-1/2',
      )}
    >
      <div
        className={clsx(
          'mx-auto h-full w-[3px] transition-colors',
          isResizing ? 'bg-info' : 'bg-transparent hover:bg-info-light',
        )}
      />
    </div>
  )
}
