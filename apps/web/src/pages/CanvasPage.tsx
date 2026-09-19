// Route `/canvas/:canvasId` — the real, API-backed canvas.
//
// Structure follows Huabu's CanvasPage: the canvas id comes from the URL,
// not from props, so a deep link or a refresh loads the same board. The
// shell around it (Header / LeftPanel / Canvas / RightPanel) is
// CoResearch's own prototype layout, kept as-is.
//
// Ticket 04 only has to prove the EMPTY board loads and renders: the
// snapshot's nodes/edges stay empty until note editing (ticket 05) and
// candidate acceptance (ticket 06) put something on it. The prototype's
// editing handlers (connect, drag-to-persist) are deliberately not wired
// — there is no execute endpoint yet, so accepting edits here would
// silently drop them.

import { useEdgesState, useNodesState } from '@xyflow/react'
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import type { Edge } from '@xyflow/react'

import { getCanvas, type CanvasSnapshot } from '../api/canvas'
import { ApiError } from '../api/_client'
import { Canvas, type CanvasNode } from '../components/Canvas/Canvas'
import { Header } from '../components/Layout/Header'
import { LeftPanel } from '../components/Layout/LeftPanel'
import { ResizeHandle } from '../components/Layout/ResizeHandle'
import { RightPanel } from '../components/Layout/RightPanel'
import { useResizableWidth } from '../lib/useResizableWidth'
import { AppLoadingScreen } from './AppLoadingScreen'

import type { CrEntityNode } from '../data/seedGraph'

export default function CanvasPage() {
  const { canvasId } = useParams<{ canvasId: string }>()
  const navigate = useNavigate()
  const [snapshot, setSnapshot] = useState<CanvasSnapshot | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [nodes, , onNodesChange] = useNodesState<CanvasNode>([])
  const [edges, , onEdgesChange] = useEdgesState<Edge>([])
  const [isLeftCollapsed, setLeftCollapsed] = useState(false)
  const [isRightCollapsed, setRightCollapsed] = useState(false)
  const left = useResizableWidth({ defaultWidth: 260, min: 200, max: 420 })
  const right = useResizableWidth({ defaultWidth: 380, min: 280, max: 520, anchor: 'right' })

  useEffect(() => {
    if (!canvasId) return
    let cancelled = false
    setSnapshot(null)
    setError(null)
    getCanvas(canvasId)
      .then((loaded) => {
        if (!cancelled) setSnapshot(loaded)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setError(
          err instanceof ApiError && err.status === 404
            ? '找不到这个画布，或者它不属于你。'
            : err instanceof Error
              ? err.message
              : String(err),
        )
      })
    return () => {
      cancelled = true
    }
  }, [canvasId])

  if (error) {
    return (
      <div className="text-fg-muted flex h-full w-full flex-col items-center justify-center gap-3 text-sm">
        {error}
        <button
          onClick={() => void navigate('/projects')}
          className="text-fg-default underline underline-offset-4"
        >
          返回项目列表
        </button>
      </div>
    )
  }

  if (!snapshot) return <AppLoadingScreen message="加载画布…" />

  // Empty until ticket 05/06; the panel only renders research entities.
  const crEntityNodes = nodes.filter((n): n is CrEntityNode => n.type === 'crEntity')

  return (
    <div className="flex h-full w-full flex-col">
      <Header
        title={snapshot.projectTitle}
        isLeftCollapsed={isLeftCollapsed}
        isRightCollapsed={isRightCollapsed}
        onToggleLeft={() => setLeftCollapsed((v) => !v)}
        onToggleRight={() => setRightCollapsed((v) => !v)}
        onGoHome={() => void navigate('/projects')}
      />
      <div className="flex min-h-0 flex-1">
        {!isLeftCollapsed && (
          <div style={{ width: left.width }} className="relative shrink-0">
            <LeftPanel nodes={crEntityNodes} selectedNodeId={null} onSelect={() => {}} />
            <ResizeHandle side="right" {...left.handleProps} isResizing={left.isResizing} />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <Canvas
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={() => {}}
            onNodeClick={() => {}}
            onNodeDoubleClick={() => {}}
          />
        </div>
        {!isRightCollapsed && (
          <div style={{ width: right.width }} className="relative shrink-0">
            <ResizeHandle side="left" {...right.handleProps} isResizing={right.isResizing} />
            <RightPanel selectedNode={null} detailRequested={0} />
          </div>
        )}
      </div>
    </div>
  )
}
