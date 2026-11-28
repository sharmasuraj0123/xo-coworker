import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { test } from "node:test";
import { createViewerHead } from "../modules/files/viewer-head.js";
import { dom, same, settle } from "./lib/dom.mjs";
import { MAIN_LAYERS } from "../shell/overlays.js";

test("viewer focus prefers the editor, then the first visible usable header control", async () => {
  const { document } = await dom(`<section id="viewer" tabindex="-1">
    <header class="vw-top">
      <button disabled>Disabled</button>
      <button hidden>Hidden</button>
      <span inert><button>Inert</button></span>
      <button id="next">First visible choice</button>
    </header>
    <div id="editor" contenteditable="true"></div>
  </section>`);
  const el = document.querySelector("#viewer"), editor = document.querySelector("#editor");
  let editing = true;
  const TX = { h: { view: { contentDOM: editor } } };
  const { headFocus } = createViewerHead({ el, TX, showsText: () => editing });
  same(headFocus(), editor);
  same(document.activeElement, editor);
  editing = false;
  const next = document.querySelector("#next");
  same(headFocus(false), next);
  same(document.activeElement, editor, "the lookup alone leaves focus where it was");
  headFocus();
  same(document.activeElement, next);
  next.hidden = true;
  headFocus();
  same(document.activeElement, el);
});

test("a file just made moves focus to its editor after the mount finishes", async () => {
  const { document } = await dom(`<button id="opener">Make file</button>${MAIN_LAYERS}`);
  const { api } = await import("../core/platform/api.js");
  api.projectFile = async () => ({ kind: "code", content: "hello", version: "v1", editable: true });
  api.projectVersions = async () => ({ versions: [] });
  const hooks = registerHooks({
    load(url, context, next) {
      if (!url.endsWith("/modules/files/editor.js")) return next(url, context);
      return { format: "module", shortCircuit: true, source: `
        export function prefetch() {}
        export async function mount(host) {
          const input = document.createElement("textarea");
          input.setAttribute("aria-label", "File editor");
          host.append(input);
          return { view: { contentDOM: input }, focus: () => input.focus(), destroy: () => input.remove() };
        }` };
    },
  });
  const { createFileViewer } = await import("../modules/files/viewer.js").finally(() => hooks.deregister());
  const viewer = createFileViewer({ announce() {} }, { $: (selector) => document.querySelector(selector) });
  document.querySelector("#opener").focus();
  viewer.open({ project: "demo", name: "new.txt", rel: "new.txt", created: true });
  await settle();
  const field = document.querySelector('[aria-label="File editor"]');
  assert.equal(Boolean(field), true);
  same(document.activeElement, field);
  viewer.close();
});
