import assert from "node:assert/strict";
import { test } from "node:test";
import { createChangeChipRoute } from "../chip-route.js";

class FakeChip {
  getAttribute(name) { return name === "data-file" ? "src/example.js" : null; }
}

globalThis.HTMLElement = FakeChip;
globalThis.CSS = { escape: (path) => path };

function fixture({ stage = true, changed = true } = {}) {
  const calls = [], chip = new FakeChip();
  const target = { closest: (selector) => selector === ".tb-cf[data-file]" ? chip : null };
  const route = createChangeChipRoute({
    changes: {
      forTarget(view, path) { assert.equal(view, "t:example"); return changed ? { path } : null; },
      scope: () => ({ project: "project", worktree: "worktree" }),
    },
    conversationAt: () => ({ view: "t:example", follow: { unpin: (row) => calls.push(["unpin", row]) } }),
    showChange: (path) => { calls.push(["stage", path]); return stage; },
    openFile: (file, from) => calls.push(["file", file, from]),
    focusAfterDraw: (selectors) => calls.push(["focus", ...selectors]),
    schedule: () => calls.push(["schedule"]),
  });
  return { calls, chip, target, route };
}

test("a change chip opens the Stage row and queues its original focus targets", () => {
  const { calls, chip, target, route } = fixture();
  assert.equal(route(target, { metaKey: false, ctrlKey: false }), true);
  assert.deepEqual(calls, [
    ["unpin", chip], ["stage", "src/example.js"], ["focus", '#stage [data-cx="src/example.js"]', "#stage .cx-pd"], ["schedule"],
  ]);
});

test("modifier clicks and a hidden Changes frame use the worktree file viewer", () => {
  for (const metaKey of [false, true]) {
    const { calls, chip, target, route } = fixture({ stage: metaKey });
    assert.equal(route(target, { metaKey, ctrlKey: false }), true);
    assert.deepEqual(calls.map(([type]) => type), metaKey ? ["unpin", "file"] : ["unpin", "stage", "file"]);
    assert.deepEqual(calls.at(-1), ["file", {
      path: "src/example.js", name: "example.js", project: "project", rel: ".xo/worktrees/worktree/src/example.js", show: "changes",
    }, chip]);
  }
});

test("unchanged files fall through to the existing shared file handler", () => {
  const { calls, target, route } = fixture({ changed: false });
  assert.equal(route(target, {}), false);
  assert.deepEqual(calls, []);
});
