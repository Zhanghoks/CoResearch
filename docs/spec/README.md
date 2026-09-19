# CoResearch SaaS：阶段二实现级 Spec

阶段一（[决策地图](../../.scratch/coresearch-saas-architecture/map.md)，22 条决策，[docs/adr/](../adr/) 14 份 ADR）已完成。阶段二把这些决策拼成能直接照着写代码的实现文档，不引入新的架构判断——如果拼装过程中发现某处决策之间对不上或有缺口，回到地图补 ticket，不在这里现场拍板。

## 目录

- [01-database-schema.md](./01-database-schema.md) — 完整 Postgres schema（表、RLS、索引、约束），供第一批 migration 直接使用
- [02-api-contract.md](./02-api-contract.md) — API 端点清单（REST + SSE），请求/响应形状
- [03-canvas-engine-port.md](./03-canvas-engine-port.md) — Huabu 源码到 `packages/engine/` 的逐文件移植清单（`container/`/`frame/`/`height/` 三个子目录未逐文件核实，标注清楚）
- [04-research-domain-service.md](./04-research-domain-service.md) — Research Entity/Proposal 服务层函数签名
- [05-agent-runtime-worker.md](./05-agent-runtime-worker.md) — `createCoResearchAgentSession()` 完整实现 + 6 个工具的 `defineTool()` 签名 + 验收测试
- [06-web-integration-contract.md](./06-web-integration-contract.md) — 前端 hook/store 契约（`useCanvasSync`/`useAgentRunStream`）

**六份全部完成**（2026-09-19）。未决细节（分页参数、错误响应 schema、乐观更新回滚 UI 等）标在各文档末尾，不阻塞开工，实现时按需补。

每份文档头部注明来源 ADR/ticket，写法上"决策已经做了，这里只是把它翻译成 DDL/接口签名"——读者不应该在这里读到新的取舍论证，论证在 `docs/adr/` 里。
