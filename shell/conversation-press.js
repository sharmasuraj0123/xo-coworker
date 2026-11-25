// @ts-check

import { createNavigationLinks } from "./navigation-links.js";
import { createCodeCopy } from "../core/ui/markdown/copy.js";
import { routeConversationFile } from "./places.js";

/** @import { Press, PressEntry, PressId, PressRoutes } from "./conversation-press-types.d.ts" */

/** @type {PressId[]} */
const order = [
  "navigate", "older", "start", "decide", "next", "create", "shell", "record-undo", "notice-undo", "chat-message", "run",
  "fold", "limit", "thread-menu", "checklist", "retry", "interrupt", "edit", "media", "remove-reference", "reference", "file", "copy",
];

/** @param {PressId} id @param {Press} route @returns {PressEntry} */
export function pressEntry(id, route) {
  return { id, route, priority: order.length - order.indexOf(id) };
}

/** @param {import("../core/kernel/types").Places} places @param {string} owner @param {PressRoutes} routes */
export function mountPressRoutes(places, owner, routes) {
  const undos = order.flatMap((id) => {
    const route = routes[id];
    return route ? [places.contribute("conversation.press", pressEntry(id, route), owner)] : [];
  });
  return () => { for (const undo of undos) undo(); };
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

/** @import { ModuleContext, Places } from "../core/kernel/types" */

/** @typedef {Pick<ModuleContext, "listen" | "effect">} Scope */

/** @typedef {Parameters<typeof createNavigationLinks>[0]} Links */

/** @param {Scope} scope @param {Places} places @param {(text: string) => void} announce @param {Links} links */
export function bindConversationPress(scope, places, announce, links) {
  scope.effect(() => mountPressRoutes(places, "xo.shell", { navigate: createNavigationLinks(links) }));
  const code = createCodeCopy(announce);
  scope.effect(() => code.dispose);
  scope.effect(() => mountPressRoutes(places, "xo.shell", { copy: valuePress("data-copy", (_, el) => code.copy(el), true) }));
  /** @returns {PressEntry[]} */
  const read = () => places.entries("conversation.press");
  scope.effect(() => mountPressRoutes(places, "xo.shell", { file: (target, event) => routeConversationFile(places, target, event) }));
  let routes = read();
  scope.effect(() => places.watch("conversation.press", () => { routes = read(); }));
  scope.listen(document, "click", (event) => {
    const target = event.target;
    if (!(target instanceof Element) || target.closest("#iq-pop")) return;
    for (const entry of routes) if (entry.route(target, /** @type {MouseEvent} */ (event))) break;
  });
}
