import {
  Background,
  BackgroundVariant,
  Controls,
  ReactFlow,
  type Edge,
  type Node,
  type NodeMouseHandler,
  type OnConnect,
  type OnEdgesChange,
  type OnNodeDrag,
  type OnNodesChange,
  type OnNodesDelete,
  type ReactFlowInstance,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useRef } from 'react'

import type { CrEntityNode as CrEntityNodeType, FrameNode as FrameNodeType } from '../../data/seedGraph'
import { CrEntityNode } from '../Nodes/CrEntityNode'
import { FrameNode } from '../Nodes/FrameNode'
import { NoteNode, type NoteFlowNode } from '../Nodes/NoteNode'
import { PaperNode, type PaperNode as PaperNodeType } from '../Nodes/PaperNode'

const nodeTypes = { crEntity: CrEntityNode, frame: FrameNode, paper: PaperNode, note: NoteNode }

export type CanvasNode = CrEntityNodeType | FrameNodeType | PaperNodeType | NoteFlowNode

interface CanvasProps<N extends Node = CanvasNode> {
  nodes: N[]
  edges: Edge[]
  focusNodeId?: string | null
  onNodesChange: OnNodesChange<N>
  onEdgesChange: OnEdgesChange
  onConnect: OnConnect
  onNodeClick: NodeMouseHandler<N>
  onNodeDoubleClick: NodeMouseHandler<N>
  onPaneDoubleClick?: (position: { x: number; y: number }) => void
  onNodeDragStop?: OnNodeDrag<N>
  onNodesDelete?: OnNodesDelete<N>
}

export function Canvas<N extends Node = CanvasNode>({
  nodes,
  edges,
  focusNodeId,
  onNodesChange,
  onEdgesChange,
  onConnect,
  onNodeClick,
  onNodeDoubleClick,
  onPaneDoubleClick,
  onNodeDragStop,
  onNodesDelete,
}: CanvasProps<N>) {
  const rf = useRef<ReactFlowInstance<N, Edge> | null>(null)
  const lastPaneClick = useRef(0)

  return (
    <div className="bg-bg-default relative h-full w-full" data-canvas-root>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onNodeDoubleClick={onNodeDoubleClick}
        onNodeDragStop={onNodeDragStop}
        onNodesDelete={onNodesDelete}
        onPaneClick={(event) => {
          if (!onPaneDoubleClick || !rf.current) return
          const now = Date.now()
          if (now - lastPaneClick.current > 350) {
            lastPaneClick.current = now
            return
          }
          lastPaneClick.current = 0
          onPaneDoubleClick(
            rf.current.screenToFlowPosition({ x: event.clientX, y: event.clientY }),
          )
        }}
        onInit={(instance) => {
          rf.current = instance
          if (!focusNodeId) return
          void instance.fitView({ nodes: [{ id: focusNodeId }], padding: 1.6, maxZoom: 1, duration: 400 })
        }}
        deleteKeyCode={['Backspace', 'Delete']}
        zoomOnDoubleClick={false}
        minZoom={0.1}
        maxZoom={2}
        fitView
        fitViewOptions={{ padding: 0.15, maxZoom: 1 }}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1.2} color="var(--canvas-grid)" />
        <Controls showInteractive={false} />
      </ReactFlow>
      <div className="text-fg-subtle pointer-events-none absolute bottom-3 left-3 text-[11px]">
        双击空白处新建笔记 · 拖动移动 · Delete 删除
      </div>
    </div>
  )
}
