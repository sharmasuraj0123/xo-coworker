// @ts-check
import { ICON } from "../../core/ui/icons/names.js";
import { decorateConversation } from "./decoration.js";
import { toLatest as mainToLatest, fromLatest as mainFromLatest, toRow as mainToRow } from "./follow.js";

/** @param {string} id */
function element(id) {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing conversation element #${id}`);
  return node;
}

export function mountMainDecoration() {
  const host = element("app"), composer = element("composer"), say = composer.querySelector("textarea");
  if (say?.id !== "say") throw new Error("The conversation composer requires #say.");
  const send = element("send");
  send.innerHTML = ICON.send;
  send.dataset.mode = "send";
  return decorateConversation({
    conv: element("conv"), msgs: element("msgs"), scroller: element("scroller"), typing: element("typing"),
    composer, say, send, atList: document.getElementById("at-list"),
    dock: element("dock"), tdock: element("tdock"), herald: document.getElementById("herald"), host,
    follow: { toLatest: mainToLatest, fromLatest: mainFromLatest, toRow: mainToRow },
    isThread: () => host.dataset.view === "thread", main: true,
  }).destroy;
}
