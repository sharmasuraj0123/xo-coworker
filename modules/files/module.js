// @ts-check

import { createFileViewer } from "./viewer.js";
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
      needs: ["world", "currentView", "announce"], contributes: ["panel.page:files"],
    },
    activate(ctx) {
      const announce = ctx.use("announce");
      const mountedViewer = createFileViewer({ ...options.viewer, announce }, options.renderers);
      ctx.effect(() => () => {
        viewer = undefined;
        tree = undefined;
        page = undefined;
        mountedViewer.dispose();
      });
      const files = createFiles({
        ...options.tree(), viewer: mountedViewer, world: ctx.use("world"), onFold: (folded) => page?.treeFolded(folded),
      });
      const filesPage = createFilesPage({
        stage: options.stage(), files, viewer: mountedViewer, view: ctx.use("currentView"), announce,
      });
      viewer = mountedViewer;
      tree = files;
      page = filesPage;
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
