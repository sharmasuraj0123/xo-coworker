// @ts-check

/** @import { StormEvent } from "../../core/services/storm/types.d.ts" */

/** @import { Viewer } from "./module-types.d.ts" */

/** @typedef {import("./files-types.d.ts").FilesDependencies["paths"]} Paths */

/** @param {StormEvent} event @param {Pick<Viewer, "fileChanged">} viewer @param {Paths} paths */
export function applyFileEvent(event, viewer, paths) {
  if (event.kind !== "file") return;
  viewer.fileChanged({ ...event.data, type: event.type });
  const data = event.data || {};
  if (!data.project_id || !["create", "delete", "rename"].includes(data.kind)) return;
  const worktree = /^(\.xo\/worktrees\/[^/]+)\/(.+)$/.exec(data.path || "");
  paths?.changed({ project: data.project_id, base: worktree?.[1] || "" }, {
    kind: data.kind, path: worktree?.[2] || data.path,
    old_path: data.old_path ? data.old_path.replace(/^\.xo\/worktrees\/[^/]+\//, "") : null,
  });
}
