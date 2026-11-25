// @ts-check
import { requireHtml } from "../../core/platform/dom.js";
import { viewerFile } from "../../core/services/media/items.js";
import { wireDragOut } from "../../core/services/media/hydrate.js";
import { pressEntry, valuePress } from "../../shell/conversation-press.js";
import { createTopHeader } from "../../shell/top-header.js";
import { createConversationHeader } from "./header.js";
import { createNoticeLine } from "./notice-line.js";
import { createMediaOpener } from "./open-media.js";
import { createLightbox } from "./lightbox.js";

/** @import { MainHeader, HeaderNeed } from "./header-types" */

/** @import { SurfaceScope } from "../../shell/surface-types" */

/** @template {HeaderNeed} N @param {MainHeader<N>} host @param {SurfaceScope} scope @param {() => void} schedule */
export function mountConversationHeader(host, scope, schedule) {
  return createTopHeader({ ...host, conversationHeaderHtml: createConversationHeader(host) }, scope, schedule);
}

/** @type {import("../../core/kernel/types").ModuleDef} */
export const noticeLineModule = {
  manifest: { id: "xo.notice-line", version: "1.0.0", kernel: "^1.1.0", core: true,
    needs: ["world", "conversationSession", "composer", "notices", "intelligence", "redrawFocus"],
    provides: ["noticeLine"], contributes: ["conversation.press:notice-undo"] },
  activate(ctx) {
    const notices = ctx.use("notices"), session = ctx.use("conversationSession");
    const line = createNoticeLine({
      notice: notices.current, world: ctx.use("world"), MK: session.composer, composerNow: session.focus.composerNow,
      panelHost: () => session.panel()?.box ?? null, connDest: ctx.use("composer").connDest, placeRegion: session.region,
    });
    const receipts = { requestFocus: ctx.use("redrawFocus").request, undo: notices.undo, undoRecord: ctx.use("intelligence").undoRecord };
    ctx.contribute("conversation.press", pressEntry("notice-undo", valuePress("data-herald-undo", () => line.undoNotice(receipts), true)));
    ctx.provide("noticeLine", line);
  },
};

/** @type {import("../../core/kernel/types").ModuleDef} */
export const conversationMediaModule = {
  manifest: { id: "xo.conversation-media", version: "1.0.0", kernel: "^1.1.0", core: true, needs: ["announce"], optional: ["files"],
    provides: ["lightbox"], contributes: ["conversation.press:media"] },
  activate(ctx) {
    const msgsEl = requireHtml("#msgs");
    /** @type {Parameters<typeof createMediaOpener>[0]["VW"]} */
    const viewer = { open: (file, from) => ctx.optional("files")?.viewer.open(file, from) };
    const lightbox = createLightbox({ openFile: (item, from) => viewer.open(viewerFile(item), from), announce: ctx.use("announce") });
    ctx.effect(() => lightbox.dispose);
    const open = createMediaOpener({ msgsEl, LB: lightbox, VW: viewer });
    wireDragOut(ctx, msgsEl);
    ctx.contribute("conversation.press", pressEntry("media", (target, event) => {
      const tile = target.closest("[data-mx]");
      if (!(tile instanceof HTMLElement)) return false;
      open(tile, event);
      return true;
    }));
    ctx.provide("lightbox", lightbox);
  },
};
