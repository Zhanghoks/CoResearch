import {
  Background,
  BackgroundVariant,
  Controls,
  ReactFlow,
  type Edge,
  type NodeMouseHandler,
  type OnConnect,
  type OnEdgesChange,
  type OnNodesChange,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import type { CrEntityNode as CrEntityNodeType, FrameNode as FrameNodeType } from '../../data/seedGraph'
import { CrEntityNode } from '../Nodes/CrEntityNode'
import { FrameNode } from '../Nodes/FrameNode'
import { PaperNode, type PaperNode as PaperNodeType } from '../Nodes/PaperNode'

const nodeTypes = { crEntity: CrEntityNode, frame: FrameNode, paper: PaperNode }

type CanvasNode = CrEntityNodeType | FrameNodeType | PaperNodeType

interface CanvasProps {
  nodes: CanvasNode[]
  edges: Edge[]
  /** When the project was opened from a home tile, centre on that node instead of fitting all. */
  focusNodeId?: string | null
  onNodesChange: OnNodesChange<CanvasNode>
  onEdgesChange: OnEdgesChange
  onConnect: OnConnect
  onNodeClick: NodeMouseHandler<CanvasNode>
  onNodeDoubleClick: NodeMouseHandler<CanvasNode>
}

export function Canvas({
  nodes,
  edges,
  focusNodeId,
  onNodesChange,
  onEdgesChange,
  onConnect,
  onNodeClick,
  onNodeDoubleClick,
}: CanvasProps) {
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
        onInit={(rf) => {
          if (!focusNodeId) return
          void rf.fitView({ nodes: [{ id: focusNodeId }], padding: 1.6, maxZoom: 1, duration: 400 })
        }}
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
    </div>
  )
}
