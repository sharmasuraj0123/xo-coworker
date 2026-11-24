// @ts-check
import assert from "node:assert/strict";
import { api } from "../../../core/platform/api.js";
import { settle } from "../../../tests/lib/dom.mjs";
import { projectFile, viewerFixture } from "./viewer-fixture.mjs";

const { viewer, host, click } = await viewerFixture();
api.projectFile = async () => ({ kind: "html", content: "<p>Document</p>", version: "1" });
api.projectImage = async () => new Blob(["image"], { type: "image/png" });
const documentFile = { ...projectFile("doc.html"), pin: true };
const image = { ...projectFile("photo.png"), pin: true };
viewer.open(documentFile);
await settle();
click('[data-vw-mode="source"]');
assert.equal(host.querySelector('[data-vw-mode="source"]').getAttribute("aria-pressed"), "true");
viewer.open(image);
await settle();
assert.equal(host.querySelector(".vw-img").classList.contains("is-actual"), false);
click('[data-vw-mode="actual"]');
assert.equal(host.querySelector(".vw-img").classList.contains("is-actual"), true);
click(".vw-img img");
assert.equal(host.querySelector(".vw-img").classList.contains("is-actual"), false);
click('[data-vw-mode="actual"]');
viewer.open(documentFile);
assert.equal(host.querySelector('[data-vw-mode="source"]').getAttribute("aria-pressed"), "true");
assert.ok(!host.querySelector("iframe"));
viewer.open(image);
assert.equal(host.querySelector(".vw-img").classList.contains("is-actual"), false);
viewer.close();
