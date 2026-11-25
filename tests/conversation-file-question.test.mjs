// @ts-check

import assert from "node:assert/strict";
import { createFileQuestion } from "../modules/conversation/file-question.js";
import { createFileReferences, fileRef, lineRef } from "../modules/conversation/file-references.js";
import { createLocalMessages } from "../modules/conversation/local-messages.js";
import { youText } from "../modules/conversation/file-reference-text.js";
import { createFileReferenceLine } from "../modules/conversation/file-reference-line.js";
import { dom } from "./lib/dom.mjs";

const { document } = await dom("<textarea></textarea><div id='cref'></div>");
const thread = { id: "thread-1", title: "Review", project: "demo", worktree: "/demo/.xo/worktrees/thread-1" };
const file = { project: "demo", rel: ".xo/worktrees/thread-1/src/index.js", name: "index.js" };
const say = document.querySelector("textarea");
const deliveries = [];
const destinations = [];
const notices = [];
const refusals = [];
const followed = [];
let block = "";
let view = "t:thread-1";

const fileReferences = createFileReferences();
const lrefRender = createFileReferenceLine({ view: () => view, fileReferences });
const question = createFileQuestion({
  localMessages: createLocalMessages(), view: () => view, fileReferences, say, lrefRender,
  world: { state: { threads: [thread] }, thread: (key) => key === thread.id ? thread : null },
  PROJ: (id) => id,
  convOfChat: (id) => "p:" + id,
  CH: { isChats: () => false },
  VW: { close() {} },
  STAGE: { resumeFollow: (destination) => { followed.push(destination); } },
  go: (destination) => { view = destination; },
  announce() {},
  heraldShow: (notice) => { notices.push(notice); },
  schedule() {},
  blockFor: (destination) => { destinations.push(destination); return block; },
  refuse: (reason) => { refusals.push(reason); },
  deliverLive: async (message, recipient) => { deliveries.push({ message, recipient }); },
});

assert.ok(question.composeAbout(file, 8, 11));
assert.ok(document.activeElement === say, "the file lines go in the focused composer");
const capsule = document.querySelector("#cref [data-ref]");
assert.equal(capsule?.getAttribute("data-ref"), "src/index.js");
assert.equal(capsule?.getAttribute("data-ref-a"), "8");
assert.equal(capsule?.getAttribute("data-ref-b"), "11");
const removal = document.querySelector("#cref [data-lref-x]");
assert.equal(removal?.getAttribute("aria-label"), "Take the lines out of this message");
lrefRender();
assert.ok(document.querySelector("#cref [data-lref-x]") === removal, "redrawing preserves the line reference control");
assert.deepEqual(deliveries, []);
view = "p:elsewhere";
lrefRender();
assert.ok(document.querySelector("#cref")?.hidden, "the file reference stays in its originating conversation");
assert.equal(question.composeAbout(file, 8, 11), false, "another place's composer cannot claim the file");
assert.ok(question.askAboutFile(file));
assert.equal(view, "t:thread-1");
assert.equal(document.querySelector("#cref [data-ref]")?.getAttribute("data-ref-a"), null);
assert.deepEqual(deliveries, []);

view = "p:elsewhere";
block = "Connecting";
assert.equal(question.askAboutLines(file, 8, 11, "What happens here?"), false);
assert.deepEqual(refusals, ["Connecting"]);
assert.deepEqual(deliveries, []);
block = "";
assert.ok(question.askAboutLines(file, 8, 11, "What happens here?"));
assert.deepEqual(destinations, [{ thread: true }, { thread: true }]);
assert.deepEqual(followed, ["t:thread-1"]);
assert.ok(deliveries[0]?.recipient === thread);
assert.equal(deliveries[0]?.message.text, "src/index.js:8-11\n\nWhat happens here?");
assert.equal(notices[0]?.mid, deliveries[0]?.message.id);
assert.equal(notices[0]?.text, "Sending to Review…");
assert.match(youText(deliveries[0].message.text), /data-ref-a="8" data-ref-b="11"/);

assert.ok(question.askAboutLines({ project: "demo", rel: "src/index.js", name: "index.js" }, 8, 8, "Why?"));
assert.deepEqual(destinations.at(-1), { pid: "demo" });
assert.equal(deliveries.at(-1).message.target, "demo");
assert.equal(notices.at(-1).text, "Sending to demo…");

assert.deepEqual(lineRef("js/follow.js:36-43\n\nWhy only the real bottom?"), { path: "js/follow.js", a: 36, b: 43, rest: "Why only the real bottom?" });
assert.deepEqual(lineRef("Makefile:7\n\nwhat runs here?\nand here"), { path: "Makefile", a: 7, b: 7, rest: "what runs here?\nand here" });
assert.equal(lineRef("js/a.js:9-3\n\nbackwards"), null);
assert.equal(lineRef("js/a.js:36-43 no blank line"), null);
// a whole file (Ask about this): its own marker, whatever the path looks like; never guessed from a first line
assert.deepEqual(fileRef("File: README.md\n\nwhat is this for?"), { path: "README.md", rest: "what is this for?" });
assert.deepEqual(fileRef("File: Makefile\n\nwhat runs?"), { path: "Makefile", rest: "what runs?" });
assert.deepEqual(fileRef("File: LICENSE\n\nwhich one?"), { path: "LICENSE", rest: "which one?" });
assert.deepEqual(fileRef("File: docs/my notes.md\n\nspaces too"), { path: "docs/my notes.md", rest: "spaces too" });
assert.equal(fileRef("README.md\n\nno marker, no capsule"), null);
assert.equal(fileRef("e.g.\n\nthis"), null);
assert.equal(fileRef("Hello\n\nthere"), null);
assert.equal(lineRef("Note: 12 things\n\nhi"), null);
assert.equal(lineRef("see js/a.js:3\n\nmid-sentence"), null);
assert.equal(lineRef(""), null);
