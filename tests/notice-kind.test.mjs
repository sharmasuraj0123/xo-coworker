import assert from "node:assert/strict";
import { test } from "node:test";
import { createHerald } from "../core/services/notices.js";
import { createNoticeLine } from "../modules/conversation/notice-line.js";
import { createLaunchpadHerald } from "../modules/launchpad/herald.js";
import { declarationsFor } from "./lib/css-snapshot.mjs";
import { dom } from "./lib/dom.mjs";

test("Launchpad passes the kind of its notice through to the visible conversation", async () => {
  const { document } = await dom('<div id="app"><div id="dock"><div id="herald"></div><textarea id="reply"></textarea></div></div>');
  const main = { say: document.querySelector("#reply") };
  const state = { herald: null, view: "p:demo" };
  const herald = createHerald({ state, setTimer: () => 0, clearTimer() {} });
  const { notify, notice } = createLaunchpadHerald(herald);
  const view = createNoticeLine({
    notice: () => state.herald, world: { state: {} }, MK: main, composerNow: () => main,
    panelHost: () => null, connDest: () => ({}), convThread: () => null, placeRegion: () => main.say, STOP_ICON: "",
  });
  notify("Couldn't start the deploy", null, "err");
  view.heraldRender();
  const line = document.querySelector("#herald");
  assert.match(line.textContent, /Couldn't start the deploy/);
  assert.equal(line.querySelector(".hr-ic.k-stopped svg")?.dataset.xi, "close");
  assert.ok(declarationsFor(".hr-ic.k-stopped", "color").some(({ value }) => value === "var(--err-ink)"));

  notice("deploy", { text: "Stopping the deploy", kind: "halt" }, 800);
  view.heraldRender();
  assert.match(line.querySelector(".hr.k-halt").textContent, /Stopping the deploy/);

  notice("deploy", { text: "Couldn't stop the deploy", kind: "err" }, 800);
  view.heraldRender();
  assert.equal(line.querySelectorAll(".hr").length, 1);
  assert.match(line.querySelector(".hr.k-stopped").textContent, /Couldn't stop the deploy/);
});
