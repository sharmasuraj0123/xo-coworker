import assert from "node:assert/strict";
import test from "node:test";
import { createMessageItems } from "../modules/conversation/message-items.js";
import { sheet } from "./lib/cascade.mjs";

function render(rows, named = true) {
  const view = createMessageItems({
    messagesOf: () => rows.map((row, index) => ({ key: String(index), at: index, ...row })),
    convThread: () => named ? { id: "t" } : null, STAGE: { chosen: () => null },
    CH: { isChats: () => false }, nameOf: (_, who) => [who, ""], reactionsHtml: () => "",
    transcriptOpen: () => ({}),
  });
  return view.msgItems(named ? "t:t" : "ws", []).filter(({ key }) => !key.startsWith("day|")).map(({ html }) => html);
}

test("thread speakers repeat after an owner message, a different speaker or a day boundary", () => {
  const rows = [{ who: "coord" }, { who: "coord" }, { who: "you" }, { who: "coord" },
    { who: "agent" }, { who: "coord" }, { who: "coord", at: 86400000 * 2 }];
  const anonymous = (named) => render(rows, named).filter((html) => html.includes("m-them")).map((html) => html.includes("m-anon"));
  assert.deepEqual(anonymous(true), [false, true, false, false, false, false]);
  assert.deepEqual(anonymous(false), Array(6).fill(true));
});

test("answers and steers group only with the adjacent matching introduction", () => {
  const ask = { who: "asked", hop: "q" };
  const steer = { who: "control", key: "s", ctl: { action: "steer" } };
  for (const [rows, paired] of [
    [[ask, { who: "coord", cause: "q" }], true],
    [[ask, { who: "agent" }, { who: "coord", cause: "q" }], false],
    [[ask, { who: "coord", cause: "other" }], false],
    [[ask, { who: "coord", cause: "q", at: 172800000 }], false],
    [[steer, { who: "coord", lead: "s" }], true],
    [[steer, { who: "coord" }], false],
  ]) {
    const html = render(rows);
    assert.equal(html[0].includes("is-lead"), paired);
    assert.equal(html.at(-1).includes("m-under"), paired);
  }
});

test("the chat stylesheet hides anonymous labels and groups adjacent exchanges", () => {
  const css = sheet(new URL("../core/ui/markdown/rich.css", import.meta.url));
  assert.ok(css.includes(":root:not([data-msgx]) .m-anon>.av,:root:not([data-msgx]) .m-anon>.mb>.mh{display:none}"));
  assert.ok(css.includes(".ev.is-lead{margin-bottom:var(--s-2)}"));
  assert.ok(css.includes(".ev+.m.m-under{margin-top:var(--s-2)}"));
});
