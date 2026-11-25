// @ts-check
import { filePlace } from "./search-place.js";
import { createFileSearch } from "./file-search.js";

/** @type {import("../../core/kernel/types").ModuleDef} */
export const fileSearchModule = {
  manifest: { id: "xo.file-search", version: "1.0.0", kernel: "^1.1.0", core: true,
    needs: ["world", "currentView", "projectName", "announce"], optional: ["files"], provides: ["fileSearch"] },
  activate(ctx) {
    const world = ctx.use("world"), view = ctx.use("currentView"), project = ctx.use("projectName");
    const files = () => ctx.optional("files");
    ctx.provide("fileSearch", createFileSearch(ctx, {
      tree: { pathsChanged: () => files()?.tree.pathsChanged() },
      viewer: { open: (file, from) => files()?.viewer.open(file, from), get openFiles() { return files()?.viewer.openFiles ?? []; } },
    }, { place: () => filePlace(view(), { thread: world.thread, project }),
      announce: ctx.use("announce"), syncInert: () => ctx.emit("app:sync-inert") }));
  },
};
