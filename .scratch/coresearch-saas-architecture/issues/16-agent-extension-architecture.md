# Agent Worker 运行时迁移到 `@earendil-works/pi-coding-agent` SDK

Type: grilling
Status: resolved

## Question

12 号讨论时带出的"Tool/Skill/Extension 分层"提议，第一版引用的 `botiverse/pi-coding-agent`、`openlark/skills` 核查后与 Huabu 实际依赖无关，被搁置。第二版指向的是同一个 `earendil-works` 组织下的官方 SDK 包 `@earendil-works/pi-coding-agent`——版本号（0.85.1）与 Huabu 已依赖的 `@earendil-works/pi-agent-core`/`pi-ai`（`Huabu-main/apps/server/package.json`）完全对齐，同一个 `pi-mono` monorepo。核查通过（见 Answer）。

需要确认：CoResearch 的 Agent Worker 要不要用这个官方 SDK 替代 Huabu 自研的 Agenetes + pi-driver 编排层；如果用，SaaS 多租户环境下哪些默认行为必须关掉/收窄。

## Answer

**核查结果**（`gh api repos/earendil-works/pi` + npm registry + `packages/coding-agent/docs/sdk.md` 原文核实，不是转述二手引用）：`@earendil-works/pi-coding-agent` 真实存在，MIT 协议，和 Huabu 已依赖的底层包同源同版本。Huabu 自己的代码里也有旁证——`apps/server/src/modules/agent/tools/definitions.ts:255` 的注释写"Tool names and parameter shapes mirror pi-coding-agent / Claude Code"，说明 Huabu 作者知道这个 SDK 存在，但选择了自己在 `pi-agent-core`/`pi-ai` 之上重新搭一层（Agenetes + pi-driver），没有直接依赖它。这不构成"不能用"的证据，但值得记录：采用官方 SDK 意味着放弃 Huabu 现成的 Agenetes 编排代码，改接一层新的第三方 SDK 表面。

**决策：采用**。Agent Worker（[ticket 03](03-agent-worker-process-boundary.md) 已定的独立进程）内部用 `@earendil-works/pi-coding-agent` 的 SDK 模式（`createAgentSession` 等programmatic API），不是 spawn 它的 CLI/TUI 二进制、不是走 stdin/stdout RPC。这不违反"V1 只保留内置 Agent"——这是内置 Agent 自己怎么实现的技术选型，不是新增外部 CLI Agent 接入。

**SaaS 多租户下必须收紧的默认行为**（详见 [ADR 0006](../../../docs/adr/0006-agent-worker-pi-coding-agent-sdk.md)）：
1. 自定义 `ResourceLoader`，不用 `DefaultResourceLoader` 的文件系统发现（`~/.pi/agent/extensions/`、`.pi/skills/`、`.agents/skills/` 等）——V1 只加载仓库内置、写死在代码里的 extension/tool/skill 集合。
2. **必须显式传 `tools: [...]` 白名单，且结构上不可能漏传**——源码核实 `sdk.ts:256` 默认是 `["read","bash","edit","write"]`。这条不能靠"记得传参数"，生产代码禁止直接调用 SDK 的 `createAgentSession()`，一律经过仓库自己的 `createCoResearchAgentSession()` 工厂函数，内部写死白名单并在返回前断言"暴露的工具集精确等于预声明的 allowlist"，不匹配就启动失败。这条已经是 Hard Constraint（map.md #14）。CoResearch 只启用 [14 号 ticket](14-agent-tool-write-permission-boundary.md) 定义的研究领域工具，用 `defineTool()`/`customTools` 注册。
3. Session 持久化：Postgres（`agent_threads`/`agent_messages`）是耐久真值，`SessionManager.inMemory()` 承载运行时状态；Worker 重启/崩溃后从 Postgres 恢复重建 in-memory session，不依赖 SDK 默认的 `~/.pi/agent/sessions/*.jsonl`。
4. 事件不直接透传给浏览器——中间加一层 adapter，把 SDK 的事件词汇（`tool_execution_start/update/end`、`message_start/end`、`turn_start/end` 等，已用 `gh api` 核实过官方文档）翻译成 CoResearch 自己的浏览器协议，SDK 改内部事件形状不会直接打碎前端契约。

**这条决策 block 住 [14 号 ticket](14-agent-tool-write-permission-boundary.md)**：Agent 工具到底按 Huabu 自己的 tool registry 写，还是按 `defineTool()`/`pi.registerTool()` 的形状写，实现契约完全不同，14 号必须在这条之后才能定。
