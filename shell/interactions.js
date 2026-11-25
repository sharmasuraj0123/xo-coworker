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
      "rail", "lightbox", "drawer", "decisionPresentation", "chats", "world", "composer", "mainViewport"],
    optional: ["settingsFrame", "createProject", "jump", "files"] },
  activate(ctx) {
    const phone = PHONE;
    if (!phone) throw new Error("Shell interactions require media queries.");
    const navigationState = ctx.use("navigationState"), SH = ctx.use("shellDock");
    const { intelligence: IQ, toggle: toggleIq } = ctx.use("intelligence");
    const { openKeys, closeKeys, keys } = ctx.use("shortcuts"), QO = ctx.use("fileSearch").quickOpen;
    const { back, go } = ctx.use("navigation"), { composerNow } = ctx.use("conversationSession").focus, STAGE = ctx.use("stage");
    const SIDE = ctx.use("rail").side, LB = ctx.use("lightbox"), setDrawer = ctx.use("drawer").set, D = ctx.use("decisionPresentation").D;
    const CH = ctx.use("chats"), world = ctx.use("world"), { updateComposer } = ctx.use("composer"), { scroller } = ctx.use("mainViewport");
    const jump = requireHtml("#jump"), setEl = requireHtml("#settings"), files = () => ctx.optional("files");
    const capturing = () => ctx.optional("settingsFrame")?.capturing() ?? false;
    const closeSettings = () => ctx.optional("settingsFrame")?.close();
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

    const LAYERS = stackLayers({ push: ctx.pushLayer, ...ctx.layers }, [
      { id: "create", open: () => createOpen(), close: () => { ctx.optional("createProject")?.close(); } },
      { id: "jump", tab: () => jump, inertsApp: true, watchHidden: jump, open: () => !jump.hidden, close: () => { closeJump(); } },
      { id: "intel", open: () => IQ.isOpen, close: () => { IQ.close(); } },
      { id: "quickopen", inertsApp: true, open: () => QO.isOpen, close: () => { QO.close(); } },
      { id: "keys", tab: () => keys, inertsApp: true, watchHidden: keys, open: () => !keys.hidden, close: () => { closeKeys(); } },
      { id: "lightbox", open: () => LB.isOpen, close: () => { LB.close(); }, overlay: false },
      { id: "settings", tab: () => phone.matches ? setEl : null, watchHidden: setEl,
        open: () => !setEl.hidden, close: () => { closeSettings(); } },
      { id: "files-page", open: () => files()?.page.isOpen ?? false, close: () => { STAGE.back(); } },
      { id: "viewer", open: () => files()?.viewer.isOpen ?? false, close: () => { files()?.viewer.close({ ask: true }); }, overlay: false },
      { id: "panel-sheet", open: () => STAGE.isOpen && phone.matches, close: () => { STAGE.close(); } },
      { id: "shells", open: () => SH.raised, close: () => SH.lower() },
      { id: "drawer", tab: () => phone.matches ? requireHtml("#side") : null,
        open: () => requireHtml("#app").classList.contains("drawer"), close: () => { setDrawer(false); } },
      { id: "decisions", open: () => D.isOpen(), close: () => { D.close(); } },
      { id: "chat-setup", open: () => CH.setupOpen, close: () => { CH.closeSetup(); } },
    ]);
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
    ctx.effect(() => LAYERS.undo);
    const { canBack, stepBack } = createBackSteps({ location: navigationState, LAYERS, placeOk, go, back });
    ctx.effect(() => wireBack({ canBack, stepBack }));

    wireGestures({
      phone: () => phone.matches,
      overlay: () => LAYERS.open({ overlay: true }),
      view: currentView,
      back,
      drawer: (open) => setDrawer(open),
      isDrawer: () => requireHtml("#app").classList.contains("drawer"),
      settingsOpen: () => !setEl.hidden, closeSettings: () => closeSettings(),
      viewerOpen: () => files()?.viewer.isOpen ?? false, closeViewer: () => files()?.viewer.close(),
      panelOpen: () => D.isOpen(),
      sheets: [
        { host: requireHtml("#panel"), open: () => phone.matches && D.isOpen(), close: () => D.close() },
        { host: jump, card: () => jump.querySelector(".sheet-card"), open: () => !jump.hidden, close: closeJump },
        { host: keys, card: () => keys.querySelector(".sheet-card"), open: () => !keys.hidden, close: closeKeys },
        { host: requireHtml("#iq-pop"),
          open: () => IQ.isOpen && requireHtml("#iq-pop").classList.contains("is-sheet"), close: () => IQ.close() },
        { host: requireHtml("#cs-pop"), open: () => CH.setupOpen && requireHtml("#cs-pop").classList.contains("is-sheet"),
          close: () => { CH.closeSetup(); updateComposer(); } },
      ],
    }, ctx);
    ctx.listen(requireHtml("#pb-t"), "click", () => {
      (currentView() === "home" ? requireHtml("#home") : scroller).scrollTo({ top: 0, behavior: RM.matches ? "auto" : "smooth" });
    });
    ctx.on("app:sync-inert", syncInert);
  },
};
