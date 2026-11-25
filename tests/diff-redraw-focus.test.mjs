import assert from "node:assert/strict";
import test from "node:test";
import { deferred, dom, same, settle } from "./lib/dom.mjs";
import { createScope } from "../core/kernel/scope.js";
import { createViewerDiff } from "../modules/files/viewer-diff.js";
import { bindViewerEvents } from "../modules/files/viewer-events.js";

async function mount(t) {
  const { document } = await dom('<div id="viewer"><button data-vw-show="changes">Changes</button></div>');
  const el = document.querySelector("#viewer");
  const V = { file: { project: "p", rel: "notes.txt" }, split: false, open: true, show: "changes" };
  const queue = [];
  const patch = () => deferred();
  let change = { scope: { key: "p|" }, path: "notes.txt", file: {}, base: "commit" };
  let renders = 0;
  const { diffBody, drawDiff } = createViewerDiff({
    V, currentChange: () => change,
    changes: { patchAt() { const read = patch(); queue.push(read); return read.promise; } },
    async diff(host) {
      const draw = deferred();
      queue.push(draw);
      await draw.promise;
      host.append(document.createElement("section"));
      return { destroy() {}, split() {}, update() {} };
    },
    isImageChange: () => false, canSave: () => false,
    inRegion: (_, replace) => replace(),
  });
  const host = diffBody();
  el.append(host);
  const scope = createScope();
  t.after(scope.dispose);
  bindViewerEvents({
    el, V, scope,
    render() { renders++; void drawDiff(change); },
  });
  const read = async () => { queue.shift().resolve("patch"); await settle(); };
  void drawDiff(change);
  await read();
  queue.shift().reject(new Error("renderer failed"));
  await settle();
  return {
    document, host, queue, read, renders: () => renders,
    changeFile() { change = { ...change, path: "next.txt" }; void drawDiff(change); },
  };
}

test("a failed renderer keeps the focused retry busy and ignores another press during the draw", async (t) => {
  const { document, host, queue, read, renders } = await mount(t);
  const button = host.querySelector("[data-vw-diff-redraw]");
  assert.ok(button.matches('[data-vw-show="changes"]'));
  button.focus();
  button.click();
  await read();
  same(host.querySelector("[data-vw-diff-redraw]"), button);
  same(document.activeElement, button);
  assert.equal(button.getAttribute("aria-busy"), "true");
  assert.equal(button.getAttribute("aria-disabled"), "true");
  assert.equal(button.textContent, "Trying again…");
  assert.equal(host.querySelector('[role="status"] p').textContent, "Drawing this diff…");
  button.click();
  assert.equal(renders(), 1);
  queue.shift().reject(new Error("renderer failed again"));
  await settle();
  const again = host.querySelector("[data-vw-diff-redraw]");
  assert.equal(again.textContent, "Try again");
  assert.equal(again.hasAttribute("aria-busy"), false);
  again.click();
  await read();
  queue.shift().resolve();
  await settle();
  assert.ok(host.querySelector("section"));
  assert.ok(!host.querySelector("[data-vw-diff-redraw]"));
});

test("another change shows its own read state after the previous drawing failed", async (t) => {
  const { host, changeFile, read, queue } = await mount(t);
  changeFile();
  assert.match(host.textContent, /Reading the change/);
  assert.ok(!host.querySelector("[data-vw-diff-redraw]"));
  await read();
  queue.shift().resolve();
  await settle();
  assert.ok(host.querySelector("section"));
});
