// @ts-check
import assert from "node:assert/strict";
import { keysSheetRender } from "../index.js";
import { set } from "../../../core/platform/keys.js";
import { dom } from "../../../tests/lib/dom.mjs";

const { document } = await dom('<div id="keys-cols"></div>');
keysSheetRender();
const columns = [...document.querySelectorAll("#keys-cols dl.keys")];
assert.deepEqual(columns.map((column) => [...column.querySelectorAll(".kh")].map((heading) => heading.textContent)), [
  ["Anywhere", "On a picture"],
  ["On a decision", "In the intelligence popover"],
]);
const jumpKey = () => {
  const description = [...document.querySelectorAll("#keys-cols dd")].find((entry) => entry.textContent === "Jump to any project or thread");
  return description?.previousElementSibling.querySelector("kbd").textContent;
};
assert.match(jumpKey(), /K$/);
assert.deepEqual(set("jump", "mod+g"), { ok: true });
keysSheetRender();
assert.match(jumpKey(), /G$/, "the sheet reads the current binding");
