// @ts-check
import assert from "node:assert/strict";
import { createMapFolders } from "../folders.js";

const scope = { project: "project", base: "worktree" };
/** @type {string[][]} */
const reads = [];
let redraws = 0;
/** @type {PromiseWithResolvers<import("../folders-types.d.ts").MapTree>} */
let pending = Promise.withResolvers();
const folders = createMapFolders({
  projectTree(project, rel) {
    reads.push([project, rel]);
    return pending.promise;
  },
}, () => { redraws++; });

const initial = folders.load(scope, "source");
assert.deepEqual(folders.get(scope, "source"), { state: "loading" });
await folders.load(scope, "source", { again: true });
assert.deepEqual(reads, [["project", "worktree/source"]], "calls deduplicate while a folder is loading");
pending.reject({ status: 404 });
await initial;
assert.deepEqual(folders.get(scope, "source"), { state: "error", error: "Not there any more" });
await folders.load(scope, "source");
assert.equal(reads.length, 1, "an error stays visible until the user retries");

pending = Promise.withResolvers();
const retry = folders.load(scope, "source", { again: true });
pending.resolve({ dirs: [{ name: "docs", relative_path: "worktree/source/docs" }], files: [{ name: "README.md" }] });
await retry;
const loaded = { state: "ok", dirs: [{ name: "docs", path: "source/docs" }], files: [{ name: "README.md", path: "README.md" }] };
assert.deepEqual(folders.get(scope, "source"), loaded);
assert.equal(redraws, 2, "the view redraws once per settled read");

pending = Promise.withResolvers();
const refresh = folders.load(scope, "source", { again: true });
assert.deepEqual(folders.get(scope, "source"), loaded, "existing boxes remain visible during a refresh");
pending.resolve({});
await refresh;
assert.deepEqual(folders.get(scope, "source"), { state: "ok", dirs: [], files: [] });
