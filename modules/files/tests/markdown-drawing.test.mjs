import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { test } from "node:test";
import { api } from "../../../core/platform/api.js";
import { deferred, same, settle } from "../../../tests/lib/dom.mjs";
import { WidgetType } from "../../../vendor/codemirror/cm.js";
import { projectFile, viewerFixture } from "./viewer-fixture.mjs";

async function markdownFixture() {
  const fixture = await viewerFixture();
  const { document, window } = fixture;
  globalThis.getComputedStyle = window.getComputedStyle;
  Object.getPrototypeOf(document.createElement("canvas")).getContext = () => ({
    clearRect() {}, fillRect() {}, getImageData: () => ({ data: [0, 0, 0, 255] }),
  });
  return fixture;
}

test("an empty link keeps sibling Markdown marks and renders an editable page", async (context) => {
  const { viewer, host } = await markdownFixture();
  context.after(() => viewer.close());
  const failures = [];
  Object.defineProperty(globalThis, "reportError", { configurable: true, value: (error) => failures.push(error) });
  context.after(() => Reflect.deleteProperty(globalThis, "reportError"));
  const content = "# Title\n\n[](https://example.com) and `code`";
  context.mock.method(api, "projectFile", async () => ({ kind: "markdown", content, version: "1", editable: true }));
  viewer.open(projectFile("notes.md"));
  await until(() => host.querySelector(".cm-xo-page"), "Files did not mount the Markdown page");
  assert.equal(host.querySelector(".cm-md-h1")?.textContent, "Title");
  assert.ok(host.querySelector(".cm-md-code")?.textContent.includes("code"), "a valid sibling mark still renders");
  assert.deepEqual(failures, []);
});

test("invalid rich input keeps its fallback and a drawing failure leaves other nodes live", { timeout: 3000 }, async (context) => {
  const { window, host } = await markdownFixture();
  const failures = [];
  Object.defineProperty(globalThis, "reportError", { configurable: true, value: (error) => failures.push(error) });
  context.after(() => Reflect.deleteProperty(globalThis, "reportError"));
  const entered = deferred();
  const pending = deferred();
  const obsoleteStarted = deferred();
  const obsolete = deferred();
  const diagramModule = new URL("../../../vendor/mermaid/mermaid.esm.min.mjs", import.meta.url).href;
  const diagramFailure = new TypeError("Mermaid renderer failed");
  globalThis.renderFilesDiagram = (source) => {
    if (source.startsWith("broken")) throw diagramFailure;
    if (source.startsWith("working")) return { svg: "<svg data-working></svg>" };
    if (source.startsWith("retired")) { entered.resolve(); return pending.promise; }
    if (source.startsWith("obsolete")) { obsoleteStarted.resolve(); return obsolete.promise; }
    throw Object.assign(new Error("No diagram type detected"), { name: "UnknownDiagramError" });
  };
  const hooks = registerHooks({
    load(url, options, next) {
      if (url !== diagramModule) return next(url, options);
      return {
        format: "module", shortCircuit: true,
        source: "export default { initialize() {}, render: (_, source) => globalThis.renderFilesDiagram(source) };",
      };
    },
  });
  context.after(() => { pending.resolve({ svg: "<svg></svg>" }); hooks.deregister(); delete globalThis.renderFilesDiagram; });
  const rendererFailure = new Error("KaTeX renderer failed");
  window.katex = {
    renderToString(tex) {
      if (tex === "broken") throw rendererFailure;
      return "<span data-rendered>drawn formula</span>";
    },
  };
  context.after(() => { delete window.katex; });

  const { createMarkdownWidgets } = await import("../markdown-widgets.js");
  const { BlockWidget } = createMarkdownWidgets(WidgetType);
  const view = { state: { doc: { length: 0 } }, dispatch() {}, focus() {} };
  const diagram = (source) => "```mermaid\n" + source + "\n```";
  const markdown = ["$broken$ and $good$", diagram("invalid diagram"), diagram("broken diagram"), diagram("working diagram")].join("\n\n");
  const block = new BlockWidget(markdown, 0);
  const element = block.toDOM(view);
  host.append(element);
  context.after(() => block.destroy(element));
  const good = element.querySelector('[data-tex="good"]');
  await until(() => element.querySelector("[data-working]"), "a renderer failure stopped the next diagram", 500);
  assert.deepEqual(failures, [rendererFailure, diagramFailure]);
  assert.match(element.querySelector(".md-dg-why").textContent, /couldn't be drawn/);
  assert.equal(element.querySelector('[data-tex="broken"]').textContent, "broken");
  assert.ok(good.querySelector("[data-rendered]"));
  same(element.querySelector('[data-tex="good"]'), good, "a failed drawing leaves a sibling node attached");

  const retiring = new BlockWidget(diagram("retired diagram"), 0);
  const retired = retiring.toDOM(view);
  host.append(retired);
  await entered.promise;
  retiring.destroy(retired);
  pending.resolve({ svg: "<svg></svg>" });
  await settle();
  assert.equal(retired.querySelector("svg") !== null, false, "a late drawing cannot update a retired widget");
  assert.equal(failures.length, 2);

  const { drawRichElement } = await import("../../../core/ui/markdown/rich.js");
  const reused = new BlockWidget(diagram("obsolete drawing"), 0);
  const mounted = reused.toDOM(view);
  host.append(mounted);
  context.after(() => reused.destroy(mounted));
  const figure = mounted.querySelector("figure");
  const oldDraw = drawRichElement(figure);
  await obsoleteStarted.promise;
  figure.querySelector(".md-dg-src code").textContent = "working replacement";
  obsolete.reject(new TypeError("Obsolete drawing failed"));
  await oldDraw;
  same(mounted.querySelector("figure"), figure);
  assert.equal(figure.classList.contains("is-failed"), false, "an old failure cannot mark the reused figure");
  assert.equal(failures.length, 2, "the old failure does not report against the current source");
  await drawRichElement(figure);
  assert.ok(figure.querySelector("[data-working]"), "the reused figure draws its current source");
});

async function until(condition, message, attempts = 50) {
  for (let attempt = 0; attempt < attempts; attempt++) {
    if (condition()) return;
    await settle();
  }
  assert.fail(message);
}
