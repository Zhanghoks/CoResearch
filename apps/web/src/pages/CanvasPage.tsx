// Route `/canvas/:canvasId` — API-backed canvas with note editing.
//
// Ticket 05: create/move/edit/delete notes persist through POST /execute,
// Realtime INSERT on canvas_deltas is the fast path, and a version gap
// triggers GET .../deltas catch-up (ADR 0002).

import { applyDeltas, type Delta } from '@coresearch/engine'
import { nextSyncAction, type WireCanvasNode } from '@coresearch/shared'
import { useEdgesState, useNodesState, type Edge } from '@xyflow/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { executeCanvas, getCanvas, getCanvasDeltas, type CanvasSnapshot } from '../api/canvas'
import { acceptCandidate } from '../api/candidates'
import { ApiError } from '../api/_client'
import { Canvas, type CanvasNode } from '../components/Canvas/Canvas'
import { Header } from '../components/Layout/Header'
import { LeftPanel } from '../components/Layout/LeftPanel'
import { ResizeHandle } from '../components/Layout/ResizeHandle'
import { RightPanel } from '../components/Layout/RightPanel'
import { supabase } from '../lib/supabase'
import { useResizableWidth } from '../lib/useResizableWidth'
import { AppLoadingScreen } from './AppLoadingScreen'

import type { CrEntityNode } from '../data/seedGraph'

function toFlow(nodes: WireCanvasNode[]): CanvasNode[] {
  return nodes.map((n) => ({
    id: n.id,
    type: n.type,
    position: n.position,
    parentId: n.parentId ?? undefined,
    data: n.data,
    style: {
      width: n.width ?? 240,
      height: n.height ?? 140,
    },
    zIndex: n.zIndex ?? undefined,
  })) as CanvasNode[]
}

function asDeltas(value: unknown): Delta[] {
  return Array.isArray(value) ? (value as Delta[]) : []
}

export default function CanvasPage() {
  const { canvasId } = useParams<{ canvasId: string }>()
  const navigate = useNavigate()
  const [snapshot, setSnapshot] = useState<CanvasSnapshot | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [nodes, setNodes, onNodesChange] = useNodesState<CanvasNode>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const [editing, setEditing] = useState<{ id: string; content: string } | null>(null)
  const versionRef = useRef(0)
  const [isLeftCollapsed, setLeftCollapsed] = useState(false)
  const [isRightCollapsed, setRightCollapsed] = useState(false)
  const left = useResizableWidth({ defaultWidth: 260, min: 200, max: 420 })
  const right = useResizableWidth({ defaultWidth: 380, min: 280, max: 520, anchor: 'right' })

  const applyRemoteDeltas = useCallback((deltas: Delta[], toVersion: number) => {
    setNodes((current) => {
      const next = applyDeltas({ nodes: current, edges: [] }, deltas)
      const live = new Map(current.map((n) => [n.id, n]))
      return next.nodes.map((n) => {
        const prev = live.get(n.id)
        if (!prev) return n as CanvasNode
        return {
          ...n,
          selected: prev.selected,
          dragging: prev.dragging,
          measured: prev.measured,
          resizing: prev.resizing,
        } as CanvasNode
      })
    })
    setEdges((current) => applyDeltas({ nodes: [], edges: current }, deltas).edges as Edge[])
    versionRef.current = toVersion
  }, [setEdges, setNodes])

  const catchUp = useCallback(
    async (id: string) => {
      const log = await getCanvasDeltas(id, versionRef.current)
      for (const entry of log.entries) {
        applyRemoteDeltas(asDeltas(entry.deltas), entry.toVersion)
      }
    },
    [applyRemoteDeltas],
  )

  useEffect(() => {
    if (!canvasId) {
      setError('缺少画布 id')
      return
    }
    let cancelled = false
    setSnapshot(null)
    setError(null)
    getCanvas(canvasId)
      .then((loaded) => {
        if (cancelled) return
        setSnapshot(loaded)
        setNodes(toFlow(loaded.nodes))
        setEdges(
          loaded.edges.map((e) => ({
            id: e.id,
            source: e.source,
            target: e.target,
          })),
        )
        versionRef.current = loaded.version
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
  }, [canvasId, setEdges, setNodes])

  useEffect(() => {
    if (!canvasId) return
    const channel = supabase
      .channel(`canvas-deltas:${canvasId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'canvas_deltas',
          filter: `canvas_id=eq.${canvasId}`,
        },
        (payload) => {
          const row = payload.new as {
            from_version: number
            to_version: number
            deltas: unknown
          }
          const action = nextSyncAction(
            versionRef.current,
            Number(row.from_version),
            Number(row.to_version),
          )
          if (action === 'ignore') return
          if (action === 'apply') {
            applyRemoteDeltas(asDeltas(row.deltas), Number(row.to_version))
            return
          }
          void catchUp(canvasId)
        },
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [applyRemoteDeltas, canvasId, catchUp])

  async function run(commands: Parameters<typeof executeCanvas>[1]) {
    if (!canvasId) return
    try {
      const result = await executeCanvas(canvasId, commands)
      if (result.deltas.length > 0) {
        applyRemoteDeltas(asDeltas(result.deltas), result.version)
      } else {
        versionRef.current = result.version
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

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
            onNodeDoubleClick={(_e, node) => {
              if (node.type !== 'note') return
              const content =
                typeof node.data.content === 'string' ? node.data.content : ''
              setEditing({ id: node.id, content })
            }}
            onPaneDoubleClick={(position) => {
              void run([
                {
                  type: 'CREATE_NODES',
                  nodes: [
                    {
                      nodeType: 'note',
                      position,
                      data: { content: '' },
                      size: { width: 240, height: 140 },
                    },
                  ],
                },
              ])
            }}
            onNodeDragStop={(_e, node) => {
              void run([
                {
                  type: 'SET_NODE_GEOMETRY',
                  items: [{ nodeId: node.id, position: node.position }],
                },
              ])
            }}
            onNodesDelete={(deleted) => {
              void run([
                {
                  type: 'DELETE_NODES',
                  nodeIds: deleted.map((n) => n.id),
                },
              ])
            }}
            onCandidateDrop={(candidate, position) => {
              if (!canvasId) return
              void acceptCandidate(
                snapshot.projectId,
                candidate.candidateId,
                canvasId,
                position,
              )
                .then((result) => {
                  if (result.deltas.length > 0) {
                    applyRemoteDeltas(asDeltas(result.deltas), result.version)
                  } else {
                    versionRef.current = result.version
                  }
                })
                .catch((err: unknown) => {
                  setError(err instanceof Error ? err.message : String(err))
                })
            }}
          />
        </div>
        {!isRightCollapsed && (
          <div style={{ width: right.width }} className="relative shrink-0">
            <ResizeHandle side="left" {...right.handleProps} isResizing={right.isResizing} />
            <RightPanel
              selectedNode={null}
              detailRequested={0}
              projectId={snapshot.projectId}
              onResearchChanged={() => {
                if (!canvasId) return
                void getCanvas(canvasId).then((loaded) => {
                  setSnapshot(loaded)
                  setNodes(toFlow(loaded.nodes))
                  versionRef.current = loaded.version
                })
              }}
            />
          </div>
        )}
      </div>
      {editing && (
        <div className="border-edge-default bg-bg-surface absolute right-8 bottom-8 left-8 z-20 rounded-md border p-3 shadow-md">
          <textarea
            className="text-fg-default h-24 w-full resize-none text-sm outline-none"
            value={editing.content}
            onChange={(e) => setEditing({ ...editing, content: e.target.value })}
            autoFocus
          />
          <div className="mt-2 flex justify-end gap-2">
            <button
              className="text-fg-muted text-sm"
              onClick={() => setEditing(null)}
            >
              取消
            </button>
            <button
              className="text-fg-default text-sm underline"
              onClick={() => {
                const { id, content } = editing
                setEditing(null)
                void run([
                  {
                    type: 'MERGE_NODE_DATA',
                    patches: [{ nodeId: id, patch: { content } }],
                  },
                ])
              }}
            >
              保存
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
