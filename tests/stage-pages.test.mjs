// @ts-check

import assert from "node:assert/strict";
import { test } from "node:test";
import { declarationsFor, resolveValue, stylesheetRows, tokenValuesFor, valuesFor } from "./lib/css-snapshot.mjs";
import { stageFixture } from "./lib/stage-fixture.mjs";

const value = (selector, property) => declarationsFor(selector, property).find((row) =>
  !row.context.some((scope) => scope.at === "media"))?.value;

test("pages cover the underlying sections and the shared header stays at the standard height", () => {
  const hidden = ".stage.is-covered .stg-frames";
  assert.equal(value(hidden, "visibility"), "hidden");
  assert.equal(value(hidden, "content-visibility"), "hidden");
  for (const [property, expected] of Object.entries({
    flex: "1", "min-height": "0", display: "grid", "grid-template": "minmax(0,1fr)/minmax(0,1fr)",
  })) assert.equal(value(".stg-body", property), expected, property);

  const properties = {
    position: "relative", "z-index": "2", flex: "none", "box-sizing": "border-box",
    display: "flex", "align-items": "center", gap: "4px", height: "40px",
  };
  for (const [property, expected] of Object.entries(properties)) {
    assert.equal(resolveValue(value(".stg-bar", property)), expected, property);
  }
  const bars = declarationsFor(".stg-bar", "height").filter((row) => !row.context.some((scope) => scope.at === "media"));
  assert.equal(bars.length, 1);
  assert.ok(declarationsFor((selector) => /(?:\.stage |\.stg-).*\[data-page\]|\.stg-tabs?\b/.test(selector)).length === 0);
  assert.equal(value(".stage .stg-t:has(.pg-back)", "align-items"), "center");
  assert.equal(resolveValue(value(".stage .stg-t:has(.pg-back)", "gap")), "4px");
});

test("docked viewers use the panel width and do not hide the conversation dock", () => {
  const main = "body.viewer-open:not(.stage-open):not(.panel-open) .main";
  assert.ok(declarationsFor(main, "--rp").some((row) => row.value === "var(--vw)"));
  assert.ok(stylesheetRows.some((row) => row.property === "--sw" && resolveValue(row.value) === "360px"));
  assert.deepEqual(stylesheetRows.filter((row) => row.property === "--vw").map((row) => row.value), ["var(--sw)"]);
  assert.deepEqual(declarationsFor((selector) => /^body\.map-open.*\.main$/.test(selector), "--rp"), []);
  assert.ok(!declarationsFor("body.viewer-open .tdock", "display").some((row) => row.value === "none"));
});

test("the head preserves control width and aligns the back indicator on the icon", () => {
  assert.equal(value(".stg-ic", "flex"), "none");
  assert.equal(value(".stg-ic", "display"), "grid");
  assert.equal(value(".stg-ic", "place-items"), "center");
  for (const property of ["width", "height"]) assert.equal(value(".stg-ic", property), "var(--h-ctl)");
  const dot = ".stage .pg-dot";
  assert.equal(value(dot, "position"), "absolute");
  for (const property of ["top", "right"]) assert.equal(value(dot, property), "calc((var(--h-ctl) - var(--ic)) / 2)");
  for (const property of ["width", "height"]) assert.equal(value(dot, property), "var(--badge-dot)");
  assert.equal(tokenValuesFor().get("--badge-dot"), "calc(var(--ic) * 3 / 8)");
  assert.deepEqual(valuesFor(".stg-acts", "flex"), ["none"]);
  assert.deepEqual(valuesFor(".fr-a", "flex"), ["none"]);
  assert.deepEqual(valuesFor(".fr-a", "margin-left"), ["auto"]);
});

test("the panel keeps one width and restores sections on leaving a page", async () => {
  const { document, window, panel, stage, storage, animations, visit, shellKeys } = await stageFixture({ reduced: false });
  const { createFilesPage } = await import("../modules/files/page.js");
  const fileCalls = [];
  const viewer = { hasFile: true, file: { name: "notes.md" }, close: (opts) => fileCalls.push(opts), confirmClose: () => true };
  const files = { mount() {}, fold() {}, show() {}, hide: () => fileCalls.push("hidden"), reveal() {} };
  const filesPage = createFilesPage({ stage: panel, files, viewer, view: () => "p:one" });
  panel.page("files", filesPage.entry);
  panel.page("thread", { title: "Thread", mount() {} });
  const sections = stage.querySelector(".stg-frames");
  const allFiles = stage.querySelector(".stg-acts [data-open-files]");
  assert.ok(allFiles?.classList.contains("stg-ic"));
  assert.ok(!sections.querySelector("[data-open-files]"), "the panel omits the redundant Files shortcut");
  const follow = stage.querySelector("[data-follow]");
  assert.equal(follow.children.length, 1);
  assert.equal(follow.firstElementChild.localName, "svg");
  assert.ok(!stage.querySelector(".xd-arc"), "the inactive diff has no progress arc");
  panel.open();

  const width = () => document.documentElement.style.getPropertyValue("--sw");
  assert.equal(width(), "576px");
  const hit = (target, key) => target.dispatchEvent(
    Object.assign(new window.Event("keydown", { bubbles: true, cancelable: true }), { key }),
  );
  hit(stage.querySelector(".stg-grip"), "ArrowLeft");
  assert.equal(width(), "592px");
  assert.equal(storage.get("xo-stage-w2"), "592");
  allFiles.click();
  await Promise.resolve();
  assert.equal(stage.dataset.stgPage, "files");
  assert.equal(stage.classList.contains("is-covered"), true);
  assert.equal(stage.querySelector(".stg-pg").style.width ?? "", "");
  assert.equal(width(), "592px");
  assert.equal(stage.querySelector(".stg-t b").textContent, "notes.md");
  assert.ok(stage.querySelector(".stg-t .pg-back + .pg-lead"));
  const tokens = tokenValuesFor();
  const first = animations.find((animation) => animation.element.classList.contains("stg-pg"));
  assert.equal(first.timing.duration, Number.parseFloat(tokens.get("--d-sheet")));
  assert.equal(first.timing.easing, tokens.get("--ease"));
  const offset = resolveValue(tokens.get("--s-3"));
  assert.equal(first.frames[0].transform, "translateX(" + offset + ")");
  const surface = sections.querySelector(".tg-box");
  const preserved = document.createElement("i");
  surface.append(preserved);
  panel.sync();
  assert.ok(preserved.isConnected);
  assert.ok(!stage.querySelector('.stg-bar [role="tablist"],[data-page]'));
  allFiles.click();
  await Promise.resolve();
  assert.equal(stage.dataset.stgPage, undefined);
  assert.ok(fileCalls.some((call) => call?.restore === false));
  assert.ok(fileCalls.includes("hidden"));
  assert.equal(stage.classList.contains("is-covered"), false);
  assert.ok(animations.some((animation) => animation.frames[0].opacity === 1 && animation.frames[1].opacity === 0));

  panel.show("thread");
  shellKeys(true);
  hit(stage, "Escape");
  assert.equal(stage.dataset.stgPage, "thread");
  shellKeys(false);
  hit(stage, "Escape");
  assert.equal(stage.dataset.stgPage, undefined);
  panel.show("thread");
  visit("home");
  assert.equal(stage.hidden, true);
  assert.equal(panel.button("home"), "");
  assert.equal(panel.show("files"), false);
  visit("p:two");
  assert.equal(stage.hidden, false);
  assert.equal(stage.dataset.stgPage, undefined);
  assert.equal(width(), "592px");
  stage.querySelector("[data-stg-close]").click();
  assert.equal(stage.hidden, true);
});
