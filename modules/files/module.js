// @ts-check
import { pageGesture, sheetGesture } from "../../shell/gestures.js";
import { PHONE } from "../../core/platform/viewport.js";
import { ownLayer } from "../../shell/layers.js";

import { $, requireHtml } from "../../core/platform/dom.js";
import { usable } from "../../core/ui/a11y/focus.js";
import { pressEntry } from "../../shell/conversation-press.js";
import { createFileViewer } from "./viewer.js";
import { createConversationFiles } from "./conversation-files.js";
import { applyFileEvent } from "./file-events.js";
import { createFiles } from "./files.js";
import { createFilesPage } from "./page.js";

/** @import { ModuleDef } from "../../core/kernel/types" */

/** @type {ModuleDef} */
export const filesModule = {
  manifest: {
    id: "xo.files", version: "1.0.0", kernel: "^1.1.0",
    needs: ["world", "currentView", "announce", "projectName", "changeData", "placeContext", "conversationSession", "stage",
      "navigation", "threadPresentation", "edgeCards", "fileSearch", "fileQuestions"], provides: ["files"],
    contributes: ["workspace.paint:viewer", "workspace.paint:files", "panel.page:files",
      "conversation.file-route:shared-file", "conversation.press:reference"],
  },
  activate(ctx) {
    const announce = ctx.use("announce");
    const world = ctx.use("world"), stage = ctx.use("stage"), session = ctx.use("conversationSession");
    const { changes, save, ...renderers } = ctx.use("changeData");
    /** @type {ReturnType<typeof createFilesPage>} */
    let filesPage;
    const mountedViewer = createFileViewer({
      announce, ask: ctx.use("fileQuestions"), onChange: () => ctx.invalidate("workspace"), changes, edits: { saved: save(changes, ctx) },
      threadTitle: (ts) => world.thread(ts)?.title || null,
      away: () => { if (!filesPage.isOpen) return false; stage.back(); return true; },
      opened: (_, opts) => { ctx.emit("app:card-opened", "files"); filesPage.show(opts); },
      closed: () => ctx.emit("app:card-closed", "files"),
      home: () => [requireHtml("#say", "textarea"), session.region()].find(usable) || null,
    }, { $, ...renderers });
    ctx.effect(() => ctx.use("edgeCards").register("files", {
      isOpen: () => mountedViewer.isOpen, park: mountedViewer.park, unpark: mountedViewer.unpark,
    }));
    ctx.effect(() => mountedViewer.dispose);
    const { paths } = ctx.use("fileSearch");
    ctx.effect(() => world.onEvent((event) => applyFileEvent(event, mountedViewer, paths)));
    const files = createFiles({
      paths, go: ctx.use("navigation").go, isBusy: ctx.use("threadPresentation").isBusy, changes, PROJ: ctx.use("projectName"),
      viewer: mountedViewer, world, onFold: (folded) => filesPage.treeFolded(folded),
    });
    filesPage = createFilesPage({
      stage, files, viewer: mountedViewer, view: ctx.use("currentView"), announce,
    });
    ctx.on("app:open-file", ({ file, from }) => mountedViewer.open(file, from));
    const routes = createConversationFiles({
      currentView: ctx.use("currentView"), convThread: ctx.use("placeContext").convThread,
      convAt: session.conversationAt, CHG: changes, VW: mountedViewer,
    });
    ctx.contribute("workspace.paint", { id: "viewer", order: 60, paint: () => mountedViewer.notice() });
    ctx.contribute("workspace.paint", { id: "files", order: 90, paint: () => filesPage.sync() });
    const viewerHost = requireHtml("#viewer");
    const viewerOnPhone = () => !!PHONE?.matches && mountedViewer.isOpen;
    const closeViewer = () => { mountedViewer.close(); };
    pageGesture(ctx, viewerHost, viewerOnPhone, closeViewer);
    sheetGesture(ctx, { host: viewerHost, open: viewerOnPhone, close: closeViewer, fraction: 0.2 });
    ownLayer(ctx, { id: "files-page", open: () => filesPage.isOpen, close: () => { stage.back(); } });
    ownLayer(ctx, { id: "viewer", open: () => mountedViewer.isOpen, close: () => { mountedViewer.close({ ask: true }); }, overlay: false });
    ctx.provide("files", { tree: files, viewer: mountedViewer, page: filesPage });
    ctx.effect(() => ctx.use("navigation").beforeLeave((resume) => {
      if (!mountedViewer.editing) return true;
      mountedViewer.leave(resume);
      return false;
    }));
    ctx.contribute("conversation.file-route", { id: "shared-file", route(/** @type {Element} */ target, /** @type {MouseEvent} */ event) {
      const button = target.closest("[data-file]");
      if (!(button instanceof HTMLElement)) return false;
      event.preventDefault(); routes.openSharedFile(button); return true;
    } });
    ctx.contribute("conversation.press", pressEntry("reference", (target, event) => {
      const ref = target.closest("[data-ref]");
      if (!(ref instanceof HTMLElement)) return false;
      event.preventDefault(); routes.openLineRef(ref); return true;
    }));
    ctx.contribute("panel.page", { id: "files", ...filesPage.entry });
  },
};
