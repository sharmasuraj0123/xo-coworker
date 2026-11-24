// @ts-check
import assert from "node:assert/strict";
import { settle } from "../../../tests/lib/dom.mjs";
import { unavailable, viewerFixture } from "./viewer-fixture.mjs";

const { viewer, document, host, clipboard, click } = await viewerFixture();
let refused = true;
clipboard.writeText = async () => { if (refused) throw new Error("Copy refused"); };
viewer.open(unavailable());
const inline = ".vw-path [data-vw-copy-path]";
click(inline);
await settle();
const field = host.querySelector("[data-vw-cut-sel]");
assert.ok(field);
field.focus();
refused = false;
click(inline);
await settle();
assert.ok(!host.querySelector("[data-vw-cut-sel]"));
assert.ok(document.activeElement === host.querySelector(inline), "successful retry returns focus to the inline Copy path action");
assert.equal(host.querySelector(inline).textContent.trim(), "Copied");
