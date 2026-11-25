// @ts-check
import { api } from "../../core/platform/api.js";
import { createPaths } from "../../core/services/paths.js";
import { createQuickOpen } from "./quickopen.js";

/** @import { FileSearchHost, SearchFiles } from "./file-search-types.d.ts" */

/** @param {import("./types").SearchScope} scope @param {SearchFiles} files @param {FileSearchHost} host */
export function createFileSearch(scope, { tree, viewer }, { place, announce, syncInert }) {
  const paths = createPaths({ api, signal: scope.signal, onChange() { quickOpen.refresh(); tree.pathsChanged(); } });
  const quickOpen = createQuickOpen(scope, {
    paths, api, place, announce,
    openFile(rel, { line }) {
      const target = place();
      if (target) viewer.open({
        path: rel, name: rel.split("/").pop(), project: target.project, rel, ...(line ? { lines: [line, line] } : {}),
      }, null);
    },
    openFiles: () => viewer.openFiles,
    layer: { shown: syncInert, hidden: syncInert },
  });
  return { paths, quickOpen };
}
