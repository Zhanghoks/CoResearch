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

### Code review 后的修正

两轴 review（standards / spec）跑出 9 条，其中 7 条已改：

**真 bug（两条，review 之前没发现）**
- `sessionStore.initInFlight` 用 `??=` 缓存了失败：`getSession()` 抛一次之后，后续每次 `init()` 都拿回同一个 resolved-false 的 promise，用户会被永久钉在 `/login`，除非整页刷新。失败时清空缓存。
- `CanvasPage` 的 `if (!canvasId) return` 让 `snapshot` 停在 `null`，页面无限转圈而不是报错。当前路由下不可达，属于写了一半的 guard，补成报错。

**`MIN(c.id::text)` 不是 primary canvas（两个 reviewer 独立提 + 我自己也标了）**
它取的是字典序最小的 uuid，跟"哪张是 primary"没关系。ADR 0003 明确预期将来会有第二张 Deep Dive 画布，届时列表会静默链到随机一张、且没有测试会红。已改成按 `created_at ASC` 取第一张（= 跟 project 一起建的那张），并补了一条会红的测试：插一张 `created_at` 更晚但 uuid 排序更靠前的画布，旧实现选错、新实现选对。

**Standards 硬伤（两条）**
- `CanvasSnapshot.title` 与 CONTEXT.md 的 Canvas 定义冲突：Canvas 不持有研究内容真值，V1 里 `canvases.title` 只是列默认值 `'Main Canvas'`，UI 从来不读它。已删除，只留 `projectTitle`。
- 三个 wire DTO（`ProjectSummary`/`CreatedProject`/`CanvasSnapshot`）在 API 和 web 各声明一份，**并且已经漂移**（API 写 `nodes: never[]`，web 写 `unknown[]`，没有任何东西发现）。已收进 `packages/shared/src/api/contracts.ts`，两边同源；`never[]` 一并改成更诚实的 `unknown[]`。

**ADR 0013 的 fail-closed 保证被测试替身削弱**
`pgliteHarness.asUser` 原本手抄了一遍 `BEGIN`/`SET LOCAL ROLE`/`set_config` 序列——生产那条路径要是多一步，测试会静默地不再覆盖它。已改成把 PGlite 适配成 `pg.Pool` 的最小切面，通过既有的 `_setPoolsForTest` 注入，**测试现在跑的是真的 `withRequestContext`**，不是复制品。

**Scope creep：`/prototype` 路由**
移动 `PrototypeApp.tsx` 是合理的（代码是搬的不是造的），但给它挂路由、在 `HomePage` 加横幅、在项目列表加入口，是 ticket 没要求的新用户界面。路由/横幅/入口已全部撤掉，文件保留但不被引用，去留交给 05 号。顺带效果：entry chunk 从 785 kB 降到 540 kB（seedGraph 不再进入入口图）。

**没改的两条（判断题，记下不做）**
- `app.ts` 三个 handler 重复 `deps.withRequestContext({userId}, ...)` 外加手写 body 解析。三次重复还没到该抽象的程度（`server.ts` 注释里还有 9 个端点要落在这里，等真到了再抽 `withCaller` + Fastify schema 更合适）。
- `GET /api/projects/:projectId`（spec §1 有、本 ticket 没要求、没有后续 ticket 认领）。列表已带 `canvasId`，深链能工作，没有消费者。**这是一条会被遗忘的契约缺口，记在这里等需要它的 ticket 认领。**

### 已知限制

真正的"primary canvas"目前靠创建顺序推断，schema 里没有标记。要支持多画布时需要显式建模，那是新的架构判断，按地图规矩回[决策地图](../../coresearch-saas-architecture/map.md)开 ticket，不在实现阶段顺手加字段。
