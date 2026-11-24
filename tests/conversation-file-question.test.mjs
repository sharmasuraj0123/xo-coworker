// @ts-check

import assert from "node:assert/strict";
import { createFileQuestion } from "../modules/conversation/file-question.js";
import { createFileReferences } from "../modules/conversation/file-references.js";
import { createLocalMessages } from "../modules/conversation/local-messages.js";
import { fileRef, lineRef } from "../modules/changes/store.js";
import { fileScope, localIn } from "../modules/files/scope.js";
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

const question = createFileQuestion({
  localMessages: createLocalMessages(), view: () => view, fileReferences: createFileReferences(), say, fileScope, localIn, lineRef, fileRef,
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
question.lrefRender();
assert.ok(document.querySelector("#cref [data-lref-x]") === removal, "redrawing preserves the line reference control");
assert.deepEqual(deliveries, []);
view = "p:elsewhere";
question.lrefRender();
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
assert.match(question.youText(deliveries[0].message.text), /data-ref-a="8" data-ref-b="11"/);

assert.ok(question.askAboutLines({ project: "demo", rel: "src/index.js", name: "index.js" }, 8, 8, "Why?"));
assert.deepEqual(destinations.at(-1), { pid: "demo" });
assert.equal(deliveries.at(-1).message.target, "demo");
assert.equal(notices.at(-1).text, "Sending to demo…");
