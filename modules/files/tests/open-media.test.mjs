// @ts-check
import assert from "node:assert/strict";
import { dom } from "../../../tests/lib/dom.mjs";
import { mediaItem } from "../../../core/services/media/items.js";
import { mediaHtml } from "../../../core/services/media/render.js";
import { createMediaOpener } from "../open-media.js";
import { filePlace } from "../scope.js";

const { document } = await dom('<main id="msgs"></main>');
const msgsEl = document.getElementById("msgs");
msgsEl.innerHTML = mediaHtml([mediaItem({ key: "picture", name: "image.png", project: "project", rel: "src/image.png" })]);
const picture = msgsEl.querySelector('[data-mx="picture"]');
const albums = [], files = [];
const openMedia = createMediaOpener({ msgsEl, LB: { open: (key, from, root) => albums.push({ key, from, root }) }, VW: { open: (file) => files.push(file) } });
openMedia(picture, { shiftKey: false });
assert.equal(albums.length, 1);
assert.equal(albums[0].key, "picture");
assert.ok(albums[0].from === picture && albums[0].root === msgsEl);
openMedia(picture, { shiftKey: true });
assert.equal(albums.length, 1);
assert.deepEqual(files, [{ name: "image.png", type: "", bytes: null, path: "src/image.png", project: "project", rel: "src/image.png" }]);

const deps = { thread: () => null, project: () => "Research" };
assert.equal(filePlace("home", deps), null, "Home has no Files search scope");
assert.deepEqual(filePlace("p:project", deps), { project: "project", base: "", label: "Research" });
