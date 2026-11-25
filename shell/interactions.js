// @ts-check
import { $ } from "../core/platform/dom.js";
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
  const { PHONE, navigationState, capturing, SH, jump, IQ, CREATE, keys, FP, QO, back, go,
    JUMP, composerNow, toggleIq, sessionOf, openKeys, STAGE, SIDE, runsLayer, closeKeys, LB, setEl, closeSettings,
    VW, setDrawer, D, CH, PAGE_OF, world, updateComposer, say, toastLine, wordsOf, scroller } = host;
  const currentView = navigationState.view;
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
    { id: "files-page", open: () => FP.isOpen, close: () => { STAGE.back(); } },
    { id: "viewer", open: () => VW.isOpen, close: () => { VW.close({ ask: true }); }, overlay: false },
    { id: "panel-sheet", open: () => STAGE.isOpen && PHONE.matches, close: () => { STAGE.close(); } },
    { id: "shells", open: () => SH.raised, close: () => SH.lower() },
    { id: "drawer", tab: () => PHONE.matches ? $("#side") : null,
      open: () => $("#app").classList.contains("drawer"), close: () => { setDrawer(false); } },
    { id: "decisions", open: () => D.isOpen(), close: () => { D.close(); } },
    { id: "chat-setup", open: () => CH.setupOpen, close: () => { CH.closeSetup(); } },
  ]);
  /** @param {string} v */
  const placeOk = (v) => v === "ws" || CH.isChats(v) || Object.hasOwn(PAGE_OF, v)
    || v.startsWith("p:") && !!world.project(v.slice(2)) || v.startsWith("t:") && !!world.thread(v.slice(2));
  const { syncInert, dispose: disposeKeyboardLayers } = mountKeyboardLayers({
    layers: LAYERS, phone: PHONE, app: $("#app"), main: $("#main"), side: $("#side"), settings: setEl,
  });
  scope.effect(() => wireGlobalKeys({
    view: currentView, capturing: capturing, SH, jump, IQ, CREATE, keys, GLOBAL, FP, QO, LAYERS, back, go,
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
    isDrawer: () => $("#app").classList.contains("drawer"),
    settingsOpen: () => !setEl.hidden, closeSettings: () => closeSettings(),
    viewerOpen: () => VW.isOpen, closeViewer: () => VW.close(),
    panelOpen: () => D.isOpen(),
    sheets: [
      { host: $("#panel"), open: () => PHONE.matches && D.isOpen(), close: () => D.close() },
      { host: jump, card: () => jump.querySelector(".sheet-card"), open: () => !jump.hidden, close: JUMP.close },
      { host: keys, card: () => keys.querySelector(".sheet-card"), open: () => !keys.hidden, close: closeKeys },
      { host: $("#iq-pop"), open: () => IQ.isOpen && $("#iq-pop").classList.contains("is-sheet"), close: () => IQ.close() },
      { host: $("#cs-pop"), open: () => CH.setupOpen && $("#cs-pop").classList.contains("is-sheet"),
        close: () => { CH.closeSetup(); updateComposer(); } },
    ],
    say,
    toast: (text) => toastLine(text),
  }, wordsOf, scope);
  scope.listen($("#pb-t"), "click", () => {
    (currentView() === "home" ? $("#home") : scroller).scrollTo({ top: 0, behavior: RM.matches ? "auto" : "smooth" });
  });
  return syncInert;
}
