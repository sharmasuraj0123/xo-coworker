// @ts-check
import { requireHtml } from "../core/platform/dom.js";
import { PHONE } from "../core/platform/viewport.js";
import { sessionOf, PAGE_OF } from "./place-context.js";
import { RM } from "../core/ui/motion.js";
import { wireGlobalKeys } from "./global-keys.js";
import { stackLayers } from "./layers.js";
import { mountKeyboardLayers } from "./keyboard-layers.js";
import { createBackSteps } from "./back-steps.js";
import { wireBack } from "./back.js";
import { wireGestures } from "./gestures.js";

/** @type {import("../core/kernel/types").ModuleDef} */
export const interactionModule = {
  manifest: { id: "xo.interactions", version: "1.0.0", kernel: "^1.1.0", core: true,
    needs: ["navigationState", "shellDock", "intelligence", "shortcuts", "fileSearch", "navigation", "conversationSession", "stage",
      "rail", "drawer", "chats", "world", "mainViewport"],
    optional: ["settingsFrame", "createProject", "jump", "files"] },
  activate(ctx) {
    const phone = PHONE;
    if (!phone) throw new Error("Shell interactions require media queries.");
    const navigationState = ctx.use("navigationState"), SH = ctx.use("shellDock");
    const { intelligence: IQ, toggle: toggleIq } = ctx.use("intelligence");
    const { openKeys, keys } = ctx.use("shortcuts"), QO = ctx.use("fileSearch").quickOpen;
    const { back, go } = ctx.use("navigation"), { composerNow } = ctx.use("conversationSession").focus, STAGE = ctx.use("stage");
    const SIDE = ctx.use("rail").side, setDrawer = ctx.use("drawer").set;
    const CH = ctx.use("chats"), world = ctx.use("world"), { scroller } = ctx.use("mainViewport");
    const jump = requireHtml("#jump"), setEl = requireHtml("#settings"), files = () => ctx.optional("files");
    const capturing = () => ctx.optional("settingsFrame")?.capturing() ?? false;
    const createOpen = () => ctx.optional("createProject")?.isOpen() ?? false;
    const closeJump = () => ctx.optional("jump")?.close();
    const currentView = navigationState.view;
    ctx.listen(requireHtml("#top-back", "button"), "click", back);
    const GLOBAL = {
      shells: () => SH.toggle(),
      jump: () => (jump.hidden ? ctx.optional("jump")?.open() : closeJump()),
      intel: () => { const K = composerNow(); toggleIq(sessionOf(K.view), K.iq); },
      write: () => composerNow().say.focus(),
      keys: () => openKeys(),
      map: () => STAGE.toggle(),
      sideFold: () => SIDE.fold(!SIDE.folded),
    };

    const LAYERS = stackLayers(ctx.layers);
    /** @param {string} v */
    const placeOk = (v) => v === "ws" || CH.isChats(v) || Object.hasOwn(PAGE_OF, v)
      || v.startsWith("p:") && !!world.project(v.slice(2)) || v.startsWith("t:") && !!world.thread(v.slice(2));
    const { syncInert, dispose: disposeKeyboardLayers } = mountKeyboardLayers({
      layers: LAYERS, phone, app: requireHtml("#app"), main: requireHtml("#main"), side: requireHtml("#side"), settings: setEl,
    });
    ctx.effect(() => wireGlobalKeys({
      view: currentView, capturing: capturing, SH, jump, IQ, CREATE: { isOpen: createOpen }, keys, GLOBAL,
      FP: { toggleTree: () => files()?.page.toggleTree() ?? false }, QO, LAYERS, back, go,
    }));
    ctx.effect(() => disposeKeyboardLayers);
    const { canBack, stepBack } = createBackSteps({ location: navigationState, LAYERS, placeOk, go, back });
    ctx.effect(() => wireBack({ canBack, stepBack }));

    wireGestures({
      phone: () => phone.matches,
      overlay: () => LAYERS.open({ overlay: true }),
      view: currentView,
      back,
      drawer: (open) => setDrawer(open),
      isDrawer: () => requireHtml("#app").classList.contains("drawer"),
    }, ctx);
    ctx.listen(requireHtml("#pb-t"), "click", () => {
      (currentView() === "home" ? requireHtml("#home") : scroller).scrollTo({ top: 0, behavior: RM.matches ? "auto" : "smooth" });
    });
    ctx.on("app:sync-inert", syncInert);
  },
};
