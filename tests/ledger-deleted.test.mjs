// node tests/ledger-deleted.test.mjs: an item the ledger calls deleted is gone: its file no longer exports or defines it.
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const L = JSON.parse(readFileSync(join(ROOT, "tools/ledger/ledger.json"), "utf8"));
const defines = (text, kind, name) => {
  const n = name.replace(/[$]/g, "\\$");
  if (kind === "exports") return new RegExp(`^export (?:async )?(?:function\\*? |const |let |class )${n}\\b`, "m").test(text) || new RegExp(`^export \\{[^}]*\\b${n}\\b[^}]*\\}`, "m").test(text);
  if (kind === "functions") return new RegExp(`(?:^|\\s)function\\*? ${n}\\s*\\(`, "m").test(text);
  return null;
};
let checked = 0;
for (const [key, e] of Object.entries(L.items)) {
  if (e.status !== "deleted") continue;
  const [file, kind, name] = key.split("::");
  assert.ok(e.reason, `${key} is deleted without a reason`);
  if (!existsSync(join(ROOT, file))) continue;
  const there = defines(readFileSync(join(ROOT, file), "utf8"), kind, name);
  if (there === null) continue;
  assert.equal(there, false, `${key}: the ledger says deleted, but ${file} still has it`);
  checked++;
}
console.log(`  ok  ${checked} deleted items are gone\n\n1 passed`);
