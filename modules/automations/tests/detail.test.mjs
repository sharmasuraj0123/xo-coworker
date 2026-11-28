// @ts-check

import assert from "node:assert/strict";
import { detailHtml, reportHtml } from "../detail.js";
import { automationsOf } from "../model.js";
import { job } from "./fakes.mjs";

const [a] = automationsOf(/** @type {never} */ ([job()]));
const said = { summary: "3 commits aren't live", thread: { chat: "chat_a", ts: "1.1" } };
const run = /** @type {never} */ ({ key: "r1", at: Date.UTC(2026, 10, 27, 8, 30), status: "ok", found: true, found_count: 2, ...said });

const reading = reportHtml(a, run, { text: null, failed: false });
assert.match(reading, /<div class="au-loading" role="status"><i class="spin is-load"/, "the report waits behind the spinner");
assert.doesNotMatch(reading, /au-prompt|Reading its report…/, "nothing stands in for the report while it is read");
assert.match(reportHtml(a, run, { text: "", failed: false }), /au-prompt">3 commits/, "a run with no report says its line");
assert.doesNotMatch(reportHtml(a, run, { text: "**3 commits**", failed: false }), /au-loading|au-prompt/, "the report, formatted");

const shown = { runs: [], runsFailed: false, menu: false, confirm: false, projectName: "Alpha", where: "panel", turning: new Map() };
const page = (over = {}) => detailHtml(automationsOf(/** @type {never} */ ([job(over)]))[0], /** @type {never} */ (shown));
const what = "What work was done in this project till now";
const once = page({ name: what, prompt: `${what}?`, every_seconds: null, schedule: null, first_run_at: "2031-03-10T23:31:00+00:00",
  next_run: "2031-03-10T23:31:00+00:00" });
assert.doesNotMatch(once, /au-next/, "a one-off's time and date say when, once");
assert.doesNotMatch(once, /Each time/, "nor does it repeat its name as what it does");
const daily = page({ name: "Morning check", prompt: "Look at what changed overnight" });
assert.match(daily, /<p class="au-next">Every day · next /, "a repeating one still says how often and when next");
assert.match(daily, /<h3>Each time<\/h3><p class="au-prompt">Look at what changed overnight/, "and what it does, when the name doesn't");
const bare = page({ agent: "codex", model: "gpt-6.1-terra", effort: "high" });
assert.match(bare, /<span>Agent<\/span><b><i class="agm agm-openai"[^>]*><\/i>Codex · GPT-6.1 Terra · Deep<\/b>/,
  "with no agent, what runs it, by its mark, as people read it");
assert.doesNotMatch(bare, /None, just the runtime|Runs on/, "said once");
console.log("detail: ok");
