// Shared read path (docs/spec/04 §5). GET /research and
// inspect_research_state both call this.

import type { SqlQuery } from "./sql.js";

export type ResearchEntityRecord = {
  id: string;
  projectId: string;
  entityKind: string;
  currentRevision: number;
  contentHash: string;
  status: string;
  origin: string;
  confirmed: boolean;
  stale: string | null;
  summary: string | null;
  payload: unknown;
};

export type ResearchRelationRecord = {
  id: string;
  projectId: string;
  fromEntityId: string;
  toEntityId: string;
  relationKind: string;
};

export type ResearchState = {
  entities: ResearchEntityRecord[];
  relations: ResearchRelationRecord[];
};

export async function readResearchState(
  db: SqlQuery,
  projectId: string,
  filter?: { kind?: string; status?: string },
): Promise<ResearchState> {
  const visible = await db.query(
    "SELECT id FROM projects WHERE id = $1::uuid",
    [projectId],
  );
  if (!visible.rows[0]) return { entities: [], relations: [] };

  const params: unknown[] = [projectId];
  let where = "project_id = $1::uuid";
  if (filter?.kind) {
    params.push(filter.kind);
    where += ` AND entity_kind = $${params.length}`;
  }
  if (filter?.status) {
    params.push(filter.status);
    where += ` AND status = $${params.length}`;
  }

  const entities = await db.query(
    `SELECT id, project_id, entity_kind, current_revision, content_hash,
            status, origin, confirmed, stale, summary, payload
       FROM research_entities
      WHERE ${where}
      ORDER BY created_at ASC, id ASC`,
    params,
  );
  const relations = await db.query(
    `SELECT id, project_id, from_entity_id, to_entity_id, relation_kind
       FROM research_relations
      WHERE project_id = $1::uuid
      ORDER BY created_at ASC, id ASC`,
    [projectId],
  );

  return {
    entities: entities.rows.map((row) => ({
      id: String(row.id),
      projectId: String(row.project_id),
      entityKind: String(row.entity_kind),
      currentRevision: Number(row.current_revision),
      contentHash: String(row.content_hash),
      status: String(row.status),
      origin: String(row.origin),
      confirmed: Boolean(row.confirmed),
      stale: typeof row.stale === "string" ? row.stale : null,
      summary: typeof row.summary === "string" ? row.summary : null,
      payload: row.payload,
    })),
    relations: relations.rows.map((row) => ({
      id: String(row.id),
      projectId: String(row.project_id),
      fromEntityId: String(row.from_entity_id),
      toEntityId: String(row.to_entity_id),
      relationKind: String(row.relation_kind),
    })),
  };
}
