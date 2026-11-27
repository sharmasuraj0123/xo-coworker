// @ts-check

import assert from "node:assert/strict";
import { agentDetailHtml, agentGroupHtml, importHtml } from "../agent-views.js";
import { sheet } from "../../../tests/lib/cascade.mjs";
import { persona } from "./fakes.mjs";

const agent = /** @type {never} */ (persona({ level: "space", project: "" }));
const state = { where: "page", body: "Research", menu: true, confirm: false, trying: null, may: {}, projects: [], project: "",
  projectName: () => "Alpha" };
const opened = agentDetailHtml(agent, /** @type {never} */ (state));
assert.match(opened, /data-ag-act="ag-file"[^>]*>.*Edit as file/, "••• opens its menu, every icon in it drawn from the pack, each row one the agent side acts on");
assert.match(opened, /data-ag-act="ag-delete"/);

const rows = agentGroupHtml("Every project", [agent], null);
assert.match(rows, /^<h2 class="au-day">Every project<\/h2><ul class="au-list is-plain">/, "an agent list has no time column");
assert.doesNotMatch(rows, /class="au-t"/, "so its rows start at the heading, not a time's width in");
assert.doesNotMatch(importHtml(/** @type {never} */ ([{ name: "x", text: "", from: "Claude Code", level: "space", dropped: [],
  problems: [] }]), "b"), /class="au-t"/);
const css = sheet(new URL("../automations.css", import.meta.url));
assert.match(css, /\.au-list\.is-plain\{grid-template-columns:auto minmax\(0,1fr\) auto auto\}/, "tile, name, what uses it, its end");
console.log("agent-detail-view: ok");
