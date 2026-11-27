// @ts-check

import assert from "node:assert/strict";
import { reportHtml } from "../detail.js";
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
console.log("report: ok");
