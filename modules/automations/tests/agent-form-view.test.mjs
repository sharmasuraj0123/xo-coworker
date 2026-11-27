// @ts-check

import assert from "node:assert/strict";
import { agentFormHtml } from "../agent-views.js";

const draft = { name: "", description: "", body: "", runtime: "codex", model: "gpt-6.1-terra", effort: null, tools: [], level: "space",
  project: "" };
const form = (models = /** @type {null | Record<string, unknown>[]} */ (null)) => agentFormHtml(/** @type {never} */ ({
  title: "", may: "read", problem: "", draft, runtimes: ["claude_code", "codex"], models, busy: "x", isNew: true, places: [] }));

const waiting = form();
assert.match(waiting, /<xo-select name="model" class="set-sel" aria-label="Model" aria-busy="true">/, "the model waits for its runtime's list");
assert.doesNotMatch(waiting, /<input name="model"/, "never a text box");
assert.match(waiting, /<option value="gpt-6.1-terra" selected>GPT-6.1 Terra<\/option>/, "the chosen one, as people say it, while it waits");
assert.match(waiting, /<option data-agm="openai" value="codex" selected>Codex<\/option>/, "a runtime with its mark");
const listed = form([{ id: "gpt-6.1-terra", name: "GPT-6.1 Terra" }, { id: "gpt-6.1-mini", name: "GPT-6.1 Mini" }]);
assert.match(listed, /aria-label="Model"><option value="">Default<\/option><option value="gpt-6.1-terra" selected>/);
const catalog = form([{ id: "default", name: "Default (recommended)", is_default: true },
  { id: "opus", name: "Opus 5.5", family: "opus", family_default: true }, { id: "claude-opus-5", name: "Opus 5", family: "opus" }]);
const offered = /aria-label="Model">(.*?)<\/xo-select>/.exec(catalog)?.[1] ?? "";
assert.deepEqual([...offered.matchAll(/>([^<]+)<\/option>/g)].map(([, w]) => w), ["Default", "GPT-6.1 Terra", "Opus 5.5"],
  "one Default, then one model per family, as the app's other pickers offer them");
console.log("agent-form-view: ok");
