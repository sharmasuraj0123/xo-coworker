// @ts-check

import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { test } from "node:test";
import { api } from "../../../core/platform/api.js";
import { settle } from "../../../tests/lib/dom.mjs";

test("the viewer exposes a pending retry, ignores a second press and renders the eventual result", async (t) => {
  const hooks = registerHooks({
    load(url, context, next) {
      if (!url.endsWith("/modules/files/editor.js")) return next(url, context);
      return { format: "module", shortCircuit: true, source: `
        export function prefetch() {}
        export async function mount(host) {
          await new Promise((resolve, reject) => {
            document.dispatchEvent(new CustomEvent("test-editor-mount", { detail: { resolve, reject } }));
          });
          const input = document.createElement("textarea");
          host.append(input);
          return { view: { contentDOM: input }, focus: () => input.focus(), destroy: () => input.remove() };
        }` };
    },
  });
  const { viewerFixture, projectFile } = await import("./viewer-fixture.mjs").finally(() => hooks.deregister());
  t.mock.method(api, "projectFile", async () => ({ kind: "code", content: "hello", version: "v1", editable: true }));
  const report = t.mock.method(console, "error", () => {});
  const { viewer, document, host, click } = await viewerFixture();
  t.after(viewer.dispose);
  /** @type {{ resolve: () => void, reject: (error: Error) => void }[]} */
  const attempts = [];
  document.addEventListener("test-editor-mount", (event) => attempts.push(/** @type {CustomEvent} */ (event).detail));
  viewer.open(projectFile("notes.txt"));
  await settle();
  assert.equal(attempts.length, 1);
  const retry = () => host.querySelector("[data-vw-retry]");
  const failed = new Error("Editor unavailable");
  attempts[0].reject(failed);
  await settle();
  assert.equal(retry()?.textContent, "Try again");
  click("[data-vw-retry]");
  assert.equal(attempts.length, 2);
  assert.equal(retry()?.getAttribute("aria-busy"), "true");
  assert.equal(retry()?.getAttribute("aria-disabled"), "true");
  assert.equal(retry()?.textContent, "Trying again…");
  assert.equal(host.querySelector(".vw-empty[role=status] p")?.textContent, "Drawing this file…");
  click("[data-vw-retry]");
  assert.equal(attempts.length, 2);
  attempts[1].reject(failed);
  await settle();
  assert.equal(retry()?.textContent, "Try again");
  assert.equal(report.mock.callCount(), 2);
  click("[data-vw-retry]");
  attempts[2].resolve();
  await settle();
  assert.equal(retry(), null);
  assert.ok(host.querySelector(".vw-file textarea"));
});
