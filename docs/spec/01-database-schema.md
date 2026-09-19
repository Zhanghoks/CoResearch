# CoResearch SaaS：数据库 Schema Spec

来源：[决策地图](../../.scratch/coresearch-saas-architecture/map.md) 全部 22 条决策，主要是 ADR 0003/0004/0005/0008/0009/0010/0011/0013 与 ticket 09/12/13/18/19。本文只做拼装和补齐字段级细节，不引入新的架构判断——拼装过程中发现的两处需要显式记录的简化，标在对应表下面。

不属于本文范围、需要单独一轮设计的：`papers`/`usage_ledger`/`blobs` 三张表在原草稿里提到过但从未被任何 ticket 完整定义字段——下面给的是**最小可用的第一版**，不是决策，阶段二后续或实现时可以直接改，不需要走 wayfinder。

## 0. 身份与角色（[ADR 0001](../adr/0001-hybrid-backend-supabase-as-infra.md)/[0013](../adr/0013-rls-policy-pattern.md)）

- 用户身份：Supabase Auth 的 `auth.users`，不建 `public.users` 镜像表——`auth.uid()` 和 `current_setting('app.current_user_id')::uuid`（见下）都直接引用它，V1 不需要额外的 profile 表；如果以后要存 display name/avatar 这类应用层 profile 字段，再加一张 `public.user_profiles(user_id references auth.users, ...)`。
- 数据库角色：`coresearch_app`（API 服务器连接，受 RLS 约束）、`authenticated`（Supabase 内置，仅 Realtime 订阅用）、`service_role`（Supabase 内置，`BYPASSRLS`，仅 projector/migration/system 路径）。
- **每个 `coresearch_app` 请求必须在同一事务里先执行**：
  ```sql
  SET LOCAL app.current_user_id = '<uuid>';
  ```
  这是所有下面 RLS 策略的前提，必须经 `withRequestContext(ctx, fn)` 包装函数强制，不允许裸连接查询（[ADR 0013](../adr/0013-rls-policy-pattern.md)）。

## 1. `projects` / `project_members`

```sql
CREATE TABLE projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES auth.users(id),
  title text NOT NULL,
  plan text NOT NULL DEFAULT 'free',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE project_members (
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  role text NOT NULL DEFAULT 'owner',  -- V1 只有 'owner'；协作角色留给未来效果
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, user_id)
);

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY coresearch_app_scope ON projects
  FOR ALL TO coresearch_app
  USING (id IN (SELECT project_id FROM project_members
                WHERE user_id = current_setting('app.current_user_id')::uuid));

CREATE POLICY coresearch_app_scope ON project_members
  FOR ALL TO coresearch_app
  USING (user_id = current_setting('app.current_user_id')::uuid
         OR project_id IN (SELECT project_id FROM project_members
                            WHERE user_id = current_setting('app.current_user_id')::uuid));
```

创建 Project 时同一事务里插入 `projects` 一行 + `project_members` 一行（`role='owner'`）——[ADR 0013](../adr/0013-rls-policy-pattern.md) 定的"现在就建 `project_members`，V1 只插一行"。

## 2. Research Domain（[ADR 0004](../adr/0004-candidate-vs-proposal-two-track-model.md)、ticket 11/13）

```sql
CREATE TYPE research_entity_kind AS ENUM (
  -- 原 15 种（huabu-reverse-engineering.md §10.3）
  'seed', 'direction', 'phase', 'focus', 'problem', 'claim', 'hypothesis',
  'prediction', 'work', 'question', 'probe', 'requirement', 'approach',
  'operation', 'component',
  -- 拼装时补的两种：Hard Constraint 9/10（Method/Evaluation 是独立语义对象，
  -- 文献版和用户版用 origin 区分）+ ticket 13 的 Trajectory 分类都需要它们是
  -- 一等 kind，原 15 种列表没有明确列出，这里补上
  'method', 'evaluation'
);

CREATE TABLE research_entities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  entity_kind research_entity_kind NOT NULL,
  current_revision int NOT NULL DEFAULT 1,
  content_hash text NOT NULL,          -- 当前 revision 内容的 hash，投影器用它判断 stale
  status text NOT NULL,                -- 原样携带各步骤自己的状态枚举，不跨 kind 归一（见 CONTEXT.md）
  origin text NOT NULL,                -- 'user' | 'agent' | 'literature' | 'system'
  confirmed boolean NOT NULL DEFAULT false,
  stale text NULL,                     -- StalenessReason | null；'upstream_revision_changed' 等
  summary text,
  payload jsonb NOT NULL DEFAULT '{}', -- kind 相关的具体字段（Statement、Mechanism、Predictions 等）
  source_candidate_id uuid NULL REFERENCES agent_messages(id),  -- 见下方说明
  branch_id uuid NULL,                 -- Phase 的分支分组（ticket 13）
  sequence_index int NULL,             -- Phase 在其 branch 内的顺序（ticket 13）
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, source_candidate_id)  -- 部分索引写法见下；accept 幂等的唯一防线（ticket 12）
);

-- UNIQUE (project_id, source_candidate_id) 在 source_candidate_id 为 NULL 时不生效（Postgres
-- 默认对 NULL 不做唯一约束比较），符合预期：不是从 Candidate 物化来的实体（比如投影器/system
-- 创建的）不需要参与这条幂等约束。

CREATE TABLE research_entity_revisions (
  entity_id uuid NOT NULL REFERENCES research_entities(id) ON DELETE CASCADE,
  revision int NOT NULL,
  payload jsonb NOT NULL,
  content_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by text NOT NULL,            -- 'user' | 'agent-proposal-accepted' | 'system'
  PRIMARY KEY (entity_id, revision)
);

CREATE TABLE research_relations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  from_entity_id uuid NOT NULL REFERENCES research_entities(id) ON DELETE CASCADE,
  to_entity_id uuid NOT NULL REFERENCES research_entities(id) ON DELETE CASCADE,
  relation_kind text NOT NULL,         -- 'motivates' | 'based_on' | 'supports' | 'challenges'
                                        -- | 'milestone_of'（Paper→Phase/Direction，ticket 13）| ...
  evidence_refs jsonb NOT NULL DEFAULT '[]',
  basis text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Proposal 定义直接复用 docs/design/idea-structure.md §3.1，字段原样，Track B
-- （ADR 0004）。kind 枚举比原文档多留了 direction/approach/research_question 三个
-- 槽位——原文档只列了 idea 内部维度修改，ADR 0004 已经说明已确认实体的后续修改
-- 统一走 Proposal，不止 idea 维度。
CREATE TABLE proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  entity_id uuid NOT NULL REFERENCES research_entities(id) ON DELETE CASCADE,
  base_state_revision int NOT NULL,    -- CAS：基于哪个 revision 提的
  kind text NOT NULL,                  -- 'clarification' | 'problem' | 'hypothesis' | 'revision'
                                        -- | 'pivot' | 'direction' | 'approach' | 'research_question'
  changes jsonb NOT NULL,              -- Array<{target, beforeStatementId, after}>
  rationale text,
  anchor_ids uuid[] NOT NULL DEFAULT '{}',
  alternative_group_id uuid NULL,
  status text NOT NULL DEFAULT 'pending',  -- 'pending' | 'accepted' | 'rejected' | 'superseded'
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE research_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE research_entity_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE research_relations ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposals ENABLE ROW LEVEL SECURITY;

CREATE POLICY coresearch_app_scope ON research_entities
  FOR ALL TO coresearch_app
  USING (project_id IN (SELECT project_id FROM project_members
                         WHERE user_id = current_setting('app.current_user_id')::uuid));
-- research_entity_revisions / research_relations / proposals 同一模式，
-- 通过各自的 entity_id/project_id 关联，此处从略，实现时复制这条策略。

CREATE INDEX ON research_entities (project_id, entity_kind);
CREATE INDEX ON research_relations (project_id, from_entity_id);
CREATE INDEX ON research_relations (project_id, to_entity_id);
CREATE INDEX ON proposals (entity_id) WHERE status = 'pending';
```

**拼装时的简化说明（`source_candidate_id`）**：ticket 12/20 原本设想 `CandidatePart.candidateId` 是独立生成的一个 id，和它所在的 `agent_messages` 行的 `id`（Pi `SessionEntry.id`）是两个不同的值。拼装时发现这是多余的——`CustomMessage` entry 本身已经有全局稳定的 `id`，没有理由再生成第二个。**简化决定：`candidateId` 就是那条 `custom` message 的 `agent_messages.id`**，`research_entities.source_candidate_id` 直接是一条真正的外键，不是一个"逻辑上对应但数据库层面无约束"的字符串字段。这条简化不改变任何已经定下的行为（回读候选、幂等约束、回填 `materialized` 字段全部照旧），只是去掉一个冗余 id。

## 3. Canvas（[ADR 0008](../adr/0008-canvas-canonical-storage-unified-nodes.md)/[0010](../adr/0010-restore-structured-frame-layout.md)）

```sql
CREATE TABLE canvases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'Main Canvas',
  version bigint NOT NULL DEFAULT 0,   -- 唯一权威版本计数器
  created_at timestamptz NOT NULL DEFAULT now()
);
-- V1 每个 project 创建时自动插入且仅插入一行（ADR 0003）。

CREATE TABLE canvas_nodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),  -- CREATE_NODES 服务端分配
  canvas_id uuid NOT NULL REFERENCES canvases(id) ON DELETE CASCADE,
  node_type text NOT NULL,             -- 'note' | 'frame' | 'pdf' | 'question' | 'web' | 'crEntity'
  parent_node_id uuid NULL REFERENCES canvas_nodes(id) ON DELETE SET NULL,
  native_data jsonb NOT NULL DEFAULT '{}',
  -- frame 类型：{ layoutMode: 'free'|'column'|'row'|'grid', gridCount?, gridRowCount?, sizing? }
  -- crEntity 类型：最多装画布层批注（userNote 等），绝不装语义内容
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE canvas_layout (
  node_id uuid PRIMARY KEY REFERENCES canvas_nodes(id) ON DELETE CASCADE,
  x double precision NOT NULL,
  y double precision NOT NULL,
  width double precision,
  height double precision,
  z_order int NOT NULL DEFAULT 0,
  pinned boolean NOT NULL DEFAULT false,
  collapsed boolean NOT NULL DEFAULT false,
  frame_column int NULL,               -- 父是 structured frame 时才有值（ADR 0010）
  frame_row int NULL
);

CREATE TABLE canvas_edges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  canvas_id uuid NOT NULL REFERENCES canvases(id) ON DELETE CASCADE,
  source_node_id uuid NOT NULL REFERENCES canvas_nodes(id) ON DELETE CASCADE,
  target_node_id uuid NOT NULL REFERENCES canvas_nodes(id) ON DELETE CASCADE,
  edge_type text NOT NULL DEFAULT 'visual',
  created_by text NOT NULL              -- 'user' | 'system'
);
-- 只存纯画布连线；研究关系边是查询时从 research_relations × canvas_projections 计算的虚拟边，不进这张表。

CREATE TABLE canvas_projections (
  node_id uuid PRIMARY KEY REFERENCES canvas_nodes(id) ON DELETE CASCADE,
  canvas_id uuid NOT NULL REFERENCES canvases(id) ON DELETE CASCADE,
  entity_id uuid NOT NULL REFERENCES research_entities(id) ON DELETE CASCADE,
  revision_policy text NOT NULL DEFAULT 'latest',  -- 'latest' | 'pinned'
  pinned_revision int NULL,
  projector_version int NOT NULL DEFAULT 1
  -- 不加 UNIQUE(canvas_id, entity_id)：同一实体允许多节点/多投影（ADR 0008）
);

CREATE TABLE canvas_deltas (
  id bigserial PRIMARY KEY,
  canvas_id uuid NOT NULL REFERENCES canvases(id) ON DELETE CASCADE,
  from_version bigint NOT NULL,
  to_version bigint NOT NULL,
  deltas jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE canvases ENABLE ROW LEVEL SECURITY;
ALTER TABLE canvas_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE canvas_layout ENABLE ROW LEVEL SECURITY;
ALTER TABLE canvas_edges ENABLE ROW LEVEL SECURITY;
ALTER TABLE canvas_projections ENABLE ROW LEVEL SECURITY;
ALTER TABLE canvas_deltas ENABLE ROW LEVEL SECURITY;

CREATE POLICY coresearch_app_scope ON canvases
  FOR ALL TO coresearch_app
  USING (project_id IN (SELECT project_id FROM project_members
                         WHERE user_id = current_setting('app.current_user_id')::uuid));
-- canvas_nodes/canvas_layout/canvas_edges/canvas_projections/canvas_deltas 同一模式，
-- 经各自的 canvas_id 关联到 canvases 再关联到 project_members，实现时复制。

-- canvas_deltas 额外的 Realtime 订阅策略（ADR 0013，唯一需要 authenticated 角色的表）：
CREATE POLICY authenticated_realtime_scope ON canvas_deltas
  FOR SELECT TO authenticated
  USING (canvas_id IN (
    SELECT c.id FROM canvases c
    JOIN project_members pm ON pm.project_id = c.project_id
    WHERE pm.user_id = auth.uid()
  ));

ALTER PUBLICATION supabase_realtime ADD TABLE canvas_deltas;

CREATE INDEX ON canvas_nodes (canvas_id, node_type);
CREATE INDEX ON canvas_nodes (parent_node_id);
CREATE INDEX ON canvas_deltas (canvas_id, to_version);
```

## 4. Agent Worker（[ADR 0006](../adr/0006-agent-worker-pi-coding-agent-sdk.md)/[0011](../adr/0011-agent-messages-store-pi-session-entries-directly.md)、ticket 19）

```sql
CREATE TABLE agent_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  pi_cwd text NOT NULL,                -- 传给 Pi SessionManager 的 cwd 标识符，非真实路径
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE agent_messages (
  id uuid PRIMARY KEY,                 -- = Pi SessionEntry.id（Worker 生成后带过来，不是 gen_random_uuid 默认）
  thread_id uuid NOT NULL REFERENCES agent_threads(id) ON DELETE CASCADE,
  parent_id uuid NULL,                 -- = Pi SessionEntry.parentId
  entry_type text NOT NULL,            -- = Pi SessionEntry.type
  payload jsonb NOT NULL,              -- 整条 SessionEntry 原样存
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE agent_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES agent_threads(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES projects(id),  -- 冗余，RLS 免 join
  status text NOT NULL DEFAULT 'queued',  -- 'queued' | 'running' | 'completed' | 'failed' | 'cancelled'
  lease_owner text NULL,
  lease_expires_at timestamptz NULL,
  heartbeat_at timestamptz NULL,
  cancel_requested boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz NULL,
  ended_at timestamptz NULL
);

ALTER TABLE agent_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY coresearch_app_scope ON agent_threads
  FOR ALL TO coresearch_app
  USING (project_id IN (SELECT project_id FROM project_members
                         WHERE user_id = current_setting('app.current_user_id')::uuid));
-- agent_messages 经 thread_id、agent_runs 经 project_id 直接关联，同一模式。

CREATE INDEX ON agent_messages (thread_id, created_at);
CREATE INDEX ON agent_runs (status, lease_expires_at) WHERE status IN ('queued', 'running');
```

Claim 查询（ticket 19，不是 migration 的一部分，落在 Worker 代码里）：

```sql
UPDATE agent_runs
SET status = 'running', lease_owner = $worker_id,
    lease_expires_at = now() + interval '45 seconds',
    heartbeat_at = now(), started_at = coalesce(started_at, now())
WHERE id = (
  SELECT id FROM agent_runs
  WHERE status = 'queued' OR (status = 'running' AND lease_expires_at < now())
  ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1
)
RETURNING *;
```

## 5. 计量与文件（首版，不是决策，实现时可直接改）

```sql
CREATE TABLE usage_ledger (
  id bigserial PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  run_id uuid NULL REFERENCES agent_runs(id),
  model text NOT NULL,
  input_tokens int NOT NULL,
  output_tokens int NOT NULL,
  cost_cents int NOT NULL,
  step text,                           -- Research Flow 步骤归因（原草稿 §1.7）
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE blobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  storage_key text NOT NULL,           -- Supabase Storage 路径
  mime text NOT NULL,
  bytes bigint NOT NULL,
  sha256 text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- papers 表：ticket 15 只做了外部 API 调研（Semantic Scholar/OpenAlex/Crossref/arXiv），
-- 没有定规范 schema。首版最小字段，DOI 为主键思路（ticket 15 结论）：
CREATE TABLE papers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  doi text NULL,
  arxiv_id text NULL,
  s2_paper_id text NULL,
  openalex_work_id text NULL,
  title text NOT NULL,
  authors jsonb NOT NULL DEFAULT '[]',
  published_at date,
  source_metadata jsonb NOT NULL DEFAULT '{}',  -- 各 provider 原始返回，供以后重新解析
  fetched_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, doi),
  UNIQUE (project_id, arxiv_id)
);

ALTER TABLE usage_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE blobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE papers ENABLE ROW LEVEL SECURITY;
-- 三张表同一 coresearch_app 按 project_id 过滤的策略，从略。
```

## 6. `service_role` 路径

投影器、迁移脚本、系统维护任务用 `service_role` 连接，天生 `BYPASSRLS`，不需要为它写策略（[ADR 0013](../adr/0013-rls-policy-pattern.md)）。任何"这条写入是不是应该被拒绝"的判断都必须落在**函数入口**（`executeAsProjector()` vs `executeFromRequest()` 分离，见 [ADR 0001](../adr/0001-hybrid-backend-supabase-as-infra.md)），不能靠 `service_role` 本身的权限强弱来区分——它对所有表都有完全权限，滥用它等于绕过所有业务规则。
