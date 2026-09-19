# CoResearch SaaS：实现地图（阶段三）

## Destination

**这张地图承载执行，不是决策**——覆盖阶段一（[决策地图](../coresearch-saas-architecture/map.md)，22 条决策）与阶段二（[docs/spec/](../../docs/spec/) 六份实现级 spec）已经锁定的东西，一步步写成能跑的代码。默认的 wayfinder"只规划不执行"在这里被覆盖：每张 ticket 的完成标准是代码写完、能跑、测试过，不是一份分析文档。

终点：[docs/spec/03-canvas-engine-port.md](../../docs/spec/03-canvas-engine-port.md) §5 定的实施顺序全部走完——monorepo 骨架、第一批 migration、canvas-engine 移植三步、投影器只读跑通、Web 接线、Agent Worker。达到"能演示 Seed→Direction→Canvas 的最小闭环"算这张地图的终点。

## Notes

- 遇到实现过程中冒出的新架构判断（不是"怎么写这段代码"，是"要不要这么设计"这类），回到[决策地图](../coresearch-saas-architecture/map.md)补 ticket，不在这里现场拍板。
- 每张 ticket 完成后跑一次 `pnpm typecheck`（至少影响到的包）再标 resolved。
- 源码出处 `Huabu-main/`（MIT）：直接复制的片段保留版权声明；只借架构决策的部分在文件头注明来源。

## Decisions so far

（本地图不产生"决策"，这里记录**完成的里程碑**，用法和阶段一的 Decisions so far 一致，只是内容是"做完了什么"不是"决定了什么"）

## Not yet specified

- Agent Worker 的具体部署方式（进程管理、多实例伸缩）——留到有真实负载时再定
- CI/CD、部署脚本——明确 Out of scope（见阶段一地图）

## Out of scope

- 计费系统、部署运维——阶段一地图已经排除，这里同样排除
