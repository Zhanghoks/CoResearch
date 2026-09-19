import { addEdge, useNodesState, useEdgesState, type NodeMouseHandler, type OnConnect } from '@xyflow/react'
import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { initialNodes, initialEdges, type CrEntityNode } from '../../data/seedGraph'
import { buildVisualEdge } from '../../lib/edgeVisual'
import type { ResearchEntityKind } from '../../lib/entity'
import { useResizableWidth } from '../../lib/useResizableWidth'
import { Canvas } from '../Canvas/Canvas'
import { Header } from '../Layout/Header'
import { LeftPanel } from '../Layout/LeftPanel'
import { ResizeHandle } from '../Layout/ResizeHandle'
import { RightPanel } from '../Layout/RightPanel'
import { HomePage, type OpenProjectIntent } from './HomePage'
import { NodeIntroPage } from './NodeIntroPage'

/**
 * The original static prototype: seed graph, node gallery, intro pages.
 *
 * It is no longer the app's front door — the real, API-backed flow
 * (login → ProjectsPage → ProjectCanvasPage) is. This is kept reachable
 * because ticket 05 ("Note 编辑 → DB → Realtime") is the slice that
 * replaces `data/seedGraph.ts` with real API data, and deleting the
 * reference design before then would lose the layout work it encodes.
 */

/** Which canvas node each node type maps to — used by NodeIntroPage's "view in canvas". */
const CANVAS_NODE_BY_KIND = new Map<ResearchEntityKind, string>(
  initialNodes.flatMap((node) => (node.type === 'crEntity' ? [[node.data.entityKind, node.id] as const] : [])),
)

export function PrototypeApp() {
  const navigate = useNavigate()
  const [project, setProject] = useState<{ title: string; focusNodeId: string | null } | null>(null)
  const [introKind, setIntroKind] = useState<ResearchEntityKind | null>(null)
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [detailRequested, setDetailRequested] = useState(0)
  const [isLeftCollapsed, setLeftCollapsed] = useState(false)
  const [isRightCollapsed, setRightCollapsed] = useState(false)
  const left = useResizableWidth({ defaultWidth: 260, min: 200, max: 420 })
  const right = useResizableWidth({ defaultWidth: 380, min: 280, max: 520, anchor: 'right' })

  const selectNode = useCallback(
    (id: string | null) => {
      setSelectedNodeId(id)
      setNodes((prev) => prev.map((n) => ({ ...n, selected: n.id === id })))
    },
    [setNodes],
  )

  const openProject = useCallback(
    ({ title, focusNodeId = null }: OpenProjectIntent = {}) => {
      setProject({ title: title?.trim() || '未命名研究', focusNodeId })
      selectNode(focusNodeId)
      if (focusNodeId) setDetailRequested((n) => n + 1)
    },
    [selectNode],
  )

  const handleConnect: OnConnect = useCallback(
    (connection) => setEdges((eds) => addEdge(buildVisualEdge(connection), eds)),
    [setEdges],
  )

  const handleNodeClick: NodeMouseHandler = useCallback((_e, node) => {
    setSelectedNodeId(node.type === 'crEntity' ? node.id : null)
  }, [])

  const handleNodeDoubleClick: NodeMouseHandler = useCallback((_e, node) => {
    if (node.type !== 'crEntity') return
    setSelectedNodeId(node.id)
    setDetailRequested((n) => n + 1)
  }, [])

  const crEntityNodes = nodes.filter((n): n is CrEntityNode => n.type === 'crEntity')
  const selectedNode = crEntityNodes.find((n) => n.id === selectedNodeId) ?? null

  if (introKind) {
    return (
      <NodeIntroPage
        kind={introKind}
        onBack={() => setIntroKind(null)}
        onViewInCanvas={() => {
          openProject({ title: '交互效应归因', focusNodeId: CANVAS_NODE_BY_KIND.get(introKind) ?? null })
          setIntroKind(null)
        }}
      />
    )
  }

  if (!project)
    return (
      <HomePage
        onOpenProject={openProject}
        onViewNode={setIntroKind}
        onExit={() => void navigate('/projects')}
      />
    )

  return (
    <div className="flex h-full w-full flex-col">
      <Header
        title={project.title}
        isLeftCollapsed={isLeftCollapsed}
        isRightCollapsed={isRightCollapsed}
        onToggleLeft={() => setLeftCollapsed((v) => !v)}
        onToggleRight={() => setRightCollapsed((v) => !v)}
        onGoHome={() => setProject(null)}
      />
      <div className="flex min-h-0 flex-1">
        {!isLeftCollapsed && (
          <div style={{ width: left.width }} className="relative shrink-0">
            <LeftPanel nodes={crEntityNodes} selectedNodeId={selectedNodeId} onSelect={selectNode} />
            <ResizeHandle side="right" {...left.handleProps} isResizing={left.isResizing} />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <Canvas
            nodes={nodes}
            edges={edges}
            focusNodeId={project.focusNodeId}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={handleConnect}
            onNodeClick={handleNodeClick}
            onNodeDoubleClick={handleNodeDoubleClick}
          />
        </div>
        {!isRightCollapsed && (
          <div style={{ width: right.width }} className="relative shrink-0">
            <ResizeHandle side="left" {...right.handleProps} isResizing={right.isResizing} />
            <RightPanel selectedNode={selectedNode} detailRequested={detailRequested} />
          </div>
        )}
      </div>
    </div>
  )
}
