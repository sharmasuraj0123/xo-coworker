// @ts-check
import assert from "node:assert/strict";
import { test } from "node:test";
import { createSavedSoon } from "../saved.js";

test("saving again restarts only that file's quiet interval", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  /** @type {string[][]} */
  const refreshed = [];
  const savedSoon = createSavedSoon({ saved: (project, rel) => { refreshed.push([project, rel]); } });
  const first = { project: "one", rel: "notes.md" };
  const second = { project: "two", rel: "notes.md" };
  savedSoon(first);
  savedSoon(second);
  t.mock.timers.tick(1000);
  savedSoon(first);
  t.mock.timers.tick(1499);
  assert.deepEqual(refreshed, []);
  t.mock.timers.tick(1);
  assert.deepEqual(refreshed, [["two", "notes.md"]]);
  t.mock.timers.tick(999);
  assert.deepEqual(refreshed, [["two", "notes.md"]]);
  t.mock.timers.tick(1);
  assert.deepEqual(refreshed, [["two", "notes.md"], ["one", "notes.md"]]);
});
