// @ts-check
import assert from "node:assert/strict";
import { createOpenNext } from "../open-next.js";

const notices = [], opened = [];
/** @type {{ key: string } | null} */
let next = null;
const openNext = createOpenNext({ homeParts: () => ({ next }), heraldShow: (notice) => notices.push(notice), decideKey: (key) => opened.push(key) });
openNext();
assert.equal(notices.at(-1)?.text, "Nothing needs you right now");
next = { key: "next" };
openNext();
assert.deepEqual(opened, ["next"]);
