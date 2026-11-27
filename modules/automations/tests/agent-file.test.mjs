// @ts-check

import assert from "node:assert/strict";
import { test } from "node:test";
import { fileOf, frontOf, instructionsOf, keyOf, mayOf, ownerOf, pathOf, slugOf, titleOf, toolsOf } from "../agent-file.js";
import { MAY } from "./fakes.mjs";

const draft = { name: "release-checker", description: "Checks: what's live.", body: "Read what's live.\n\nSay what isn't.", runtime: "claude_code",
  model: null, effort: "high", tools: ["read", "search"], disallowedTools: [], mcpServers: null, level: /** @type {const} */ ("project"),
  project: "alpha" };

test("a draft writes front matter its own reader reads back, then the instructions", () => {
  const text = fileOf(draft);
  assert.ok(text.startsWith("---\nname: \"release-checker\"\n"));
  assert.deepEqual(frontOf(text), { name: "release-checker", description: "Checks: what's live.", runtime: "claude_code", effort: "high",
    tools: ["read", "search"] });
  assert.equal(instructionsOf(text), "Read what's live.\n\nSay what isn't.\n");
});

test("names turn into file names and back", () => {
  assert.equal(slugOf("  Release Checker!  "), "release-checker");
  assert.equal(titleOf("release-checker"), "Release checker");
  assert.equal(keyOf({ level: "space", project: "", name: "a" }), "space::a");
});

test("a project's agents live in its .xo/agents, the Space's in its own folder", () => {
  assert.equal(ownerOf("project", "alpha"), "alpha");
  assert.equal(ownerOf("space", "alpha"), ".space");
  assert.equal(pathOf("project", "a"), ".xo/agents/a.md");
  assert.equal(pathOf("space", "a"), "a.md");
});

test("each May choice keeps what the narrower ones allow, and a list matching none is its own", () => {
  assert.deepEqual(toolsOf("edit", MAY), ["read", "search", "list", "edit", "create", "delete"]);
  assert.equal(toolsOf("all", MAY), null);
  assert.equal(mayOf(["list", "search", "read"], MAY), "read");
  assert.equal(mayOf(toolsOf("run", MAY), MAY), "run");
  assert.equal(mayOf(null, MAY), "all");
  assert.equal(mayOf(["read"], MAY), "own");
});
