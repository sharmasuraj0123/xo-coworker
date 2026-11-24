// @ts-check
import assert from "node:assert/strict";
import { dom } from "./lib/dom.mjs";
import { createWorkspaceHeader } from "../shell/workspace-header.js";

const { document } = await dom('<header id="ws-head"></header>');
const state = { view: "ws" };
const projects = [{ id: "first" }];
const render = createWorkspaceHeader(() => state.view, () => projects);
const header = document.querySelector("#ws-head");

render();
assert.equal(header.querySelector("h2").textContent, "Workspace");
const home = header.querySelector("p button[data-go=home]");
home.focus();
projects.push({ id: "second" });
render();
assert.match(header.querySelector("p").textContent, /across all 2 projects/);
assert.equal(header.querySelector("p button[data-go=home]") === home, true);
assert.equal(document.activeElement === home, true);

state.view = "home";
render();
assert.equal(header.hidden, true);
