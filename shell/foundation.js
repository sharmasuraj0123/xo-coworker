// @ts-check
import { ownLayer } from "./layers.js";
import { createNavigation } from "./navigation.js";
import { pageEl as pageElement } from "./place-context.js";
import { requireHtml } from "../core/platform/dom.js";
import { createDrawer } from "./phone.js";
import { createOverlayFocus } from "./keyboard-layers.js";
import { regionRings } from "../core/ui/a11y/ring.js";
import { keepFocusInView } from "../core/ui/a11y/focus.js";
import { tickElapsed } from "./elapsed.js";
import { PHONE } from "../core/platform/viewport.js";
import { createConversationNotices } from "../core/services/notices/line.js";
import { createRedrawFocus } from "./redraw-focus.js";

/** @type {import("../core/kernel/types").ModuleDef} */
export const shellFoundationModule = {
  manifest: { id: "xo.shell", version: "1.0.0", kernel: "^1.1.0", core: true, needs: ["announce"],
    provides: ["notices", "redrawFocus", "drawer", "overlayFocus", "toastLine"] },
  activate(ctx) {
    if (!PHONE) throw new Error("The application requires media queries.");
    const announce = ctx.use("announce");
    const notices = createConversationNotices(() => ctx.invalidate("workspace"));
    ctx.effect(() => notices.dispose);
    ctx.provide("notices", notices);
    ctx.provide("redrawFocus", createRedrawFocus());
    const set = createDrawer(ctx, PHONE, () => ctx.emit("app:sync-inert"));
    ownLayer(ctx, { id: "drawer", tab: () => PHONE?.matches ? requireHtml("#side") : null,
      open: () => requireHtml("#app").classList.contains("drawer"), close: () => set(false) });
    ctx.provide("drawer", { set });
    ctx.provide("overlayFocus", createOverlayFocus(ctx));
    ctx.provide("toastLine", (text) => { announce(text); notices.show({ kind: "done", text }, 1600); });
    ctx.interval(tickElapsed, 1000);
    ctx.effect(regionRings);
    ctx.effect(keepFocusInView);
  },
};

/** @type {import("../core/kernel/types").ModuleDef} */
export const navigationModule = {
  manifest: { id: "xo.navigation", version: "1.0.0", kernel: "^1.1.0", core: true,
    needs: ["navigationState", "conversationSession", "placeContext"], provides: ["navigation"] },
  activate(ctx) {
    const session = ctx.use("conversationSession");
    ctx.provide("navigation", createNavigation({
      location: ctx.use("navigationState"), bus: { emit: ctx.emit }, pageEl: pageElement,
      convThread: ctx.use("placeContext").convThread, say: session.composer.say, scroller: session.main.scroller,
    }));
  },
};
