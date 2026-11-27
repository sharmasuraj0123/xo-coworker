// @ts-check

import { esc } from "../../core/platform/util.js";
import { ICON } from "../../core/ui/icons/names.js";
import { isInstalled, rtMark, rtName } from "../../core/services/runtimes.js";

/** @import { Runtime } from "../../core/services/runtime-types" */

/** @typedef {{ status: string } | null | undefined} GitHubRead */

/** @typedef {{ key: string, page: string, mark: string, name: string, line: string, act: string }} SetupItem */

const RUNTIMES = ["claude_code", "codex", "antigravity", "grok_build"];

/** @param {Runtime} rt */
const signedIn = (rt) => (rt.lifecycle ? rt.lifecycle.signed_in : !!rt.health?.logged_in);

/** @param {Runtime} rt @returns {SetupItem} */
function runtimeItem(rt) {
  const there = rt.lifecycle ? rt.lifecycle.installed : isInstalled(rt);
  const line = there ? "Sign in so XO can run work on it." : "Not installed on this Space yet.";
  const mark = rtMark(rt.name) || "";
  return { key: `rt:${rt.name}`, page: "runtimes", mark, name: rtName(rt.name), line, act: there ? "Sign in" : "Install" };
}

/** @type {SetupItem} */
const GITHUB = {
  key: "acct:github", page: "accounts", mark: ICON.github, name: "GitHub", line: "One-click deploys on XO's Launchpad.", act: "Connect",
};

/** Empty until both land, and once a runtime and GitHub are in. @param {Runtime[] | null | undefined} runtimes @param {GitHubRead} gh */
export function setupItems(runtimes, gh) {
  if (!runtimes || gh === undefined) return [];
  const ghOut = !!gh && gh.status !== "connected" && gh.status !== "failed";
  if (runtimes.some(signedIn) && !ghOut) return [];
  const out = RUNTIMES.flatMap((n) => runtimes.filter((r) => r.name === n && !signedIn(r)));
  return [...out.map(runtimeItem), ...(ghOut ? [GITHUB] : [])];
}

/** @param {SetupItem} it */
const rowHtml = (it) => `<li><button type="button" class="su-i" data-set-open="${it.page}" data-set-row="${esc(it.key)}">` +
  `<span class="su-ic" aria-hidden="true">${it.mark}</span>` +
  `<span class="su-t"><b>${esc(it.name)}</b><span>${esc(it.line)}</span></span>` +
  `<span class="su-go">${esc(it.act)}${ICON.right}</span></button></li>`;

/** @param {SetupItem[]} items */
export function setupHtml(items) {
  if (!items.length) return "";
  return `<section class="su" aria-labelledby="su-h"><h2 class="hm-lbl" id="su-h">Get set up</h2>` +
    `<p class="su-lead">Sign in to an agent so XO can work for you, and to GitHub so it can deploy.</p>` +
    `<ul class="su-list">${items.map(rowHtml).join("")}</ul></section>`;
}
