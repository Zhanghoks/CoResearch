import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const srcRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function walkTs(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walkTs(full));
    else if (name.endsWith(".ts")) out.push(full);
  }
  return out;
}

describe("pg import boundary", () => {
  it("production code outside src/db/ cannot import pg", () => {
    const dbDir = path.join(srcRoot, "db");
    const importPg = /from\s+["']pg["']/;
    const offenders: string[] = [];
    for (const file of walkTs(srcRoot)) {
      if (file.startsWith(dbDir + path.sep) || file.startsWith(dbDir + "/")) {
        continue;
      }
      const text = readFileSync(file, "utf8");
      if (importPg.test(text)) {
        offenders.push(path.relative(srcRoot, file));
      }
    }
    assert.deepEqual(offenders, []);
  });
});
