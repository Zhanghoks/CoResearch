// Six research tools (docs/spec/05 §4). Thin wrappers; no canvas commands.
// execute() matches the SDK signature, not the shorter spec sketch.

import { defineTool } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

export type ResearchToolHost = {
  proposeCandidate: (input: {
    kind: string;
    payload: unknown;
    rationale?: string;
  }) => Promise<{ candidateId: string }>;
  inspectResearchState?: (input: {
    kind?: string;
    status?: string;
  }) => Promise<unknown>;
};

function textResult(text: string, details: Record<string, unknown> = {}) {
  return { content: [{ type: "text" as const, text }], details };
}

export function createCoresearchTools(host: ResearchToolHost) {
  const searchPapers = defineTool({
    name: "search_papers",
    label: "Search papers",
    description: "检索外部文献（Semantic Scholar/OpenAlex/Crossref/arXiv）",
    parameters: Type.Object({
      query: Type.String(),
      limit: Type.Optional(Type.Number()),
    }),
    execute: async () =>
      textResult("search_papers is not implemented in this milestone"),
  });

  const readPaper = defineTool({
    name: "read_paper",
    label: "Read paper",
    description: "读取一篇已检索文献的内容，scope 到当前 project",
    parameters: Type.Object({ paperId: Type.String() }),
    execute: async () =>
      textResult("read_paper is not implemented in this milestone"),
  });

  const inspectResearchState = defineTool({
    name: "inspect_research_state",
    label: "Inspect research state",
    description: "读取当前项目的 research entities / relations",
    parameters: Type.Object({
      kind: Type.Optional(Type.String()),
      status: Type.Optional(Type.String()),
    }),
    execute: async (_id, params) => {
      const state = host.inspectResearchState
        ? await host.inspectResearchState({
            kind: params.kind,
            status: params.status,
          })
        : { entities: [] };
      return textResult(JSON.stringify(state));
    },
  });

  const proposeCandidates = defineTool({
    name: "propose_candidates",
    label: "Propose candidates",
    description:
      "提出一个 Track A 候选实体。不写入 research_entities，只写入对话中的 CandidatePart。",
    parameters: Type.Object({
      kind: Type.String(),
      payload: Type.Unknown(),
      rationale: Type.Optional(Type.String()),
    }),
    execute: async (_id, params) => {
      const { candidateId } = await host.proposeCandidate({
        kind: params.kind,
        payload: params.payload,
        rationale: params.rationale,
      });
      return textResult(`Proposed ${params.kind} candidate ${candidateId}`, {
        candidateId,
      });
    },
  });

  const proposeRevision = defineTool({
    name: "propose_revision",
    label: "Propose revision",
    description: "对已有实体提出 Track B 修订（本里程碑未启用）",
    parameters: Type.Object({
      entityId: Type.String(),
      baseStateRevision: Type.Number(),
      kind: Type.String(),
      changes: Type.Array(Type.Unknown()),
      rationale: Type.Optional(Type.String()),
    }),
    execute: async () =>
      textResult("propose_revision is not implemented in this milestone"),
  });

  const askUser = defineTool({
    name: "ask_user",
    label: "Ask user",
    description: "向用户提出一个澄清问题，无副作用",
    parameters: Type.Object({ question: Type.String() }),
    execute: async (_id, params) => textResult(params.question),
  });

  return [
    searchPapers,
    readPaper,
    inspectResearchState,
    proposeCandidates,
    proposeRevision,
    askUser,
  ];
}
