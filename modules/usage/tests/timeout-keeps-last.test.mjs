// A runtime whose read times out keeps its last count, with a quiet note, instead of dropping out of the page.
import assert from "node:assert/strict";
import { ApiError } from "../../../core/platform/http.js";
import { createUsagePage } from "../page.js";

const tokens = (input) => ({ input, output: 0, cache_read: 0, cache_write: 0, reasoning: 0 });
const usage = (n) => ({ total_cost: 0, total_tokens: tokens(n), daily: [{ date: "2026-11-27", tokens: n }], by_model: [] });
let slow = false;
const source = {
  runtimes: async () => ["claude_code", "codex"],
  async usage(name) {
    if (name === "claude_code" && slow) throw new ApiError(0, "timeout", "XO didn't answer in 15 s.");
    return usage(name === "codex" ? 100 : 900);
  },
};
let painted = "";
const page = createUsagePage({ paint: (_, html) => { painted = html; } }, source);
await page.open();
assert.match(painted, /<b class="us-total">1,000<\/b>/);

slow = true;
await page.open();
assert.match(painted, /<b class="us-total">1,000<\/b>/, "Claude Code's last count stays in the total");
assert.match(painted, /class="set-note">Couldn't read Claude Code just now/, "with a quiet note");
assert.doesNotMatch(painted, /set-err/, "not an error");

const fresh = createUsagePage({ paint: (_, html) => { painted = html; } }, source);
await fresh.open();
assert.match(painted, /set-err">Couldn't read Claude Code's usage/, "with nothing to keep, a timeout is still a failure");
page.dispose(); fresh.dispose();
console.log("usage timeout keeps last: passed");
