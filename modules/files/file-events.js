// @ts-check

/** @import { StormEvent } from "../../core/services/storm/types.d.ts" */

/** @import { Viewer } from "./module-types.d.ts" */

/** @typedef {import("./files-types.d.ts").FilesDependencies["paths"]} Paths */

/** @param {StormEvent} event @param {Pick<Viewer, "fileChanged">} viewer @param {Paths} paths */
export function applyFileEvent(event, viewer, paths) {
  if (event.kind !== "file") return;
  viewer.fileChanged({ ...event.data, type: event.type });
  const data = event.data || {};
  if (typeof data.project_id !== "string" || typeof data.path !== "string") return;
  if (data.kind !== "create" && data.kind !== "delete" && data.kind !== "rename") return;
  const worktree = /^(\.xo\/worktrees\/[^/]+)\/(.+)$/.exec(data.path);
  const scope = { project: data.project_id, base: worktree?.[1] || "" };
  const path = worktree?.[2] || data.path;
  if (data.kind !== "rename") paths?.changed(scope, { kind: data.kind, path });
  else if (typeof data.old_path === "string") {
    paths?.changed(scope, { kind: "rename", path, old_path: data.old_path.replace(/^\.xo\/worktrees\/[^/]+\//, "") });
  }
}
