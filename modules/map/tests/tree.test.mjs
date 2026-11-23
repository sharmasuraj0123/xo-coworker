// @ts-check
import assert from "node:assert/strict";
import { createMapFolders } from "../folders.js";
import { createMapTree, setOf } from "../tree.js";

const scope = /** @type {const} */ ({ kind: "thread", key: "t:work" });
const fold = { project: "project", base: ".xo/worktrees/work" };
const M = { scope, opened: new Map(), closed: new Map(), more: new Map(), shown: new Map(), autoOpen: new Map(), refs: new Map() };
const { load, get } = createMapFolders({
  async projectTree(_, rel) {
    return rel.endsWith("/src")
      ? { files: [{ name: "entry.js", relative_path: `${rel}/entry.js` }] }
      : { dirs: [{ name: "src", relative_path: `${rel}/src` }] };
  },
}, () => {});
const world = { project: () => ({ name: "Project" }), state: { projects: [] } };
const tree = createMapTree({ M, world, load, folderAt: get });

const marks = new Map();
const hot = new Set(["src/entry.js"]);
assert.equal(tree.folderTree(scope, fold, marks, hot).children[0].name, "Reading…");
await load(fold, "");
await load(fold, "src");
const [source] = tree.folderTree(scope, fold, marks, hot).children;
assert.equal(source.open, true);
assert.equal(source.children?.[0].name, "entry.js");
assert.deepEqual(M.refs.get("src/entry.js")?.open, { name: "entry.js", path: "src/entry.js", project: "project", rel: ".xo/worktrees/work/src/entry.js" });
assert.match(tree.boxHtml({ ...source, x: 0, y: 0 }, new Map()), /aria-expanded="true"/);
assert.equal(tree.folderTree(scope, fold, marks, new Set()).children[0].open, true, "seen folders stay unfolded");
setOf(M.closed, scope.key).add("src");
assert.equal(tree.folderTree(scope, fold, marks, hot).children[0].open, false, "a manual fold wins over the agent’s location");
