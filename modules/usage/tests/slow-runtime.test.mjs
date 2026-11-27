// One runtime that answers slowly doesn't hold back the others: each is drawn as its answer lands.
import assert from "node:assert/strict";
import { createUsagePage } from "../page.js";

const tokens = (input, output) => ({ input, output, cache_read: 0, cache_write: 0, reasoning: 0 });
const usage = (n) => ({ total_cost: 0, total_tokens: tokens(n, 0), daily: [{ date: "2026-11-27", tokens: n }], by_model: [] });
let release = () => {};
const slow = new Promise((resolve) => { release = () => resolve(usage(900)); });
const source = {
  runtimes: async () => ["claude_code", "codex"],
  usage: async (name) => (name === "codex" ? usage(100) : slow),
};
let painted = "";
const page = createUsagePage({ paint: (_, html) => { painted = html; } }, source);
const opening = page.open();
for (let i = 0; i < 5; i++) await new Promise((resolve) => setTimeout(resolve, 0));
assert.match(painted, /<b class="us-total">100<\/b>/, "Codex is drawn while Claude Code is still being read");
assert.match(painted, /Still reading Claude Code…/, "and the page says whose answer it is still waiting for");
release();
await opening;
assert.match(painted, /<b class="us-total">1,000<\/b>/, "Claude Code joins the total when it answers");
assert.doesNotMatch(painted, /Still reading/);
page.dispose();
console.log("usage slow runtime: passed");
