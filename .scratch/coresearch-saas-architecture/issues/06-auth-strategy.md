# 认证方案

Type: grilling
Status: resolved

## Question

Huabu 原版是单 owner 的 HTTP Basic Auth，没有真正的多用户认证。SaaS 版用什么？

## Answer

直接用 Supabase Auth：邮箱 magic link + Google/GitHub OAuth，不自建密码/邮箱验证/OAuth 系统。浏览器拿到 Supabase session 后带 `Authorization: Bearer <supabase-jwt>` 调 CoResearch API；API 验证 JWT 后构造 `RequestContext`（`{userId, projectId, plan}`），替代 Huabu 原有的 `getWorkspacePath()` / `getWorkspaceHandle()` 这类进程级全局上下文读取。
