// @ts-check

import { createNavigationLinks } from "./navigation-links.js";
import { createCodeCopy } from "../core/ui/markdown/copy.js";
import { routeConversationFile } from "./places.js";

/** @import { Press, PressEntry, PressId } from "./conversation-press-types.d.ts" */

/** @type {PressId[]} */
const order = [
  "navigate", "older", "start", "decide", "next", "create", "shell", "record-undo", "notice-undo", "chat-message", "run",
  "fold", "limit", "thread-menu", "checklist", "retry", "interrupt", "edit", "media", "remove-reference", "reference", "file", "copy",
];

/** @param {PressId} id @param {Press} route @returns {PressEntry} */
export function pressEntry(id, route) {
  return { id, route, priority: order.length - order.indexOf(id) };
}

/** @param {string} attribute @param {(value: string, control: Element) => unknown} run @param {boolean} [empty] @returns {Press} */
export function valuePress(attribute, run, empty = false) {
  return (target) => {
    const control = target.closest("[" + attribute + "]");
    const value = control?.getAttribute(attribute);
    if (!control || value == null || (!empty && !value)) return false;
    run(value, control);
    return true;
  };
}

/** @type {import("../core/kernel/types").ModuleDef} */
export const conversationPressModule = {
  manifest: { id: "xo.conversation-press", kernel: "^1.1.0", version: "1.0.0", core: true,
    needs: ["navigation", "conversationSession", "stage", "world", "notices", "announce"],
    contributes: ["conversation.press:navigate", "conversation.press:copy", "conversation.press:file"] },
  activate(ctx) {
    const navigate = createNavigationLinks({ go: ctx.use("navigation").go, showMsg: ctx.use("conversationSession").showMsg,
      openFromPanel: ctx.use("stage").openFromPanel, thread: ctx.use("world").thread, heraldShow: ctx.use("notices").show });
    ctx.contribute("conversation.press", pressEntry("navigate", navigate));
    const code = createCodeCopy(ctx.use("announce"));
    ctx.effect(() => code.dispose);
    ctx.contribute("conversation.press", pressEntry("copy", valuePress("data-copy", (_, el) => code.copy(el), true)));
    ctx.contribute("conversation.press", pressEntry("file", (target, event) => routeConversationFile(ctx.places, target, event)));
    const read = () => ctx.places.entries("conversation.press");
    let routes = read();
    ctx.places.watch("conversation.press", () => { routes = read(); });
    ctx.listen(document, "click", (event) => {
      const target = event.target;
      if (!(target instanceof Element) || target.closest("#iq-pop")) return;
      for (const entry of routes) if (entry.route(target, /** @type {MouseEvent} */ (event))) break;
    });
  },
};
