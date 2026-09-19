# 01: Monorepo + 确定性首批 Schema

**What to build:** pnpm workspace（`apps/web`/`apps/api`/`apps/worker`、`packages/engine`/`packages/research`/`packages/shared`）+ 第一批 Supabase migration，**只建当前 V1–V4 需要、且已被决策/spec 锁定的表**（`projects`/`project_members`/`agent_threads`/`agent_messages`/`agent_runs`/`research_entities`/`research_entity_revisions`/`research_relations`/`proposals`/`canvases`/`canvas_nodes`/`canvas_layout`/`canvas_edges`/`canvas_projections`/`canvas_deltas`）。`usage_ledger`/`blobs`/`papers` 不进这批——它们在 [docs/spec/01-database-schema.md](../../../docs/spec/01-database-schema.md) §5 里自己标注"first-pass, not a locked decision"，且没有任何 V1–V4 ticket 需要它们，留到真正需要时再开 migration。

**Blocked by:** None（可以立即开始）。

**Status:** resolved

- [x] `pnpm install && pnpm typecheck` 在根目录跑通（各包目前允许是空实现）
- [x] `supabase/migrations/00000000000001_init.sql` 只包含上面列的表，`usage_ledger`/`blobs`/`papers` 不在其中
- [x] migration 顺序正确：`agent_messages` 先于 `research_entities`（后者的 `source_candidate_id` 外键依赖它）
- [x] 本地或 Supabase 项目上跑一次 migration 成功，无外键顺序错误

## Answer

pnpm workspace 落地：`apps/web`（原 `web/` 迁入，包名 `@coresearch/web`）+ `apps/api`/`apps/worker` + `packages/engine`/`research`/`shared`。根目录 `pnpm install && pnpm typecheck` 通过。空实现允许，所以 API 目前只有 `/healthz`，engine/research 是 `export {}` stub。`tsc` project references 先拿掉了——各包还互不 import，加上 `composite` 只会给空包制造噪音，真正互相引用时再加。

`00000000000001_init.sql` 只建锁定的 15 张表；`usage_ledger`/`blobs`/`papers` 明确不进这批。`agent_messages` 先于 `research_entities`，`source_candidate_id` 用建表后的 `ALTER TABLE ... ADD CONSTRAINT` 接到 `agent_messages(id)`。RLS / `coresearch_app` / Realtime publication 留给 [03](03-request-context-and-rls.md)。

Migration 没有走本地 Docker stack，是在托管项目上跑的：用 Supabase plugin 在 `Zhanghoks's Org`（free）的 `ap-southeast-1` 建了 `CoResearch`（ref `bpxlnucpdmunyvwjpjov`），`apply_migration` name=`init` 一次成功。核过 `information_schema`：15 张表都在，没有 `usage_ledger`/`blobs`/`papers`；`research_entities_source_candidate_fk` 指向 `agent_messages`。各表 `rls_enabled=false` 是这张 ticket 的预期，不是漏做。
