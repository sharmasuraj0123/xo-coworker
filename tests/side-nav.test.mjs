// @ts-check
import assert from "node:assert/strict";
import test from "node:test";
import { bootPage } from "./lib/page.mjs";

const { document } = await bootPage();

test("Artifacts carries no count", () => {
  const row = document.querySelector("#nv-arts");
  assert.ok(row);
  assert.deepEqual([...row.children].map((el) => el.className), ["nr-ic", "nr-name"]);
});

test("More wears the ⋯ glyph, not a dashboard", async () => {
  const { drawSidebarControls } = await import("../shell/frame-icons.js");
  drawSidebarControls();
  assert.equal(document.querySelector("#ic-more svg")?.getAttribute("data-xi"), "more");
});

test("Chats shows a quiet dot only while a direct chat works or waits on you", async () => {
  const { createSideRows } = await import("../shell/rail/rows.js");
  const { createScope } = await import("../core/kernel/scope.js");
  /** @type {"waiting" | "working" | ""} */
  let live = "";
  const side = /** @type {HTMLElement} */ (document.querySelector("#side")), matches = side.matches.bind(side);
  side.matches = (selector) => selector === ":focus-within" ? false : matches(selector);
  const scope = createScope();
  const render = createSideRows(scope, {
    view: () => "home", world: /** @type {never} */ ({ state: { threads: [] }, act: { coordinatorBusy: () => false } }),
    CH: { isChats: () => false, live: () => live }, D: { needItems: () => [] }, projects: () => [], convThread: () => null,
    isBusy: () => false, isHeld: () => false, askShort: () => "", projectIcon: () => "", folded: () => false,
  });
  const dot = document.querySelector("#chats-live"), row = document.querySelector("#nv-chats");
  const seen = () => [dot?.className, row?.getAttribute("aria-label") ?? null];
  render([]);
  assert.deepEqual(seen(), ["nr-live", null]);
  live = "working"; render([]);
  assert.deepEqual(seen(), ["nr-live is-working", "Chats, a chat is working"]);
  live = "waiting"; render([]);
  assert.deepEqual(seen(), ["nr-live is-waiting", "Chats, a chat needs you"]);
  live = ""; render([]);
  assert.deepEqual(seen(), ["nr-live", null]);
  scope.dispose();
});
