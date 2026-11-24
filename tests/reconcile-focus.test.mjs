import { dom, same } from "./lib/dom.mjs";
import { createConv, createConversationDrawing } from "../modules/conversation/draw.js";

let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };

{
  const { document } = await dom(`<main id="box"></main><textarea id="say"></textarea>`);
  const { reconcile } = await import("../core/ui/redraw.js");
  const box = document.getElementById("box"), say = document.getElementById("say");
  const row = (k, ctl = `<button data-r="${k}">${k}</button>`) => ({ key: k, html: `<div class="row">${ctl}</div>` });
  const draw = (items) => reconcile(box, items, { quiet: true, fallback: () => say });
  const btn = (k) => box.querySelector(`[data-r="${k}"]`);

  t("the row that holds focus and is going hands it to the nearest row before it that stays", () => {
    draw([row("a"), row("b"), row("c")]);
    btn("b").focus();
    draw([row("a"), row("c")]);
    same(document.activeElement, btn("a"));
  });
  t("with none before it, to the nearest row after it, on its first control that shows", () => {
    draw([row("a"), row("b", `<button hidden data-r="b0">x</button><button data-r="b">b</button>`)]);
    btn("a").focus();
    draw([row("b", `<button hidden data-r="b0">x</button><button data-r="b">b</button>`)]);
    same(document.activeElement, btn("b"));
  });
  t("with no row left, to the list's fallback, never the page", () => {
    draw([row("a")]);
    btn("a").focus();
    draw([]);
    same(document.activeElement, say);
  });
}
{
  const { document } = await dom('<div id="scroller" tabindex="-1"><div id="messages"></div></div><textarea id="say"></textarea>');
  const say = document.getElementById("say");
  const scroller = document.getElementById("scroller");
  const msgs = document.getElementById("messages");
  let items = [];
  const draw = createConversationDrawing({
    CHG: { sync() {} }, msgItems: () => items, liveReady: () => true,
    foldsBefore: () => null, ensureRoot() {}, typingRender() {},
  });
  for (const [main, fallback] of [[true, say], [false, scroller]]) {
    t(main ? "the main conversation hands focus to its composer" : "the Stage conversation hands focus to its region", () => {
      const conversation = createConv({ view: "t:one", msgs, scroller, main, follow: { isPinned: () => true, toLatest() {} } });
      items = [{ key: "drop", html: "<button>Removed by redraw</button>" }];
      draw(conversation, []);
      msgs.querySelector("button").focus();
      items = [];
      draw(conversation, []);
      same(document.activeElement, fallback);
    });
  }
}
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
