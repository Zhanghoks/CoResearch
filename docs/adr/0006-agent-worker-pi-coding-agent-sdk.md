# Agent Worker 用 `@earendil-works/pi-coding-agent` SDK，不是 CLI，不是 Huabu 的 Agenetes 编排

- 状态：accepted

Huabu 自研了一层 Agent 编排（`agenetes` + `pi-driver`）架在 `@earendil-works/pi-agent-core`/`pi-ai` 之上，自己管会话、工具执行、事件流。同一个 `earendil-works` 组织下有一个更高层的官方 SDK 包 `@earendil-works/pi-coding-agent`（版本与 Huabu 已依赖的底层包对齐，MIT），把 session 生命周期、compaction、事件订阅、工具/扩展/技能加载这些 Huabu 自己重新实现的部分都封装好了（`createAgentSession` / `AgentSession.prompt|steer|followUp|subscribe|abort|compact` / `SessionManager` / `ResourceLoader` / `defineTool`）。CoResearch 的 Agent Worker（[ADR 0003 之前定的进程边界](./0003-project-canvas-cardinality.md) 之外，见 wayfinder ticket 03）直接用这个 SDK 的 programmatic 接口，不 spawn 它的 CLI/TUI 二进制、不走 stdin/stdout RPC——SDK 本身就是为"嵌入到自己的应用里"设计的。

多租户 SaaS 环境下，SDK 的几个默认行为必须显式收紧，否则会变成安全漏洞而不是省事：

1. **不用 `DefaultResourceLoader`**。它默认从 `~/.pi/agent/extensions/`、`.pi/extensions/`、`.pi/skills/`、`.agents/skills/`、`settings.json` 里发现扩展/技能——这是为单机本地 CLI 设计的机制，在多租户进程里没有"用户自己的 home 目录"这个概念，也不该有运行时才发现的第三方代码。CoResearch 传自定义 `ResourceLoader`，只返回仓库内置、写死在代码里的 extension/tool/skill 集合。
2. **必须显式传 `tools: [...]` 白名单，且做成结构上不可能漏传**。SDK 源码核实（`packages/coding-agent/src/core/sdk.ts:256`）：`defaultActiveToolNames = ["read", "bash", "edit", "write"]`，不传 `tools` 时就是这四个默认启用；一旦传 `tools`，它同时是 allowed set 和 initial active set（严格 allowlist，不需要额外叠加 `noTools: "all"`）。这是给本地编程 Agent 用的文件系统和 shell 工具，绝不能出现在面向 Research Domain 的 Agent 工具集里，且这条不能靠"记得传参数"这种约定保证——生产代码**禁止直接调用 `createAgentSession()`**，一律经过本仓库自己的工厂函数：

   ```ts
   // packages/agent-worker/src/createCoResearchAgentSession.ts
   export async function createCoResearchAgentSession(opts: {
     model: Model;
     capabilityProfile: 'researcher'; // 枚举，V1 只有一个值，留口子给未来分级
     threadId: string;
   }) {
     const allowedTools = RESEARCH_TOOL_ALLOWLIST; // 常量，见 ticket 14
     const { session } = await createAgentSession({
       model: opts.model,
       resourceLoader: coresearchResourceLoader, // 自定义，见下条
       sessionManager: SessionManager.inMemory(),
       tools: allowedTools,
       customTools: coresearchTools,
     });
     assertExposedToolsMatch(session, allowedTools); // 见下方验收条件，启动即失败而非静默放行
     return session;
   }
   ```

   任何创建 Agent Session 的地方只能调 `createCoResearchAgentSession()`，不能直接调 SDK 的 `createAgentSession()`——把"传对参数"从人的记忆变成代码结构上唯一的入口。
3. **Postgres 是耐久真值，`SessionManager.inMemory()` 是运行时状态**。不依赖 SDK 默认的 `~/.pi/agent/sessions/*.jsonl` 文件持久化——那是单机场景的默认值，多租户下会话必须能在任意 Worker 实例上恢复。Worker 从 `agent_threads`/`agent_messages` 重建 in-memory session。
4. **事件经 adapter 转译，不直接透传给浏览器**。SDK 的事件词汇（`tool_execution_start/update/end`、`message_start/end`、`turn_start/end`、`compaction_start/end` 等）是它自己的内部协议，直接转发给前端会让 SDK 的版本升级直接打碎浏览器契约。中间加一层把这些事件映射到 CoResearch 自己命名的浏览器协议。

**验收条件**（写进测试，不是留在文档里）：

1. 存在一条测试遍历 `createCoResearchAgentSession()` 返回的 session，断言暴露的工具集里不含 `bash`/`read`/`write`/`edit`/`powershell`。
2. 更强的一条：断言暴露的工具集**精确等于**预先声明的 `RESEARCH_TOOL_ALLOWLIST` 常量（不是"不含危险工具"就够），任何未声明的新工具（无论来自 SDK 版本升级改了默认值，还是某个内置 extension 偷偷注册了新 tool）都直接测试失败，而不是被动地等安全审计发现。

被拒绝的替代方案：继续用 Huabu 现成的 Agenetes + pi-driver 编排层，不引入官方 SDK。拒绝原因：Agenetes 是 Huabu 为"外部 ACP Agent + 内置 pi Agent 两种驱动"设计的抽象层，CoResearch V1 已经决定砍掉外部 Agent 路径（只保留内置），继续维护这层抽象的复杂度没有对应的收益；官方 SDK 把 session/compaction/事件流这些 Huabu 自己重新发明的部分做好了，直接用能省掉这部分维护成本。这个决策不影响"V1 只保留内置 Agent"的范围——它是内置 Agent 内部怎么实现的技术选型，不是新增外部 Agent 接入路径。
