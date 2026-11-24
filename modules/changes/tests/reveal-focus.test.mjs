import assert from "node:assert/strict";
import test from "node:test";
import { dom, same } from "../../../tests/lib/dom.mjs";
import { createChangesFrame } from "../frame.js";

async function mount() {
  const { document } = await dom('<button id="outside">Outside</button><div id="changes"></div>');
  const host = document.querySelector("#changes");
  const outside = document.querySelector("#outside");
  const files = new Map(Array.from({ length: 103 }, (_, i) => {
    const path = `file-${i}.txt`;
    return [path, { path, additions: 1, deletions: 0 }];
  }));
  const changes = {
    scope: () => ({ key: "repo|", project: "repo" }),
    of: () => ({ state: "ok", files }),
    activity: () => ({ sig: "0", live: new Set(), last: null }),
    patch: async () => null,
  };
  let afterClick = () => {};
  const frame = createChangesFrame({
    host, changes, view: () => "p:repo", openFile() {},
    onChange() { afterClick(); frame.paint(); },
  });
  frame.paint();
  return { document, outside, host, files, frame, beforePaint(fn) { afterClick = fn; } };
}

test("Changes preserves the focused row when live counts update", async () => {
  const { document, host, files, frame } = await mount();
  const row = host.querySelector('[data-cx="file-0.txt"]');
  row.focus();
  files.get("file-0.txt").additions = 2;
  frame.paint();
  same(host.querySelector('[data-cx="file-0.txt"]'), row);
  same(document.activeElement, row);
  assert.ok(row.querySelector('[aria-label="2 added, 0 removed"]'));
});

test("Show them moves focus to the first newly revealed Changes row", async () => {
  const { document, host } = await mount();
  const button = host.querySelector("[data-cx-all]");
  assert.ok(!host.querySelector('[data-cx="file-100.txt"]'));
  button.focus();
  button.click();
  const first = host.querySelector('[data-cx="file-100.txt"]');
  assert.ok(first);
  same(document.activeElement, first);
});

test("Show them leaves focus alone when it has already moved outside Changes", async () => {
  const { document, outside, host, beforePaint } = await mount();
  beforePaint(() => outside.focus());
  host.querySelector("[data-cx-all]").click();
  assert.ok(host.querySelector('[data-cx="file-100.txt"]'));
  same(document.activeElement, outside);
});
