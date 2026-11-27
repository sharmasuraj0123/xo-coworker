// The daily chart counts every token, cache included, when each day row splits them out, and only new ones when any day doesn't.
import assert from "node:assert/strict";
import { createUsagePage } from "../page.js";

const tokens = (input, output, cache_read = 0, cache_write = 0) => ({ input, output, cache_read, cache_write, reasoning: 0 });
const day = (date, n, split) => ({ date, tokens: n, ...(split ? { total_tokens: split } : {}) });
const usage = (total, daily) => ({ total_cost: 0, total_tokens: total, daily, by_model: [] });

/** @param {Record<string, object>} all */
async function paint(all) {
  let painted = "";
  const page = createUsagePage({ paint: (_, html) => { painted = html; } }, {
    runtimes: async () => Object.keys(all), usage: async (name) => structuredClone(all[name]),
  });
  await page.open();
  page.dispose();
  return painted;
}

const split = await paint({
  claude_code: usage(tokens(10, 90, 9000), [day("2026-11-26", 100, tokens(10, 90, 9000)), day("2026-11-27", 0, tokens(0, 0))]),
  codex: usage(tokens(500, 100, 100), [day("2026-11-27", 600, tokens(500, 100, 100))]),
});
assert.match(split, /Tokens each day, cache included/, "with every day split, the chart counts every token");
assert.match(split, /<dt>Busiest day<\/dt><dd>26 Nov<\/dd><dd class="us-note">9,100 tokens<\/dd>/, "the busiest day counts cache too");

const partial = await paint({
  claude_code: usage(tokens(10, 90, 9000), [day("2026-11-26", 100, tokens(10, 90, 9000))]),
  openclaw: usage(tokens(500, 100), [day("2026-11-27", 600)]),
});
assert.match(partial, /New tokens in and out, each day/, "a day without the split falls back to new tokens");
assert.match(partial, /<dt>Busiest day<\/dt><dd>27 Nov<\/dd><dd class="us-note">600 new tokens<\/dd>/);
console.log("usage day split: passed");
