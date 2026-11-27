// @ts-check

import assert from "node:assert/strict";
import { test } from "node:test";
import { createPersonasStore } from "../personas.js";
import { fakePersonaApi, persona } from "./fakes.mjs";

const lists = { "": [persona({ level: "space", path: "helper.md", name: "helper" })], alpha: [persona()] };

/** @param {ReturnType<typeof fakePersonaApi>} fake */
const store = (fake) => createPersonasStore({ api: fake.api, report() {} });

test("each project's list is read once, and an agent is found by its key", async () => {
  const fake = fakePersonaApi(lists), personas = store(fake);
  assert.equal(personas.seen("alpha"), null);
  await personas.refresh("alpha");
  assert.equal(personas.seen("alpha")?.agents[0].owner, "alpha");
  assert.equal(personas.find("project:alpha:release-checker")?.version, "v1");
  assert.deepEqual(fake.calls.filter((c) => c.name === "personas").map((c) => c.args[0]), ["alpha"]);
});

test("a project's first agent makes its folder, and a folder already there is fine", async () => {
  const fake = fakePersonaApi(lists), personas = store(fake);
  await personas.save({ level: "project", project: "alpha", name: "new-one", text: "x", base: null });
  assert.deepEqual(fake.calls.slice(0, 2).map((c) => [c.name, ...c.args]),
    [["mkdirProject", "alpha", ".xo/agents"], ["saveProjectFile", "alpha", ".xo/agents/new-one.md", "x", null]]);
});

test("a Space agent saves under .space with its version, and a renamed one leaves no old file", async () => {
  const fake = fakePersonaApi(lists), personas = store(fake);
  await personas.refresh("");
  const was = personas.find("space::helper");
  assert.ok(was);
  await personas.save({ level: "space", project: "", name: "helper", text: "y", base: "v1", was });
  await personas.save({ level: "space", project: "", name: "aide", text: "z", base: "v1", was });
  const writes = fake.calls.filter((c) => c.name !== "personas").map((c) => [c.name, ...c.args]);
  assert.deepEqual(writes, [["saveProjectFile", ".space", "helper.md", "y", "v1"], ["saveProjectFile", ".space", "aide.md", "z", null],
    ["deleteProjectFile", ".space", "helper.md", null]]);
});

test("bringing one in leaves its unmappable settings out only when asked", async () => {
  const fake = fakePersonaApi(lists), personas = store(fake);
  const item = { id: "space:reviewer", adapter: "claude_code", level: /** @type {const} */ ("space"), name: "reviewer", text: "",
    dropped: ["hooks"], from: "Claude Code", problems: [] };
  await personas.importOne(item, "", true);
  await personas.importOne(item, "alpha", false);
  assert.deepEqual(fake.calls.filter((c) => c.name === "importPersona").map((c) => c.args[0]), [
    { adapter: "claude_code", id: "space:reviewer", without_dropped: true }, { adapter: "claude_code", id: "space:reviewer", project: "alpha" }]);
});
