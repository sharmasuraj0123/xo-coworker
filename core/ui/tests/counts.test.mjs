// node core/ui/tests/counts.test.mjs: the +/− counts atom says both sides, leaves out a side with none, and draws nothing for a pure rename.
import assert from "node:assert/strict";
import { countsHtml } from "../components/counts.js";

assert.equal(countsHtml(null), "");
assert.equal(countsHtml({ additions: 0, deletions: 0 }), "");
assert.equal(countsHtml({}), "");
assert.equal(countsHtml({ add: 5, del: 8 }), '<span class="xd-n" aria-label="5 added, 8 removed"><b class="xd-a">+5</b><b class="xd-d">−8</b></span>');
assert.equal(countsHtml({ additions: 3 }), '<span class="xd-n" aria-label="3 added, 0 removed"><b class="xd-a">+3</b></span>');
console.log("ok  counts");
