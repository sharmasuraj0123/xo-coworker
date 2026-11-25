// @ts-check
import { requireHtml } from "../core/platform/dom.js";
import { RM } from "../core/ui/motion.js";
import { wireGlobalKeys } from "./global-keys.js";
import { stackLayers } from "./layers.js";
import { mountKeyboardLayers } from "./keyboard-layers.js";
import { createBackSteps } from "./back-steps.js";
import { wireBack } from "./back.js";
import { wireGestures } from "./gestures.js";

/** @import { InteractionHost, InteractionScope, Layers } from "./interaction-types.d.ts" */

/** @param {InteractionScope} scope @param {Layers} layers @param {InteractionHost} host */
export function mountShellInteractions(scope, layers, host) {
  const { PHONE, navigationState, capturing, SH, jump, IQ, CREATE, keys, files, QO, back, go,
    JUMP, composerNow, toggleIq, sessionOf, openKeys, STAGE, SIDE, runsLayer, closeKeys, LB, setEl, closeSettings,
    setDrawer, D, CH, PAGE_OF, world, updateComposer, say, toastLine, wordsOf, scroller } = host;
  const currentView = navigationState.view;
  scope.listen(requireHtml("#top-back", "button"), "click", back);
  const GLOBAL = {
    shells: () => SH.toggle(),
    jump: () => (jump.hidden ? JUMP.open() : JUMP.close()),
    intel: () => { const K = composerNow(); toggleIq(sessionOf(K.view), K.iq); },
    write: () => composerNow().say.focus(),
    keys: () => openKeys(),
    map: () => STAGE.toggle(),
    sideFold: () => SIDE.fold(!SIDE.folded),
  };

  const LAYERS = stackLayers(layers, [
    { id: "create", open: () => CREATE.isOpen(), close: () => { CREATE.close(); } },
    { id: "jump", tab: () => jump, inertsApp: true, watchHidden: jump, open: () => !jump.hidden, close: () => { JUMP.close(); } },
    { id: "intel", open: () => IQ.isOpen, close: () => { IQ.close(); } },
    { id: "quickopen", inertsApp: true, open: () => QO.isOpen, close: () => { QO.close(); } },
    runsLayer,
    { id: "keys", tab: () => keys, inertsApp: true, watchHidden: keys, open: () => !keys.hidden, close: () => { closeKeys(); } },
    { id: "lightbox", open: () => LB.isOpen, close: () => { LB.close(); }, overlay: false },
    { id: "settings", tab: () => PHONE.matches ? setEl : null, watchHidden: setEl,
      open: () => !setEl.hidden, close: () => { closeSettings(); } },
    { id: "files-page", open: () => files()?.page.isOpen ?? false, close: () => { STAGE.back(); } },
    { id: "viewer", open: () => files()?.viewer.isOpen ?? false, close: () => { files()?.viewer.close({ ask: true }); }, overlay: false },
    { id: "panel-sheet", open: () => STAGE.isOpen && PHONE.matches, close: () => { STAGE.close(); } },
    { id: "shells", open: () => SH.raised, close: () => SH.lower() },
    { id: "drawer", tab: () => PHONE.matches ? requireHtml("#side") : null,
      open: () => requireHtml("#app").classList.contains("drawer"), close: () => { setDrawer(false); } },
    { id: "decisions", open: () => D.isOpen(), close: () => { D.close(); } },
    { id: "chat-setup", open: () => CH.setupOpen, close: () => { CH.closeSetup(); } },
  ]);
  /** @param {string} v */
  const placeOk = (v) => v === "ws" || CH.isChats(v) || Object.hasOwn(PAGE_OF, v)
    || v.startsWith("p:") && !!world.project(v.slice(2)) || v.startsWith("t:") && !!world.thread(v.slice(2));
  const { syncInert, dispose: disposeKeyboardLayers } = mountKeyboardLayers({
    layers: LAYERS, phone: PHONE, app: requireHtml("#app"), main: requireHtml("#main"), side: requireHtml("#side"), settings: setEl,
  });
  scope.effect(() => wireGlobalKeys({
    view: currentView, capturing: capturing, SH, jump, IQ, CREATE, keys, GLOBAL,
    FP: { toggleTree: () => files()?.page.toggleTree() ?? false }, QO, LAYERS, back, go,
  }));
  scope.effect(() => disposeKeyboardLayers);
  scope.effect(() => LAYERS.undo);
  const { canBack, stepBack } = createBackSteps({ location: navigationState, LAYERS, placeOk, go, back });
  scope.effect(() => wireBack({ canBack, stepBack }));

  wireGestures({
    phone: () => PHONE.matches,
    overlay: () => LAYERS.open({ overlay: true }),
    view: currentView,
    back,
    drawer: (open) => setDrawer(open),
    isDrawer: () => requireHtml("#app").classList.contains("drawer"),
    settingsOpen: () => !setEl.hidden, closeSettings: () => closeSettings(),
    viewerOpen: () => files()?.viewer.isOpen ?? false, closeViewer: () => files()?.viewer.close(),
    panelOpen: () => D.isOpen(),
    sheets: [
      { host: requireHtml("#panel"), open: () => PHONE.matches && D.isOpen(), close: () => D.close() },
      { host: jump, card: () => jump.querySelector(".sheet-card"), open: () => !jump.hidden, close: JUMP.close },
      { host: keys, card: () => keys.querySelector(".sheet-card"), open: () => !keys.hidden, close: closeKeys },
      { host: requireHtml("#iq-pop"),
        open: () => IQ.isOpen && requireHtml("#iq-pop").classList.contains("is-sheet"), close: () => IQ.close() },
      { host: requireHtml("#cs-pop"), open: () => CH.setupOpen && requireHtml("#cs-pop").classList.contains("is-sheet"),
        close: () => { CH.closeSetup(); updateComposer(); } },
    ],
    say,
    toast: (text) => toastLine(text),
  }, wordsOf, scope);
  scope.listen(requireHtml("#pb-t"), "click", () => {
    (currentView() === "home" ? requireHtml("#home") : scroller).scrollTo({ top: 0, behavior: RM.matches ? "auto" : "smooth" });
  });
  return syncInert;
}
