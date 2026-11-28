// @ts-check

import assert from "node:assert/strict";
import { test } from "node:test";
import { createScope } from "../../../core/kernel/scope.js";
import { api } from "../../../core/platform/api.js";
import { deferred, settle } from "../../../tests/lib/dom.mjs";
import { unavailable, viewerFixture } from "./viewer-fixture.mjs";

test("disposing the viewer retires delegated controls and pending clipboard work", async () => {
  const scope = createScope();
  const { viewer, document, window, host, clipboard, click, announcements } = await viewerFixture({ scope });
  const opener = document.createElement("button");
  document.body.append(opener);
  opener.focus();
  let rejectCopy = (/** @type {Error} */ _error) => {};
  let attempts = 0;
  clipboard.writeText = () => {
    attempts++;
    return new Promise((_, reject) => { rejectCopy = reject; });
  };
  let fallback = 0;
  document.execCommand = () => { fallback++; return true; };
  const file = unavailable();
  viewer.open(file, opener);
  const openedAnnouncements = [...announcements];
  click("[data-vw-copy-path]");
  assert.equal(attempts, 1);
  assert.ok(scope.size > 0);
  viewer.dispose();
  assert.equal(scope.size, 0);
  assert.equal(document.activeElement, opener);
  assert.equal(host.hidden, true);
  rejectCopy(new Error("Clipboard unavailable"));
  await settle();
  assert.equal(fallback, 0);
  assert.deepEqual(announcements, openedAnnouncements);
  assert.equal(host.childElementCount, 0);
  viewer.open(file, opener);
  assert.equal(viewer.hasFile, false);

  const control = document.createElement("button");
  control.setAttribute("data-vw-copy-path", "");
  host.append(control);
  control.dispatchEvent(new window.Event("click", { bubbles: true }));
  assert.equal(attempts, 1);
});

test("an accepted download cannot create an object URL after viewer disposal", async (t) => {
  const response = deferred();
  const request = t.mock.method(api, "projectDownload", () => response.promise);
  const makeUrl = t.mock.method(URL, "createObjectURL", () => "blob:retired-download");
  const scope = createScope();
  const { viewer, host, click } = await viewerFixture({ scope });
  viewer.open(unavailable());
  click("[data-vw-more]");
  click(".vw-menu [data-vw-download]");
  assert.equal(request.mock.callCount(), 1);
  viewer.dispose();
  response.resolve(new Blob(["download"]));
  await settle();
  assert.equal(makeUrl.mock.callCount(), 0);
  assert.equal(scope.size, 0);
  assert.equal(host.hidden, true);
});
