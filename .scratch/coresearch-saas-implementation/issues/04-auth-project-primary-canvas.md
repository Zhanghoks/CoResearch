# 04: Auth → Project → Primary Canvas

**What to build:** 真实 Supabase Auth 登录（magic link，OAuth 可后置）；`POST /api/projects` 创建 Project 时同一事务插入 `projects` + `project_members`(owner) + 一个 primary `canvases` 行（[ADR 0003](../../../docs/adr/0003-project-canvas-cardinality.md)）；`GET /api/canvases/:canvasId` 能加载一个空画布（此时没有节点，返回空数组即可，不报错）；前端能登录、看到项目列表、打开一个空画布页面。

**Blocked by:** 01、03（需要真实的鉴权+RLS 才能验证"这是我的 project"）。

**Status:** ready-for-agent

- [ ] 浏览器走 Supabase Auth 完成登录，拿到 JWT
- [ ] `POST /api/projects` 端到端跑通，一个事务里建齐三行
- [ ] `GET /api/canvases/:canvasId` 返回空画布结构，前端渲染不报错
- [ ] 用未登录/无权限的请求访问会被拒绝（复用 03 号的 RLS，端到端验证一次）
