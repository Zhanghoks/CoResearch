import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const srcRoot = path.dirname(fileURLToPath(import.meta.url));

function walkTs(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walkTs(full));
    else if (name.endsWith(".ts")) out.push(full);
  }
  return out;
}

describe("@xyflow/react import rule", () => {
  it("packages/engine only type-imports @xyflow/react", () => {
    // Scoped to a single import statement ([^;\n]* / one line) — a lazy
    // [\s\S]*? here would span past unrelated import statements and flag
    // files that only `import type` from '@xyflow/react' alongside other,
    // earlier imports.
    const runtimeImport =
      /(?:^|\n)import\s+(?!type\b)[^;\n]*?from\s+["']@xyflow\/react["']/;
    const offenders: string[] = [];
    for (const file of walkTs(srcRoot)) {
      const text = readFileSync(file, "utf8");
      if (runtimeImport.test(text)) offenders.push(path.relative(srcRoot, file));
    }
    assert.deepEqual(offenders, []);
  });
});
