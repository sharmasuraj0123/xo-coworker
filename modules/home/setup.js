// @ts-check

import { esc } from "../../core/platform/util.js";
import { ICON } from "../../core/ui/icons/names.js";
import { isInstalled, rtMark, rtName } from "../../core/services/runtimes.js";

/** @import { Runtime } from "../../core/services/runtime-types" */

/** @typedef {{ status: string } | null | undefined} GitHubRead */

/** @typedef {{ key: string, page: string, mark: string, name: string, line: string, act: string, done: string }} SetupItem */

const RUNTIMES = ["claude_code", "codex", "antigravity", "grok_build"];

/** @param {Runtime} rt */
const signedIn = (rt) => (rt.lifecycle ? rt.lifecycle.signed_in : !!rt.health?.logged_in);

/** @param {Runtime} rt @returns {SetupItem} */
function runtimeItem(rt) {
  const there = rt.lifecycle ? rt.lifecycle.installed : isInstalled(rt);
  const line = there ? "Sign in so XO can run work on it." : "Not installed on this Space yet.";
  const act = there ? "Sign in" : "Install";
  return { key: `rt:${rt.name}`, page: "runtimes", mark: rtMark(rt.name) || "", name: rtName(rt.name), line, act, done: "Signed in" };
}

/** @type {SetupItem} */
const GITHUB = {
  key: "acct:github", page: "accounts", mark: ICON.github, name: "GitHub", line: "One-click deploys on XO's Launchpad.", act: "Connect",
  done: "Connected",
};

/** Null until both reads land; empty once set up. @param {Runtime[] | null | undefined} runtimes @param {GitHubRead} gh */
export function setupNeeds(runtimes, gh) {
  if (!runtimes || gh === undefined) return null;
  const ghOut = !!gh && gh.status !== "connected" && gh.status !== "failed";
  if (runtimes.some(signedIn) && !ghOut) return [];
  const out = RUNTIMES.flatMap((n) => runtimes.filter((r) => r.name === n && !signedIn(r)));
  return [...out.map(runtimeItem), ...(ghOut ? [GITHUB] : [])];
}

/** Whether its sign-in is done. @param {string} key @param {Runtime[] | null | undefined} runtimes @param {GitHubRead} gh */
export function signedInNow(key, runtimes, gh) {
  if (key === GITHUB.key) return gh?.status === "connected";
  const rt = (runtimes || []).find((r) => `rt:${r.name}` === key);
  return !!rt && signedIn(rt);
}

/** @param {SetupItem} it @param {boolean} done */
export function rowHtml(it, done) {
  const ok = done ? `<span class="su-ok">${ICON.check}</span>` : "";
  const tile = `<span class="su-ic" aria-hidden="true"><span class="su-m">${it.mark}</span>${ok}</span>`;
  const text = `<span class="su-t"><b>${esc(it.name)}</b><span>${esc(done ? it.done : it.line)}</span></span>`;
  if (done) return `<div class="su-i is-done" role="status">${tile}${text}</div>`;
  return `<button type="button" class="su-i" data-set-open="${it.page}" data-set-row="${esc(it.key)}">${tile}${text}` +
    `<span class="su-go">${esc(it.act)}${ICON.right}</span></button>`;
}

const READY = "XO can work for you now, and deploy to Launchpad.";
const WELCOME = "A few suggestions for this Space. Explore freely; they wait here until you're ready.";

/** @param {boolean} allSet */
export const headHtml = (allSet) => `<h2 class="hm-lbl" id="su-h">${allSet ? "You're all set" : "Get started"}</h2>` +
  `<p class="su-lead">${allSet ? READY : WELCOME}</p>`;
