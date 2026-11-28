// The Usage page through its public entry: what it reads for each runtime, what it shows, and a new period.
import assert from "node:assert/strict";
import { ApiError } from "../../../core/platform/http.js";
import { createUsagePage } from "../page.js";

const tokens = (input, output, cache_read = 0, cache_write = 0) => ({ input, output, cache_read, cache_write, reasoning: 0 });
const day = (date, n) => ({ date, tokens: n, cost: 0, messages: 1 });
const usage = (total, daily, extra = {}) => ({ total_cost: 0, total_tokens: total, daily, by_model: [], ...extra });
const USAGE = {
  codex: usage(tokens(100, 50, 850), [day("2026-11-26", 100), day("2026-11-27", 50)], {
    by_model: [{ model_id: "gpt-6.2-sol", total_tokens: tokens(100, 50, 850), message_count: 3 }],
  }),
  claude_code: usage(tokens(10, 1990, 7000, 1000), [day("2026-11-26", 0), day("2026-11-27", 2000)]),
  grok_build: usage(tokens(5, 5), [day("2026-11-27", 10)], { total_cost: 1.5 }),
};
const asked = [];
let painted = "";
const source = {
  runtimes: async () => ["codex", "claude_code", "cursor", "antigravity", "grok_build"],
  async usage(name, days) {
    asked.push(`${name}:${days}`);
    if (name === "cursor") throw new ApiError(501, "unsupported", "cursor has no usage.");
    if (name === "antigravity") throw new ApiError(0, "timeout", "XO didn't answer in 30 s.");
    return structuredClone(USAGE[name]);
  },
};
const page = createUsagePage({ paint: (id, html) => { assert.equal(id, "usage"); painted = html; } }, source);

const opening = page.open();
assert.match(painted, /Reading each runtime/, "it says it is reading until the answers come");
await opening;
assert.deepEqual(asked, ["codex:30", "claude_code:30", "cursor:30", "antigravity:30", "grok_build:30"]);
assert.match(painted, /<b class="us-total">11K<\/b>/, "the headline counts every token, cache included (11,010)");
assert.ok(painted.indexOf("Claude Code") < painted.indexOf("Codex"), "the runtime that used most comes first");
assert.match(painted, /Couldn't read Antigravity's usage\. XO didn&#39;t answer in 30 s\./, "a runtime that failed says so");
assert.doesNotMatch(painted, /Cursor/, "a runtime with no usage records is left out, not shown as failed");
assert.match(painted, /data-chart="bar"/, "the days are drawn as bars");
assert.match(painted, /Grok Build<\/dt><dd>10<\/dd><dd class="us-note">&lt;1%<\/dd>/, "a sliver of a share reads as under one percent");
assert.match(painted, /GPT-6\.2 Sol/, "a model row it can read is listed");
assert.match(painted, /<dt>Cost<\/dt><dd>\$1\.50<\/dd><dd class="us-note">Grok Build<\/dd>/, "a cost shows only where reported");
assert.match(painted, /Claude Code and Codex don&#39;t report a cost/, "and the others say they have none");
assert.match(painted, /<dt>Busiest day<\/dt><dd>27 Nov<\/dd><dd class="us-note">2,060 new tokens<\/dd>/, "the busiest day is named");

asked.length = 0;
const button = { closest: (sel) => (sel === "[data-us-days]" ? { getAttribute: () => "7" } : null) };
assert.equal(page.click(button), true);
await new Promise((resolve) => setTimeout(resolve, 0));
await new Promise((resolve) => setTimeout(resolve, 0));
assert.ok(asked.every((a) => a.endsWith(":7")) && asked.length === 5, "a new period reads every runtime again");
assert.match(painted, /data-us-days="7" aria-checked="true"/);
assert.equal(page.click({ closest: () => null }), false, "a click elsewhere isn't its own");
page.dispose();
console.log("usage page: passed");
