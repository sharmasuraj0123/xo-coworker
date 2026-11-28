// @ts-check

// Launchpad's constants and the small pure pieces its screens are drawn from.
import { ICON } from "../../core/ui/icons/names.js";
import { esc } from "../../core/platform/index.js";
import { nextStep, sizeWords } from "./model.js";

/** @import { Model } from "./model.js" */
/** @import { DeployFrame } from "./lifetime-types.d.ts" */

export const LP_ICON = {
  rocket: ICON.deploy, github: ICON.github, image: ICON.container, app: ICON.server, out: ICON.out, more: ICON.more,
  link: ICON.link, x: ICON.close,
};

export const NODES = ["repo", "build", "release", "live"];
/** Errors that wait for you rather than fail (amber, not red). */
export const NEEDS_YOU = new Set(["github_workflow_scope", "github_not_connected", "github_token_invalid"]);
/** @type {Record<string, string>} */
export const WORD = { repo: "Pushing", build: "Building", release: "Releasing", live: "Going live" };
export const SLUG = /^[a-z0-9]([a-z0-9-]{0,23}[a-z0-9])?$/; // Space's NAME_RE: 1–25
export const CACHE = "xo-lp-state"; // project → its last check's state only (no values, no secrets), so the button doesn't flicker
export const AGAIN_MS = 5 * 60e3, ERR_MS = 60e3;
export const STOP_MS = 3000, UNLINK_MS = 3200; // Stop's and Unlink's windows: their notices' Undo lasts exactly as long
/** Where focus goes when a run is over (stopped, ended): the screen's way on, whichever screen that is. */
export const AFTER = '[data-lp="deploy"], [data-lp="again"], [data-lp="reconnect"], [data-lp="ask"], [data-lp="recheck"]';
export const newRun = (at = Date.now()) => ({ startedAt: at, steps: {}, error: null, live: null, undo: 0, stop: null });

/** @param {number} ms */
const clock = (ms) => { const s = Math.max(0, Math.floor(ms / 1000)); return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s`; };
/** @param {number} at */
export const ago = (at) => { const m = Math.round((Date.now() - at) / 60e3); return m < 1 ? "just now" : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`; };
/** @param {number} at */
export const since = (at) => `<span class="elapsed" data-since="${at}">${clock(Date.now() - at)}</span>`;
/** Where Space found a value, in a few words ("Dockerfile EXPOSE" → "the Dockerfile"). @param {string} src */
export const where = (src) => (/^Dockerfile/.test(src) ? "the Dockerfile" : /^package\.json/.test(src) ? "package.json" : /^default/.test(src) ? "the default" : src);
/** @param {unknown} t */
export const cap = (t) => { const s = String(t || ""); return /^\S*[./]/.test(s) ? s : s.replace(/^./, (x) => x.toUpperCase()); }; // a file name keeps its case
/** @param {Pick<Model, "sizes">} c @param {string | undefined} name @param {string} [label] */
export const sizeText = (c, name, label = "") => sizeWords(c.sizes?.tiers.find((t) => t.name === name), label) || name || "";
/** @param {unknown} s */
export const slug = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+/, "").slice(0, 25).replace(/-+$/, "");

/** @param {{ code?: string }} e */
export const failWords = (e) => /** @type {Record<string, string>} */ ({ build_failed: "Build failed", build_timeout: "Build is slow", health_check_failed: "Didn't go live", release_failed: "Didn't go live", release_timeout: "Release is slow", github_workflow_scope: "Needs GitHub", github_not_connected: "Needs GitHub", github_token_invalid: "Needs GitHub", push_rejected: "Push refused", remote_ahead: "Push refused", launchpad_unreachable: "Launchpad didn't answer", github_unreachable: "GitHub didn't answer", launchpad_limit: "App limit reached", launchpad_forbidden: "Launchpad said no", cancelled: "Stopped" })[e.code || ""] || "Didn't deploy";

/** A decision's own lit button above the form: not when the form is the answer (settings), nor done outside. @param {DeployFrame} nd @returns {ReturnType<typeof nextStep>} */
export const lit = (nd) => { const a = nextStep(nd.action || "", nd.data); return a && a[1] !== "settings" && a[1] !== "retry" && a[1] !== "log" ? a : null; };
/** @param {{ fix?: string }} e */
export const fixOf = (e) => (e.fix ? `<p class="lp-note">${esc(e.fix)}</p>` : "");
/** A gh login on this machine without `workflow`: Space's command, to copy. @param {string} fix */
export const ghCmd = (fix) => /`([^`]+)`/.exec(fix || "")?.[1] || "";
/** @param {string} cmd @param {{ cmdCopied: number } | null | undefined} s */
export const cmdHtml = (cmd, s) => { const on = !!s && s.cmdCopied > Date.now(); return `<div class="lp-cmd"><code>${esc(cmd)}</code><button type="button" class="lp-ib" data-lp="cmd-copy" data-v="${esc(cmd)}" title="${on ? "Copied" : "Copy the command"}" aria-label="Copy the command">${on ? ICON.check : ICON.copy}</button></div>`; };

/** Where deploy.json sends the code, and where git's origin points: both whole, so the person sees the difference. @param {DeployFrame} nd */
export const repoFacts = (nd) => {
  const d = nd.data || {};
  return `<p>deploy.json names ${d.repo ? `<code>${esc(d.repo)}</code>` : "a repository"}. ${d.origin ? `This project's git origin is <code>${esc(d.origin)}</code>.` : "This project has no git origin."}</p>`;
};
/** The apps a push would also deploy (Space's other_apps), each by its slug or its workflow file, and where the push goes. @param {DeployFrame} nd */
export const appsFacts = (nd) => {
  const d = nd.data || {}, apps = Array.isArray(d.apps) ? d.apps : [];
  return `<p>${d.repo ? `A push to <code>${esc(d.repo)}</code>${d.branch ? ` (<code>${esc(d.branch)}</code>)` : ""}` : "A push"} also deploys:</p>` +
    (apps.length ? `<ul class="lp-also">${apps.map((a) => `<li><code>${esc(a.slug || a.id || "")}</code>${a.slug && a.workflow ? ` <span>from <code>${esc(a.workflow)}</code></span>` : !a.slug ? " <span>(a workflow file)</span>" : ""}</li>`).join("")}</ul>` : "");
};
/** @param {Pick<Model, "sizes">} c @param {{ size?: string }} f */
export const sizeHint = (c, f) => (c.sizes?.def && (f.size || c.sizes.def) === c.sizes.def ? "The default; fixed once created." : "Fixed once it's created.");
