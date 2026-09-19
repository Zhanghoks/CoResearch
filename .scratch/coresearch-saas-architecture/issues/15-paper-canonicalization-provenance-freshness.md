# 论文 Canonicalization、Provenance 与 Freshness

Type: research
Status: resolved

## Question

CoResearch 的文献检索/引用需要一套论文规范化方案。调研以下事实，供后续 Method/Evaluation Model Spec 和 Paper 数据模型 ticket 使用：

1. 外部文献 API 候选：Semantic Scholar API、OpenAlex、arXiv API、Crossref——各自的免费额度、限流策略、是否需要 API key、返回字段（摘要、引用图、作者、会议/期刊、开放获取链接）覆盖度。
2. 规范化 ID 方案：DOI、arXiv ID、Semantic Scholar Paper ID（S2 ID）之间的映射关系，同一篇论文（预印本 + 正式发表版）的去重/合并策略业界常见做法。
3. Provenance 与 freshness：这些 API 各自返回的"最后更新时间"字段是否可靠，能不能用来支持 `docs/design/idea-formation/04-problem-formation.md` 里要求的"No direct match identified in current search"这类带时间戳的判断（即：多久之后需要重新检索以刷新 novelty 判断）。
4. 速率与成本：如果 V1 预期的检索量（按用户数和平均每个 Direction Exploration 的检索次数粗估）会不会撞到免费额度，需不需要现在就规划付费层级。

调研完成后把发现写成简短报告，供 [Direction Deep Dive 数据模型](13-direction-deep-dive-data-model.md) 和后续毕业出的 spec ticket 引用。

## Answer

主力用 **Semantic Scholar**（citation graph 最丰富、`externalIds` 已含 DOI/arXiv 映射）配合 **OpenAlex** 作为免费额度更高（100k credits/day, 100 req/s）的互补/兜底源；**Crossref** 专门用于 DOI 权威元数据解析（发布后约 20 分钟内可查，四者中最新鲜）；**arXiv** 仅用于尚未注册 DOI 的预印本，需遵守 3 秒一次的礼貌限速和每日一次的更新节奏。规范化方案：以 **DOI** 为主键，无 DOI 时用 **arXiv ID** 作为次级/兜底字段，S2 Paper ID 和 OpenAlex Work ID 仅作为各自数据源的外键而非全局主键——S2、OpenAlex 服务端已做了预印本/正式发表版的去重合并，优先复用其合并结果，只有 CoResearch 自行从 arXiv 拉取内容并需要事后关联 DOI 时才需要本地按 DOI 字符串匹配做合并。Freshness：四个 API 都没有公开的实时索引 SLA（arXiv 明确是每日批处理，S2/OpenAlex 未文档化，只有 Crossref 文档化了约 20 分钟的新鲜度），因此 "No direct match identified in current search" 这类判断建议设置 **24 小时**的重新检索窗口，并在结果上标注 "as of [timestamp]" 的 provenance 说明而非当作永久结论。速率与成本：V1 预估约 1,430 次查询/天，远低于 OpenAlex/Crossref/arXiv 的免费额度（OpenAlex 额度约为该量级的 70 倍），唯一的实际约束是 Semantic Scholar 的 1 req/s/key，需要 **Agent Worker 内部的 provider client**（不是浏览器——key 由服务端持有，浏览器永远碰不到）做请求排队/退避；多 Worker 实例共用同一个 key 时排队要做成跨实例的（Postgres 协调，不必为此引入 Redis），而非现在就规划付费层级；建议在用量增长约 50-100 倍或需要 SLA 保证时再评估 Crossref Metadata Plus 或更高的 S2 key 额度。

详见调研报告：[research/paper-canonicalization-provenance-freshness.md](../research/paper-canonicalization-provenance-freshness.md)（分支 `research/paper-canonicalization-provenance-freshness`）。
