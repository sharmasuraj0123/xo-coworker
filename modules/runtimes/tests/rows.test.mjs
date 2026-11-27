// @ts-check

import assert from "node:assert/strict";
import { test } from "node:test";
import { rowHtml, deviceCode, landed } from "../rows.js";

/** @typedef {import("../../../core/services/runtime-types").Runtime} Runtime */

/** @param {string} name @param {Partial<NonNullable<Runtime["lifecycle"]>>} lc @returns {Runtime} */
const rt = (name, lc) => ({ name, health: {}, lifecycle: { name, state: "ready", installed: true, signed_in: true, actions: [], ...lc } });

/** @param {string} html */
const acts = (html) => [...html.matchAll(/data-rt-act="(\w+)"/g)].map((m) => m[1]);
/** @param {string} html */
const words = (html) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

test("a row offers its next step as a button and never an action the runtime lacks", () => {
  const absent = rowHtml(rt("codex", { installed: false, signed_in: false, actions: ["install"] }));
  assert.deepEqual(acts(absent), ["install"]);
  const out = rowHtml(rt("antigravity", { signed_in: false, actions: ["sign_in", "update"] }));
  assert.deepEqual(acts(out), ["sign_in", "menu"]);
  assert.match(words(out), /Not signed in/);
  const open = rowHtml(rt("codex", { actions: ["update", "sign_in", "sign_out"] }), { menuOpen: true });
  assert.deepEqual(acts(open), ["menu", "update", "sign_in", "sign_out"], "Codex has no Uninstall, so its menu has none");
  const none = rowHtml(rt("cursor", { installed: false, signed_in: false, actions: [] }));
  assert.deepEqual(acts(none), []);
  assert.match(words(none), /Install Cursor&#39;s CLI on this machine/);
});

test("an update on offer reads with its version; a running one shows its time and log", () => {
  const due = rowHtml(rt("claude_code", { needs_update: true, update: "2.1.330", actions: ["update", "uninstall"] }));
  assert.match(words(due), /Update to 2\.1\.330/);
  const job = { action: "update", status: "running", log: ["fetching"], at: 1000, open: true };
  const running = rowHtml(rt("claude_code", { state: "updating", update: "2.1.330", actions: ["update"] }), { job, now: 9000 });
  assert.match(words(running), /Updating to 2\.1\.330… 0:08/);
  assert.deepEqual(acts(running), ["log"]);
  assert.match(running, /<pre class="rt-log"[^>]*>fetching<\/pre>/);
});

test("a failed job stays with Try again and its log; a lost one says the restart took it", () => {
  const failed = { action: "install", status: "failed", log: ["boom"], error: "npm failed.", end: Date.parse("2026-11-26T14:31:00Z") };
  const html = rowHtml(rt("codex", { installed: false, signed_in: false, actions: ["install"] }), { job: failed });
  assert.match(words(html), /Install failed at .*npm failed\./);
  assert.deepEqual(acts(html), ["retry", "log"]);
  const lost = rowHtml(rt("codex", { actions: ["update"] }), { job: { action: "update", status: "failed", log: [], lost: true } });
  assert.match(words(lost), /Its log was lost when the Space restarted\./);
});

test("sign-in: paste runtimes get a code field; device runtimes show the code to type", () => {
  const paste = rowHtml(rt("claude_code", { signed_in: false, actions: ["sign_in"] }),
    { flow: { phase: "paste", ctl: new AbortController(), lines: [], url: "https://x.test/a" } });
  assert.match(paste, /data-rt-form="claude_code"/);
  assert.match(words(paste), /Closing or reloading this tab stops it/);
  const code = rowHtml(rt("codex", { signed_in: false, actions: ["sign_in"] }),
    { flow: { phase: "code", ctl: new AbortController(), lines: [], url: "https://x.test/d", code: "ABCD-1234" } });
  assert.match(words(code), /ABCD-1234/);
  assert.match(code, /href="https:\/\/x\.test\/d"[^>]*data-rt-act="open"/);
});

test("a device code needs both the link and the code", () => {
  assert.equal(deviceCode(["Go to https://auth.test/device."]), null);
  assert.deepEqual(deviceCode(["Go to https://auth.test/device.", "and enter WXYZ-9876"]), { url: "https://auth.test/device", code: "WXYZ-9876" });
  assert.deepEqual(deviceCode(["enter WXYZ-9876"], "https://given.test"), { url: "https://given.test", code: "WXYZ-9876" });
});

test("a login still being checked reads Checking…, never Not signed in, and lands no sign-in or sign-out", () => {
  const checking = rt("cursor", { state: "checking", signed_in: null, actions: ["update", "sign_in"] });
  const html = rowHtml(checking, { menuOpen: true });
  assert.match(words(html), /Checking…/);
  assert.doesNotMatch(words(html), /not signed in/i);
  assert.deepEqual(acts(html), ["menu", "update"]);
  assert.equal(landed(checking, "sign_in"), false);
  assert.equal(landed(checking, "sign_out"), false);
  assert.match(words(rowHtml(checking, { settling: "sign_in" })), /Finishing the sign-in…/);
});
