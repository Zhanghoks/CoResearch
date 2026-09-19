-- Worker processRun (docs/spec/05 §3) needs the user prompt on the run
-- row. The locked 15-table list did not include this column; the HTTP
-- contract is POST /runs {prompt}.

ALTER TABLE agent_runs
  ADD COLUMN prompt text NOT NULL DEFAULT '';
