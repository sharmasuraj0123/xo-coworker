// @ts-check
import { createDrawer } from "./phone.js";
import { createOverlayFocus } from "./keyboard-layers.js";
import { regionRings } from "../core/ui/a11y/ring.js";
import { keepFocusInView } from "../core/ui/a11y/focus.js";
import { tickElapsed } from "./elapsed.js";
import { createScope } from "../core/kernel/scope.js";
import { $ } from "../core/platform/dom.js";
import { PHONE } from "../core/platform/viewport.js";
import { createWorld } from "../core/services/world/store.js";
import { createConversationNotices } from "../core/services/notices/line.js";
import { createApplicationShape } from "../core/services/shape/application.js";
import { createAnnouncer } from "../core/ui/a11y/announce.js";
import { createNavigationState } from "./navigation-state.js";
import { createPlaceContext } from "./place-context.js";
import { createShellScheduler } from "./render.js";
import { createRedrawFocus } from "./redraw-focus.js";
import { createAppServices } from "./app-services.js";

/** @param {() => void} render @param {() => void} syncInert */
export function createShellFoundation(render, syncInert) {
  if (!PHONE) throw new Error("The application requires media queries.");
  const appScope = createScope();
  const world = createWorld();
  appScope.effect(() => world.dispose);
  const schedule = createShellScheduler(render, appScope);
  const notices = createConversationNotices(schedule);
  appScope.effect(() => notices.dispose);
  /** @type {import("../core/kernel/types").ModuleDef} */
  const noticeModule = {
    manifest: { id: "xo.notices", version: "1.0.0", kernel: "^1.1.0", core: true, provides: ["notices"] },
    activate(ctx) { ctx.provide("notices", notices); },
  };
  const announce = createAnnouncer($("#live"), appScope);
  const applicationShape = createApplicationShape({
    scope: appScope, events: world, notice: (h) => notices.show({ kind: "calm", ...h }, 6000),
  });
  const navigationState = createNavigationState();
  const place = createPlaceContext(world);
  appScope.effect(() => place.mountNames(navigationState.view));
  const services = createAppServices({ world, announce, projectName: place.PROJ, currentView: navigationState.view }, schedule, place);
  /** @param {string} text */
  function toastLine(text) { announce(text); notices.show({ kind: "done", text }, 1600); }
  appScope.interval(tickElapsed, 1000);
  appScope.effect(regionRings);
  appScope.effect(keepFocusInView);
  return {
    appScope, world, schedule, notices, noticeModule, announce, applicationShape, navigationState, place,
    services, PHONE, setDrawer: createDrawer(appScope, PHONE, syncInert), redrawFocus: createRedrawFocus(),
    toastLine, focusOverlay: createOverlayFocus(appScope),
  };
}
