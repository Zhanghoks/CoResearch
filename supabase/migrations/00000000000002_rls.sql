-- CoResearch SaaS — RLS policies + coresearch_app role.
-- Source: docs/spec/01-database-schema.md §0–4 and ADR 0013.
-- Tables were created in 00000000000001_init.sql without policies so that
-- file stayed "tables only" (ticket 01). This migration is ticket 03.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'coresearch_app') THEN
    CREATE ROLE coresearch_app NOLOGIN;
  END IF;
END
$$;

-- Login roles used by apps/api (postgres on hosted Supabase) SET LOCAL
-- ROLE into this NOLOGIN role for each request. Without the grant,
-- SET ROLE fails and the session stays BYPASSRLS.
GRANT coresearch_app TO postgres;

GRANT USAGE ON SCHEMA public TO coresearch_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO coresearch_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO coresearch_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO coresearch_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO coresearch_app;

-- ── Enable + force RLS on every V1–V4 table ─────────────────────────────
-- FORCE so the table owner cannot accidentally bypass on a pooled
-- connection; service_role still BYPASSRLS (Supabase-built-in).

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects FORCE ROW LEVEL SECURITY;
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_members FORCE ROW LEVEL SECURITY;
ALTER TABLE agent_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_threads FORCE ROW LEVEL SECURITY;
ALTER TABLE agent_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_messages FORCE ROW LEVEL SECURITY;
ALTER TABLE agent_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_runs FORCE ROW LEVEL SECURITY;
ALTER TABLE research_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE research_entities FORCE ROW LEVEL SECURITY;
ALTER TABLE research_entity_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE research_entity_revisions FORCE ROW LEVEL SECURITY;
ALTER TABLE research_relations ENABLE ROW LEVEL SECURITY;
ALTER TABLE research_relations FORCE ROW LEVEL SECURITY;
ALTER TABLE proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposals FORCE ROW LEVEL SECURITY;
ALTER TABLE canvases ENABLE ROW LEVEL SECURITY;
ALTER TABLE canvases FORCE ROW LEVEL SECURITY;
ALTER TABLE canvas_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE canvas_nodes FORCE ROW LEVEL SECURITY;
ALTER TABLE canvas_layout ENABLE ROW LEVEL SECURITY;
ALTER TABLE canvas_layout FORCE ROW LEVEL SECURITY;
ALTER TABLE canvas_edges ENABLE ROW LEVEL SECURITY;
ALTER TABLE canvas_edges FORCE ROW LEVEL SECURITY;
ALTER TABLE canvas_projections ENABLE ROW LEVEL SECURITY;
ALTER TABLE canvas_projections FORCE ROW LEVEL SECURITY;
ALTER TABLE canvas_deltas ENABLE ROW LEVEL SECURITY;
ALTER TABLE canvas_deltas FORCE ROW LEVEL SECURITY;

-- ── coresearch_app policies (session variable, never auth.uid()) ────────

-- SELECT/UPDATE/DELETE require membership. INSERT is split so creating
-- a project (ticket 04) can insert the projects row before the owner
-- membership row exists — FOR ALL USING(membership) would WITH CHECK
-- that membership on INSERT and deadlock the create transaction.
CREATE POLICY coresearch_app_select ON projects
  FOR SELECT TO coresearch_app
  USING (
    owner_user_id = current_setting('app.current_user_id')::uuid
    OR id IN (
      SELECT project_id FROM project_members
      WHERE user_id = current_setting('app.current_user_id')::uuid
    )
  );
CREATE POLICY coresearch_app_insert ON projects
  FOR INSERT TO coresearch_app
  WITH CHECK (owner_user_id = current_setting('app.current_user_id')::uuid);
CREATE POLICY coresearch_app_update ON projects
  FOR UPDATE TO coresearch_app
  USING (id IN (
    SELECT project_id FROM project_members
    WHERE user_id = current_setting('app.current_user_id')::uuid
  ));
CREATE POLICY coresearch_app_delete ON projects
  FOR DELETE TO coresearch_app
  USING (id IN (
    SELECT project_id FROM project_members
    WHERE user_id = current_setting('app.current_user_id')::uuid
  ));

-- Spec §1 wrote an OR-subquery on project_members itself; Postgres
-- evaluates that subquery under the same policy and recurses (42P17).
-- SELECT own membership rows. INSERT only as owner of that project
-- (blocks "add myself to someone else's project_id").
CREATE POLICY coresearch_app_select ON project_members
  FOR SELECT TO coresearch_app
  USING (user_id = current_setting('app.current_user_id')::uuid);
CREATE POLICY coresearch_app_insert ON project_members
  FOR INSERT TO coresearch_app
  WITH CHECK (
    user_id = current_setting('app.current_user_id')::uuid
    AND project_id IN (
      SELECT id FROM projects
      WHERE owner_user_id = current_setting('app.current_user_id')::uuid
    )
  );
CREATE POLICY coresearch_app_delete ON project_members
  FOR DELETE TO coresearch_app
  USING (user_id = current_setting('app.current_user_id')::uuid);

CREATE POLICY coresearch_app_scope ON agent_threads
  FOR ALL TO coresearch_app
  USING (project_id IN (
    SELECT project_id FROM project_members
    WHERE user_id = current_setting('app.current_user_id')::uuid
  ));

CREATE POLICY coresearch_app_scope ON agent_messages
  FOR ALL TO coresearch_app
  USING (thread_id IN (
    SELECT id FROM agent_threads
    WHERE project_id IN (
      SELECT project_id FROM project_members
      WHERE user_id = current_setting('app.current_user_id')::uuid
    )
  ));

CREATE POLICY coresearch_app_scope ON agent_runs
  FOR ALL TO coresearch_app
  USING (project_id IN (
    SELECT project_id FROM project_members
    WHERE user_id = current_setting('app.current_user_id')::uuid
  ));

CREATE POLICY coresearch_app_scope ON research_entities
  FOR ALL TO coresearch_app
  USING (project_id IN (
    SELECT project_id FROM project_members
    WHERE user_id = current_setting('app.current_user_id')::uuid
  ));

CREATE POLICY coresearch_app_scope ON research_entity_revisions
  FOR ALL TO coresearch_app
  USING (entity_id IN (
    SELECT id FROM research_entities
    WHERE project_id IN (
      SELECT project_id FROM project_members
      WHERE user_id = current_setting('app.current_user_id')::uuid
    )
  ));

CREATE POLICY coresearch_app_scope ON research_relations
  FOR ALL TO coresearch_app
  USING (project_id IN (
    SELECT project_id FROM project_members
    WHERE user_id = current_setting('app.current_user_id')::uuid
  ));

CREATE POLICY coresearch_app_scope ON proposals
  FOR ALL TO coresearch_app
  USING (project_id IN (
    SELECT project_id FROM project_members
    WHERE user_id = current_setting('app.current_user_id')::uuid
  ));

CREATE POLICY coresearch_app_scope ON canvases
  FOR ALL TO coresearch_app
  USING (project_id IN (
    SELECT project_id FROM project_members
    WHERE user_id = current_setting('app.current_user_id')::uuid
  ));

CREATE POLICY coresearch_app_scope ON canvas_nodes
  FOR ALL TO coresearch_app
  USING (canvas_id IN (
    SELECT id FROM canvases
    WHERE project_id IN (
      SELECT project_id FROM project_members
      WHERE user_id = current_setting('app.current_user_id')::uuid
    )
  ));

CREATE POLICY coresearch_app_scope ON canvas_layout
  FOR ALL TO coresearch_app
  USING (node_id IN (
    SELECT id FROM canvas_nodes
    WHERE canvas_id IN (
      SELECT id FROM canvases
      WHERE project_id IN (
        SELECT project_id FROM project_members
        WHERE user_id = current_setting('app.current_user_id')::uuid
      )
    )
  ));

CREATE POLICY coresearch_app_scope ON canvas_edges
  FOR ALL TO coresearch_app
  USING (canvas_id IN (
    SELECT id FROM canvases
    WHERE project_id IN (
      SELECT project_id FROM project_members
      WHERE user_id = current_setting('app.current_user_id')::uuid
    )
  ));

CREATE POLICY coresearch_app_scope ON canvas_projections
  FOR ALL TO coresearch_app
  USING (canvas_id IN (
    SELECT id FROM canvases
    WHERE project_id IN (
      SELECT project_id FROM project_members
      WHERE user_id = current_setting('app.current_user_id')::uuid
    )
  ));

CREATE POLICY coresearch_app_scope ON canvas_deltas
  FOR ALL TO coresearch_app
  USING (canvas_id IN (
    SELECT id FROM canvases
    WHERE project_id IN (
      SELECT project_id FROM project_members
      WHERE user_id = current_setting('app.current_user_id')::uuid
    )
  ));

-- ── Realtime subscription (authenticated + auth.uid()) ──────────────────
-- canvas_deltas is the only table the browser subscribes to directly.

-- Policy quals run as the invoker. canvases/project_members have FORCE
-- RLS and no TO authenticated policy, so an inline JOIN would see no
-- rows. SECURITY DEFINER (owner = postgres, BYPASSRLS) is the membership
-- check; it does not GRANT those tables to the browser.
CREATE OR REPLACE FUNCTION public.canvas_visible_to_auth(cid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM canvases c
    JOIN project_members pm ON pm.project_id = c.project_id
    WHERE c.id = cid AND pm.user_id = auth.uid()
  );
$$;
REVOKE ALL ON FUNCTION public.canvas_visible_to_auth(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.canvas_visible_to_auth(uuid) TO authenticated;

CREATE POLICY authenticated_realtime_scope ON canvas_deltas
  FOR SELECT TO authenticated
  USING (public.canvas_visible_to_auth(canvas_id));

GRANT SELECT ON canvas_deltas TO authenticated;

ALTER PUBLICATION supabase_realtime ADD TABLE canvas_deltas;
