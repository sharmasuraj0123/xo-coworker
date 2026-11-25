// @ts-check
import { requireHtml } from "../../core/platform/dom.js";
import { viewerFile } from "../../core/services/media/items.js";
import { watchMedia, wireDragOut } from "../../core/services/media/hydrate.js";
import { pressEntry, valuePress } from "../../shell/conversation-press.js";
import { createTopHeader } from "../../shell/top-header.js";
import { createConversationHeader } from "./header.js";
import { createNoticeLine } from "./notice-line.js";
import { createMediaOpener } from "./open-media.js";
import { createLightbox } from "./lightbox.js";

/** @type {import("../../core/kernel/types").ModuleDef} */
export const conversationHeaderModule = {
  manifest: { id: "xo.conversation-header", version: "1.0.0", kernel: "^1.1.0", core: true, provides: ["conversationHeader"],
    needs: ["world", "placeContext", "threadPresentation", "threadControls", "projectDescriptions", "projectIcons", "launchpad", "stage",
      "messageContext", "threadGroups", "threadMenu", "threadRuntime", "navigationState", "chats", "checklist"],
    optional: ["threadActions", "home"] },
  activate(ctx) {
    const project = ctx.use("projectIcons"), { LP, LW } = ctx.use("launchpad");
    const descriptions = ctx.use("projectDescriptions");
    /** @type {import("./header-types").MainHeader<import("../../shell/render-types").FrameNeeds[number]>} */
    const header = {
      ...ctx.use("placeContext"), ...ctx.use("threadPresentation"), threadControls: ctx.use("threadControls"),
      description: (id) => descriptions.get(id), world: ctx.use("world"), ...project, LP, LW, STAGE: ctx.use("stage"), places: ctx.places,
      emit: ctx.emit, convHost: ctx.use("messageContext").convHost,
      homeParts: (needs) => ctx.optional("home")?.homeParts(needs) ?? { held: [] },
      threadCounts: ctx.use("threadGroups").threadCounts, threadMenuHtml: ctx.use("threadMenu"), rtTag: ctx.use("threadRuntime").rtTag,
      location: ctx.use("navigationState"), CH: ctx.use("chats"), checklistRender: ctx.use("checklist").render,
      tdelRender: (thread) => ctx.optional("threadActions")?.renderDelete(thread),
    };
    const schedule = () => ctx.invalidate("workspace");
    const render = createTopHeader({ ...header, conversationHeaderHtml: createConversationHeader(header) }, ctx, schedule);
    ctx.provide("conversationHeader", render);
  },
};

/** @type {import("../../core/kernel/types").ModuleDef} */
export const noticeLineModule = {
  manifest: { id: "xo.notice-line", version: "1.0.0", kernel: "^1.1.0", core: true,
    needs: ["world", "conversationSession", "composer", "notices", "intelligence", "redrawFocus"],
    provides: ["noticeLine"], contributes: ["conversation.press:notice-undo", "workspace.paint:notice"] },
  activate(ctx) {
    const notices = ctx.use("notices"), session = ctx.use("conversationSession");
    const line = createNoticeLine({
      notice: notices.current, world: ctx.use("world"), MK: session.composer, composerNow: session.focus.composerNow,
      panelHost: () => session.panel()?.box ?? null, connDest: ctx.use("composer").connDest, placeRegion: session.region,
    });
    const receipts = { requestFocus: ctx.use("redrawFocus").request, undo: notices.undo, undoRecord: ctx.use("intelligence").undoRecord };
    ctx.contribute("conversation.press", pressEntry("notice-undo", valuePress("data-herald-undo", () => line.undoNotice(receipts), true)));
    ctx.contribute("workspace.paint", { id: "notice", order: 30, paint: line.heraldRender });
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
    watchMedia(ctx);
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
