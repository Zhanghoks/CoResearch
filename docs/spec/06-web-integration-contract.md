# CoResearch SaaS：Web 集成契约 Spec

来源：[ADR 0002](../adr/0002-canvas-concurrency-and-realtime-sync.md)/[0012](../adr/0012-agent-stream-transport-separate-from-canvas-realtime.md)、[ticket 12](../../.scratch/coresearch-saas-architecture/issues/12-candidate-acceptance-flow-and-canvas-projection-lifecycle.md)/[21](../../.scratch/coresearch-saas-architecture/issues/21-canvas-realtime-vs-agent-streaming-transport.md)。前端仓库位置沿用现有原型 `web/src`（`CrEntityNode.tsx`/`EntityCard.tsx`/`nodeVisuals.ts`/`useResizableWidth.ts` 等直接复用，见早期会话记录）。

## 1. 两个独立订阅 hook，不共用事件总线（ADR 0012 结论）

```ts
// useCanvasSync.ts —— Supabase Realtime，直连
export function useCanvasSync(canvasId: string) {
  useEffect(() => {
    let localVersion = 0;
    const channel = supabase
      .channel(`canvas:${canvasId}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'canvas_deltas', filter: `canvas_id=eq.${canvasId}` },
        (payload) => {
          const delta = payload.new;
          if (delta.from_version !== localVersion) {
            // gap 检测：fromVersion 和本地不连续，走 durable catch-up
            fetchDeltasSince(canvasId, localVersion).then(applyDeltas);
            return;
          }
          applyDeltas([delta]);
          localVersion = delta.to_version;
        })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [canvasId]);
}
// applyDeltas 版本门控（localVersion >= toVersion 跳过）逻辑照抄 Huabu，不因为传输层换了而改
```

```ts
// useAgentRunStream.ts —— API 自己的 SSE，不经 Supabase
export function useAgentRunStream(runId: string) {
  useEffect(() => {
    const es = new EventSource(`/api/runs/${runId}/stream`);
    for (const type of ['run.started', 'message.delta', 'message.completed',
                         'tool.started', 'tool.updated', 'tool.completed',
                         'run.completed', 'run.failed', 'run.cancelled']) {
      es.addEventListener(type, (e) => dispatchAgentEvent(type, JSON.parse(e.data)));
    }
    return () => es.close();
  }, [runId]);
}
// 断线重连后不补流式中间态——重新读 GET /api/threads/:threadId/messages 拿 durable 历史即可
```

## 2. Candidate 渲染与接受手势

```ts
interface CandidateCardProps {
  candidate: CandidatePart;  // 05-agent-runtime-worker.md 的 CandidatePart 形状，随 message.completed 事件带来
}

// 拖拽落到画布时：
async function onCandidateDrop(candidate: CandidatePart, canvasId: string, position: {x:number,y:number}, parentNodeId?: string) {
  const res = await fetch(`/api/projects/${projectId}/candidates/${candidate.candidateId}/accept`, {
    method: 'POST',
    body: JSON.stringify({ canvasId, placement: { parentNodeId, position } }),
  });
  const { entityId, nodeId } = await res.json();
  // 不需要客户端算精确 y 坐标——SET_FRAME_LAYOUT 的批次末尾重排 pass 会归位（ADR 0010）
  // 乐观更新：先在本地 canvas store 插入一个临时节点，useCanvasSync 的下一条 delta 会确认/纠正它
}
```

**候选卡片本身不是画布节点**——渲染在 Conversation/Agent 面板里，不在 xyflow 的节点树里。只有 accept 之后，`useCanvasSync` 收到的 `canvas_deltas` 才会让它以 `crEntity` 节点的形式出现在画布上。

## 3. UiIntent → Command（仅前端，沿用 Huabu 两层，V1 瘦身到实际手势）

```text
拖拽移动节点        → SET_NODE_GEOMETRY
框选 + 拖进 Frame    → SET_NODE_PARENT
手动连线            → CONNECT_NODES（created_by:'user'，写进 canvas_edges，不是研究关系）
删除节点            → DELETE_NODES
Frame 切换布局模式   → SET_FRAME_LAYOUT（V1 UI 只暴露 free/column 两个选项）
```

"拖候选卡片进画布"**不生成 UiIntent**，是 §2 的独立 API 调用，不进 `POST /api/canvases/:canvasId/execute` 的命令批次管线（[ticket 12](../../.scratch/coresearch-saas-architecture/issues/12-candidate-acceptance-flow-and-canvas-projection-lifecycle.md) 的既有结论）。

## 4. 状态管理边界

- `canvasStore`（zustand）：`canvas_nodes`/`canvas_layout`/`canvas_edges` 的本地镜像，被 `useCanvasSync` 驱动；用户手势先本地乐观应用一遍再 POST，拿到权威 delta 后以它为准（版本门控跳过旧的）。
- `agentRunStore`：当前 run 的流式状态（`isStreaming`/当前 partial message/tool 调用列表），被 `useAgentRunStream` 驱动，run 结束后清空，不长期持有。
- 两个 store 互不感知对方的内部状态，只在 UI 层组合渲染（比如 accept 按钮同时用到两边：候选来自 `agentRunStore`，接受后的乐观节点写进 `canvasStore`）。

## 5. 未决的实现细节（留给实现阶段，不是本文档要拍板的）

- `EntityCard`/`CrEntityNode` 现有原型组件具体怎么接 `entityKind` 到真实的托管字段（目前是静态 `seedGraph.ts` 数据）
- 移动端/响应式布局（未讨论过，大概率 V1 不做）
- 具体的乐观更新回滚 UI（POST 失败时怎么把乐观插入的节点撤回）
