# Agent Worker 与 CoResearch API 的进程边界

Type: grilling
Status: resolved

## Question

进程内 LLM 循环（长对话、多轮工具调用、流式输出）跑在哪：和 API 同一个 HTTP 请求生命周期里，还是 Supabase Edge Functions，还是别的形态？

## Answer

Agent Worker 是与 CoResearch API 共享代码包（canvas-engine / projector / research-service 等）但生命周期与单次 HTTP 请求解耦的独立进程。API 只负责 create run / query state / cancel / accept-reject；长时间的 LLM 循环、文献检索、候选生成在 Worker 里跑，不占 HTTP 连接。不用 Supabase Edge Functions 承载 Agent Loop——其执行时长限制和多轮工具调用+流式输出的模式冲突。详见 [ADR 0001](../../../docs/adr/0001-hybrid-backend-supabase-as-infra.md)。

Worker 的具体调度机制（怎么发起/取消/超时一次 run，用不用队列）留在地图的 Fog（Not yet specified），不在本 ticket 范围内。
