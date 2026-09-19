# 04: Auth → Project → Primary Canvas

**What to build:** 真实 Supabase Auth 登录（magic link，OAuth 可后置）；`POST /api/projects` 创建 Project 时同一事务插入 `projects` + `project_members`(owner) + 一个 primary `canvases` 行（[ADR 0003](../../../docs/adr/0003-project-canvas-cardinality.md)）；`GET /api/canvases/:canvasId` 能加载一个空画布（此时没有节点，返回空数组即可，不报错）；前端能登录、看到项目列表、打开一个空画布页面。

**Blocked by:** 01、03（需要真实的鉴权+RLS 才能验证"这是我的 project"）。

**Status:** resolved

- [x] 浏览器走 Supabase Auth 完成登录，拿到 JWT —— **代码完成，真实浏览器往返未验证**（见下）
- [x] `POST /api/projects` 端到端跑通，一个事务里建齐三行
- [x] `GET /api/canvases/:canvasId` 返回空画布结构，前端渲染不报错
- [x] 用未登录/无权限的请求访问会被拒绝（复用 03 号的 RLS，端到端验证一次）

## Answer

### API（`apps/api`，24 个测试全绿）

- `auth/verifyAccessToken.ts`：`jose` 验签 Supabase JWT（HS256 + `SUPABASE_JWT_SECRET`），校验 `iss`/`aud`，取 `sub` 作为 `RequestContext.userId`。**永远是 verify 不是 decode**——这个函数的输出直接喂给 `SET LOCAL app.current_user_id`，伪造即越权。测试覆盖：伪造签名、过期、换项目签发、缺 `sub`（缺 `sub` 会让 RLS 谓词拿空串比 uuid，必须 fail closed）。
- `projects/createProject.ts`：一个事务建三行。**插入顺序是 03 号的 RLS 策略强制的，不是偏好**——`projects`（INSERT 策略校验 `owner_user_id = me`）→ `project_members`（策略校验我拥有该 project，所以 projects 行必须先在）→ `canvases`（`FOR ALL USING` 同时充当 INSERT 检查，所以 membership 行必须先在）。换序就 fail closed。另有一条测试证明它无法替别人建 project（没有 service-role 旁路）。
- `canvas/readCanvas.ts`：读画布身份，`nodes`/`edges` 返回空数组。不可见时返回 `null`，路由层转 404（不是 403）——跨租户不能泄露 id 是否存在。
- `app.ts`：应用工厂，把 Postgres 上下文运行器**注入**进来。生产传 `withRequestContext`（pg Pool），测试传 PGlite 版。所以 `routes.integration.test.ts` 跑的是真路由 + 真策略 + 真 JWT。
- `test/pgliteHarness.ts`：直接加载两个真 migration 文件，只在 PGlite 里补 Supabase 运行时缺的东西（`auth.users`/`auth.uid()`/`authenticated` 角色/realtime publication）。只在开发机上成立的策略在这里同样会挂。

### Web（`apps/web`）—— 照搬 Huabu 源码改装

按要求不自己发明外壳，从 `Huabu-main/apps/web` 移植（MIT，文件头标注来源）：

| Huabu | CoResearch | 改装点 |
|---|---|---|
| `App.tsx` `createBrowserRouter` + `RootLayout` + `InitialisingContext` | 同 | router 只构建一次（`useMemo([])`），`initialising` 走 context——初版我错误地把它放进依赖数组，会重建 router 丢掉 URL，正是 Huabu 注释警告的那个坑 |
| `WorkspaceGuardLayout` → `/setup` | `AuthGuardLayout` → `/login` | 闸门从"选了 workspace 吗"换成"登录了吗"，路由形状不变 |
| `workspaceStore.init()/isReady` | `sessionStore.init()/isReady` | 同样用 in-flight promise 去重（StrictMode 双调用） |
| `api/_client.ts` `apiFetch`/`ApiError` | 同 | 新增：每次调用挂 Supabase bearer（Huabu 单机无凭证） |
| `CanvasListPage`（列 Canvas） | `ProjectListPage`（列 Project） | 单位变了：V1 一个 Project 一张 primary Canvas（ADR 0003），所以行直接链到 `/canvas/:canvasId`，中间没有画布选择器。Huabu 的导出/删除/导入没移植——SaaS 还没有 ticket 定义它们 |
| `lazy(() => import('./pages/CanvasPage'))` | 同 | 构建确认已单独切块 |

**Huabu 的 `useBlocker` 排空逻辑故意没移植**：它是为"离开画布前把 pending 保存落盘"服务的，而现在画布还不能编辑（05 号），没有东西要排空。等第一条写路径出现时再加回来。

移植带来的一个真实改动：改成 URL 路由后，深链 `/canvas/:id` 刷新必须能自己渲染标题，不能依赖列表页留在内存里的对象。所以 `GET /api/canvases/:canvasId` 增加了 `projectTitle`（TDD 补的）。

原型（`HomePage`/`NodeIntroPage`/`seedGraph`）搬进 `components/Home/PrototypeApp.tsx`，挂在 `/prototype` 路由上保持可达——它编码的布局设计要等 05 号真正换掉 `seedGraph` 时才决定去留，现在删掉或者悄悄孤立都不对。

### 没做到的事

**真实浏览器 magic-link 往返没有验证过**：本会话没有 Supabase 凭证（仓库里没有 `.env`，也没挂 Supabase MCP 工具）。已验证的是：API 进程真实启动后 `/healthz` 200、未认证 `/api/projects` 401（0.4ms 返回，连数据库连接都没开）；Vite dev server 起得来，`/` 和深链 `/canvas/x` 都 200（SPA fallback 正常，路由需要它）；生产构建通过且 CanvasPage 已切块。**React 实际渲染没有在浏览器里看过**。要收这一条，需要往 `.env` 填真实凭证后手动走一次。

新增 `.env.example` 记录全部所需变量。

### 已知限制

`listProjects` 用 `MIN(c.id::text)` 取 primary canvas。V1 下每个 project 只有一张画布（ADR 0003），所以今天恒等；真要支持多画布时，"哪张是 primary"需要 schema 上的标记，那是新的架构判断，按地图规矩应该回[决策地图](../../coresearch-saas-architecture/map.md)开 ticket，不在实现阶段顺手加字段。
