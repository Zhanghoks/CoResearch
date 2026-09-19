# 08: Pi Agent → Candidate → 同一 Accept Path（V3B）

**What to build:** 接 `@earendil-works/pi-coding-agent`（[ADR 0006](../../../docs/adr/0006-agent-worker-pi-coding-agent-sdk.md)）、`createCoResearchAgentSession()` fail-closed 工厂（先只启用 `propose_candidates` 一个工具，其余五个可以后置）、Agent Worker 进程、`GET /api/runs/:runId/stream` SSE；把 06 号里手写的 fixture 候选换成真实 Agent 在对话里产出的 `CandidatePart`，走**同一条** accept 路径（06 号已经验证过的事务，不重新实现）。

**Blocked by:** 06（复用同一个 accept 路径；不需要等 07 号，ownership 和 Agent 是不是真实的无关）。

**Status:** ready-for-agent

- [ ] `createCoResearchAgentSession()` 显式传 `tools` 白名单，验证暴露的工具集精确等于预声明的 allowlist（不含 `read`/`bash`/`edit`/`write`）
- [ ] 自定义 `ResourceLoader` 生效，不做任何本地文件系统发现
- [ ] 真实一次对话：用户提问 → Agent 用 `propose_candidates` 提一个候选 → SSE 推给浏览器 → 候选卡片渲染 → 拖进画布走 06 号的 accept 事务 → 出现在画布上
- [ ] `agent_messages` 落库的是 Pi 的 `SessionEntry` 原样（不是转换过的自定义格式）
- [ ] Token 级流式（`message.delta`）走 SSE，确认不落 `agent_messages`（只有完整轮次落库）
