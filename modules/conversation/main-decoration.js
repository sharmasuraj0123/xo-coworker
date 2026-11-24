// @ts-check
import { decorateConversation } from "./decoration.js";
import { toLatest as mainToLatest, fromLatest as mainFromLatest } from "./follow.js";

const $ = (/** @type {string} */ s) => /** @type {HTMLElement} */ (document.querySelector(s));

decorateConversation({
  conv: $("#conv"), msgs: $("#msgs"), scroller: $("#scroller"), typing: $("#typing"),
  composer: $("#composer"), say: /** @type {HTMLTextAreaElement} */ ($("#say")), send: $("#send"), atList: $("#at-list"),
  dock: $("#dock"), tdock: $("#tdock"), herald: $("#herald"), host: /** @type {HTMLElement} */ (document.getElementById("app")),
  follow: { toLatest: mainToLatest, fromLatest: mainFromLatest },
  isThread: () => (/** @type {HTMLElement} */ (document.getElementById("app"))).dataset.view === "thread", main: true,
});
