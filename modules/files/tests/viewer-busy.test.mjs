// @ts-check
import assert from "node:assert/strict";
import { mock } from "node:test";
import { api } from "../../../core/platform/api.js";
import { deferred } from "../../../tests/lib/dom.mjs";
import { unavailable, viewerFixture } from "./viewer-fixture.mjs";

const { viewer, host, clipboard, announcements, click } = await viewerFixture();
const copyPath = ".vw-path [data-vw-copy-path]";
const more = "[data-vw-more]";
const pending = [];
clipboard.writeText = () => {
  const attempt = deferred();
  pending.push(attempt);
  return attempt.promise;
};
const download = deferred();
let downloads = 0;
api.projectDownload = () => { downloads++; return download.promise; };
mock.timers.enable({ apis: ["setTimeout"] });
try {
  viewer.open(unavailable());
  click(copyPath);
  click(copyPath);
  click(more);
  assert.equal(pending.length, 1);
  assert.ok(!host.querySelector('[role="menu"]'));
  mock.timers.tick(249);
  assert.equal(host.querySelector(copyPath).textContent.trim(), "Copying…");
  pending[0].resolve();
  await Promise.resolve();
  assert.equal(host.querySelector(copyPath).textContent.trim(), "Copied");

  mock.timers.tick(1000);
  click(copyPath);
  pending[1].resolve();
  await Promise.resolve();
  mock.timers.tick(400);
  assert.equal(host.querySelector(copyPath).textContent.trim(), "Copied", "an old timer leaves newer success visible");
  mock.timers.tick(1000);
  assert.equal(host.querySelector(copyPath).textContent.trim(), "Copy the path");

  click(more);
  click(".vw-menu [data-vw-download]");
  assert.equal(downloads, 1);
  assert.match(host.querySelector(more).textContent, /Downloading/);
  click(copyPath);
  click(more);
  assert.equal(pending.length, 2, "the pending download excludes clipboard work");
  assert.ok(!host.querySelector('[role="menu"]'));
  download.reject(new Error("Download refused"));
  await Promise.resolve();
  assert.match(host.querySelector('[role="alert"]').textContent, /Download refused/);

  click(copyPath);
  viewer.open(unavailable("another.txt"));
  const last = announcements.at(-1);
  pending[2].resolve();
  await Promise.resolve();
  assert.equal(announcements.at(-1), last, "a previous file's clipboard result cannot update the new one");
  assert.equal(host.querySelector(copyPath).textContent.trim(), "Copy the path");
} finally {
  viewer.close();
  mock.timers.reset();
}
