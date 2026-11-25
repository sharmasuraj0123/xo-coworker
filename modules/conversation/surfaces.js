// @ts-check
import { requireHtml } from "../../core/platform/dom.js";
import { viewerFile } from "../../core/services/media/items.js";
import { wireDragOut } from "../../core/services/media/hydrate.js";
import { mountPressRoutes, valuePress } from "../../shell/conversation-press.js";
import { createTopHeader } from "../../shell/top-header.js";
import { createConversationHeader } from "./header.js";
import { createNoticeLine } from "./notice-line.js";
import { createMediaOpener } from "./open-media.js";
import { createLightbox } from "./lightbox.js";

/** @import { MainHeader, HeaderNeed } from "./header-types" */

/** @import { NoticeLineDeps } from "./notice-line-types" */

/** @import { Places } from "../../core/kernel/types" */

/** @import { SurfaceScope } from "../../shell/surface-types" */

/** @template {HeaderNeed} N @param {MainHeader<N>} host @param {SurfaceScope} scope @param {() => void} schedule */
export function mountConversationHeader(host, scope, schedule) {
  return createTopHeader({ ...host, conversationHeaderHtml: createConversationHeader(host) }, scope, schedule);
}

/** @import { NoticeUndo } from "./notice-line-types" */

/** @param {Scope} scope @param {Places} places @param {NoticeLineDeps} deps @param {NoticeUndo} receipts */
export function mountNoticeLine(scope, places, deps, receipts) {
  const line = createNoticeLine(deps);
  scope.effect(() => mountPressRoutes(places, "xo.conversation", {
    "notice-undo": valuePress("data-herald-undo", () => line.undoNotice(receipts), true),
  }));
  return line;
}

/** @typedef {Parameters<typeof createMediaOpener>[0]["VW"]} Viewer */

/** @typedef {Pick<import("../../core/kernel/types").ModuleContext, "effect" | "listen">} Scope */

/** @param {Scope} scope @param {Places} places @param {Viewer} viewer @param {(text: string) => void} announce */
export function mountConversationMedia(scope, places, viewer, announce) {
  const msgsEl = requireHtml("#msgs");
  const LB = createLightbox({ openFile: (item, from) => viewer.open(viewerFile(item), from), announce });
  const open = createMediaOpener({ msgsEl, LB, VW: viewer });
  wireDragOut(scope, msgsEl);
  scope.effect(() => mountPressRoutes(places, "xo.conversation", {
    media(target, event) {
      const tile = target.closest("[data-mx]");
      if (!(tile instanceof HTMLElement)) return false;
      open(tile, event);
      return true;
    },
  }));
  return LB;
}
