// @ts-check

import { $ } from "../../core/platform/dom.js";
import { usable } from "../../core/ui/a11y/focus.js";
import { pressEntry } from "../../shell/conversation-press.js";
import { createFileViewer } from "./viewer.js";
import { createConversationFiles } from "./conversation-files.js";
import { applyFileEvent } from "./file-events.js";
import { createFiles } from "./files.js";
import { createFilesPage } from "./page.js";

/** @import { ModuleDef } from "../../core/kernel/types" */

/** @import { FilesModuleOptions, Viewer, FilesTree } from "./module-types.d.ts" */

/** @param {FilesModuleOptions} options */
export function createFilesModule(options) {
  /** @type {Viewer | undefined} */
  let viewer;
  /** @type {FilesTree | undefined} */
  let tree;
  /** @type {ReturnType<typeof createFilesPage> | undefined} */
  let page;
  /** @type {ModuleDef} */
  const module = {
    manifest: {
      id: "xo.files", version: "1.0.0", kernel: "^1.1.0",
      needs: ["world", "currentView", "announce", "projectName", "changeData", "placeContext", "conversationSession", "stage",
        "navigation", "threadPresentation", "edgeCards"],
      contributes: ["panel.page:files", "conversation.file-route:shared-file", "conversation.press:reference"],
    },
    activate(ctx) {
      const announce = ctx.use("announce");
      const world = ctx.use("world"), stage = ctx.use("stage"), session = ctx.use("conversationSession");
      const { changes, save, ...renderers } = ctx.use("changeData");
      const mountedViewer = createFileViewer({
        announce, ask: options.ask, onChange: () => ctx.emit("app:render"), changes, edits: { saved: save(changes, ctx) },
        threadTitle: (ts) => world.thread(ts)?.title || null,
        away: () => { if (!page?.isOpen) return false; stage.back(); return true; },
        opened: (_, opts) => { ctx.emit("app:card-opened", "files"); page?.show(opts); },
        closed: () => ctx.emit("app:card-closed", "files"),
        home: () => [$("#say"), session.region()].find(usable) || null,
      }, { $, ...renderers });
      ctx.effect(() => ctx.use("edgeCards").register("files", {
        isOpen: () => mountedViewer.isOpen, park: mountedViewer.park, unpark: mountedViewer.unpark,
      }));
      ctx.effect(() => () => {
        viewer = undefined;
        tree = undefined;
        page = undefined;
        mountedViewer.dispose();
      });
      const paths = options.paths();
      ctx.effect(() => world.onEvent((event) => applyFileEvent(event, mountedViewer, paths)));
      const files = createFiles({
        paths, go: ctx.use("navigation").go, isBusy: ctx.use("threadPresentation").isBusy, changes, PROJ: ctx.use("projectName"),
        viewer: mountedViewer, world, onFold: (folded) => page?.treeFolded(folded),
      });
      const filesPage = createFilesPage({
        stage, files, viewer: mountedViewer, view: ctx.use("currentView"), announce,
      });
      viewer = mountedViewer;
      ctx.on("app:open-file", ({ file, from }) => mountedViewer.open(file, from));
      const routes = createConversationFiles({
        currentView: ctx.use("currentView"), convThread: ctx.use("placeContext").convThread,
        convAt: session.conversationAt, CHG: changes, VW: mountedViewer,
      });
      tree = files;
      page = filesPage;
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
  return {
    module,
    tree: {
      pathsChanged: () => tree?.pathsChanged(),
      /** @param {string} view */
      changes: (view) => tree?.changes(view) ?? [],
    },
    page: {
      get isOpen() { return page?.isOpen ?? false; },
      /** @type {ReturnType<typeof createFilesPage>["show"]} */
      show: (opts) => page?.show(opts),
      /** @type {ReturnType<typeof createFilesPage>["toggleTree"]} */
      toggleTree: (opts) => page?.toggleTree(opts) ?? false,
      sync: () => page?.sync(),
    },
    viewer: {
      get isOpen() { return viewer?.isOpen ?? false; },
      get isParked() { return viewer?.isParked ?? false; },
      get hasFile() { return viewer?.hasFile ?? false; },
      get editing() { return viewer?.editing ?? false; },
      get file() { return viewer?.file ?? null; },
      get opener() { return viewer?.opener ?? null; },
      get openFiles() { return viewer?.openFiles ?? []; },
      /** @type {Viewer["open"]} */
      open: (file, from) => viewer?.open(file, from),
      /** @type {Viewer["close"]} */
      close: (opts) => viewer?.close(opts),
      /** @type {Viewer["fileChanged"]} */
      fileChanged: (event) => viewer?.fileChanged(event),
      /** @type {Viewer["goto"]} */
      goto: (line, col) => viewer?.goto(line, col),
      /** @type {Viewer["leave"]} */
      leave: (go) => { if (viewer) viewer.leave(go); else go(); },
      park: () => viewer?.park(),
      unpark: () => viewer?.unpark(),
      refresh: () => viewer?.refresh(),
      notice: () => viewer?.notice(),
    },
  };
}
