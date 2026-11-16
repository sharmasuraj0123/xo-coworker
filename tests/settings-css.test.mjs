// Settings' stylesheet rules that a rendered check found missing (the browser suite measures them; this keeps the
// declarations themselves from going again). No browser.
//   node tests/settings-css.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../css/app.css", import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
const rule = (sel) => { const m = new RegExp(`(?:^|\\})\\s*${sel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\{([^}]*)\\}`).exec(css); return m ? m[1] : null; };

let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.stack); process.exitCode = 1; } };

t("C112: a link in a Settings row's words stays on one line (a phone wrapped \"about it\" into two)", () => {
  const r = rule(".set-row a");
  assert.ok(r, ".set-row a is declared");
  assert.match(r, /white-space:\s*nowrap/);
  assert.match(r, /text-decoration:\s*underline/, "and keeps its underline (link style B)");
});

console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
