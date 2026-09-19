# Reopen ticket 01：恢复 `SET_FRAME_LAYOUT` 结构化 Frame 布局（且仅这一条）

- 状态：accepted（supersedes [ADR 0009](./0009-step-swimlane-lightweight-layout.md)）

[ADR 0009](./0009-step-swimlane-lightweight-layout.md) 判断 Step 泳道不需要 Huabu 的结构化 Frame 求解器，理由是"append-heavy，追加到列尾的简单算法就够"。这条判断漏想了两个会反复发生的真实场景：**删除中间节点后留下的空隙**（用户拒绝/归档一个候选后，同泳道后面的节点不会自动补位）和**节点高度随 revision 变化**（crEntity 节点的内容随实体更新变长/变短后，同列后续节点需要让位，Huabu 本身就有 `node-auto-height.md` 这套机制处理这个）。这两个场景要正确处理都需要碰撞检测和重排，靠 Research Projector 手写等于在业务层重新实现半个布局引擎，直接违反已经定下的边界：

```text
Research Projector = 决定"投影什么、投影到哪个容器"
Canvas Engine      = 决定"容器里的节点具体怎么排"
```

**决策**：reopen [ticket 01](../../.scratch/coresearch-saas-architecture/issues/01-canvas-engine-command-set.md)，命令集从 8 条恢复到 9 条，只加回 `SET_FRAME_LAYOUT`（源码核实：`packages/shared/src/canvas-engine/commands/setFrameLayout.ts`，参数 `{frameId, mode, gridCount?, gridRowCount?, sizing?, cells?}`，`mode ∈ FRAME_LAYOUT_MODES = ['free','column','row','grid']`，`sizing ∈ FRAME_SIZING_MODES = ['hug','manual']`）。**不恢复其他被砍的命令**（`ALIGN_NODES`/`DISTRIBUTE_NODES`/`REORDER_NODES`/`DISSOLVE_FRAME`/`SET_NODE_LOCKED`/`CHANGE_NODE_TYPE`/`APPLY_MEASURED_HEIGHT` 仍然砍）——`SET_FRAME_LAYOUT` 自带 `cells` 输入，track/cell 分配本身已经有明确入口，不需要连带恢复 `REORDER_NODES` 才能用。

**代码能力 ≠ V1 产品暴露能力**：Huabu 的 `gridLayout.ts`（`column`/`row`/`grid` 共用大量算法、track/cell 状态和转换逻辑）完整保留，不为了"V1 只需要 column"去裁源码、分叉出 CoResearch 私有 solver——分叉的维护成本远高于保留两个暂时用不到的 enum 值。V1 产品策略层（不是引擎层）只暴露 `free`/`column` 两种模式；Deep Dive 未来如果真的需要横向 Phase 序列（`Phase 1 → Phase 2 → Phase 3 → Frontier`），`row` 已经现成，不用第二次把 solver 接回来。

**Schema**（更正 [ADR 0008](./0008-canvas-canonical-storage-unified-nodes.md)/[ticket 18](../../.scratch/coresearch-saas-architecture/issues/18-canvas-state-canonical-storage-model.md) 的字段归属，源码核实 `frameColumn`/`frameRow` 持久化在**子节点自己的** data 上，不是 frame 节点自己的 data）：

```sql
-- frame 自身的布局配置：canvas_nodes.native_data（frame 类型节点）
{ layoutMode: 'free'|'column'|'row'|'grid', gridCount?, gridRowCount?, sizing?: 'hug'|'manual' }

-- 子节点在父 frame 布局中的位置状态：canvas_layout 新增两列
canvas_layout (
  node_id, x, y, width, height, z_order, pinned, collapsed,
  frame_column nullable,   -- 对应 Huabu 的 frameColumn，只有父是 structured frame 的子节点会有值
  frame_row nullable       -- 对应 frameRow
)
```

`frameColumn`/`frameRow` 是"这个子节点在父布局里的位置状态"，属于几何/布局范畴，不是"这是什么节点"的身份范畴——放进 `canvas_layout` 而不是 `canvas_nodes.native_data`，和 18 号"几何单独一张表"的既有原则一致。

**Hard Rule（并入 map.md Notes）**：**Frame containment 永远只是呈现层组织，从不隐含 Research Domain 语义。** `canvas_nodes.parent_node_id` 表达的是"这个节点被摆在哪个容器里"，`research_relations` 才是语义关系的唯一真值源。把一个 Hypothesis 拖进 Method Frame，最多表示"用户把这张卡摆到了 Method 区域"，不会自动产生 `Hypothesis --uses_method--> Method` 这条关系，也不会改变 `entityKind`。这条在恢复结构化 Frame 之后更容易被误解（"拖进去=变成了那个类型"），必须明确排除。

**Candidate accept 流程的简化**：[12 号](../../.scratch/coresearch-saas-architecture/issues/12-candidate-acceptance-flow-and-canvas-projection-lifecycle.md) 的事务里，客户端只需要传 `placement: { parentNodeId: <目标Frame的node id> }`，不需要算精确的 y 坐标——`CREATE_NODES` 把新节点挂到目标 Frame 下之后，批次末尾的结构化重排 pass（Huabu 原有的"批次末尾统一 pass"机制之一）自动把它归位到正确的纵向槽位。这条也回答了 12 号最初"placement 只带位置不带语义"的设计意图为什么现在更省事：客户端不用自己算冲突。

**对 Agent 权限没有回退**：Huabu 原版 `SET_FRAME_LAYOUT` 在 `AGENT_CANVAS_COMMAND_TYPES` 里（Agent 可调），但 [ADR 0007](./0007-agent-tool-set-drops-canvas-commands.md) 已经让 CoResearch 的 Agent 拿不到任何画布命令工具——这条 reopen 不影响那条决策，调用者仍然只有 UI 手势和系统投影器，不包括 Agent。

被拒绝的替代方案：维持 ADR 0009 的"append-only + 简单算法"。拒绝原因见上文两个漏想的场景。
