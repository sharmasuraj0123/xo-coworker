// @ts-check
import assert from "node:assert/strict";
import { createMapFolders } from "../folders.js";

const scope = { project: "project", base: "worktree" };
/** @type {string[][]} */
const reads = [];
/** @type {AbortSignal[]} */
const signals = [];
let redraws = 0;
/** @type {PromiseWithResolvers<import("../folders-types.d.ts").MapTree>} */
let pending = Promise.withResolvers();
const folders = createMapFolders({
  projectTree(project, rel, signal) {
    reads.push([project, rel]);
    signals.push(signal);
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

const stale = pending = Promise.withResolvers();
const older = folders.load(scope, "source", { again: true });
await Promise.resolve();
const olderSignal = signals.at(-1);
pending = Promise.withResolvers();
const newer = folders.load(scope, "source", { again: true });
pending.resolve({ files: [{ name: "latest" }] });
await newer;
assert.equal(olderSignal?.aborted, true);
stale.resolve({ files: [{ name: "stale" }] });
await older;
assert.deepEqual(folders.get(scope, "source"), { state: "ok", dirs: [], files: [{ name: "latest", path: "latest" }] });
assert.equal(redraws, 4);

pending = Promise.withResolvers();
const abandoned = folders.load(scope, "source", { again: true });
await Promise.resolve();
folders.dispose();
assert.equal(signals.at(-1)?.aborted, true);
pending.resolve({ files: [{ name: "disposed" }] });
await abandoned;
assert.equal(redraws, 4);
