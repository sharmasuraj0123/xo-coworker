// @ts-check

// Launchpad's constants and the small pure pieces its screens are drawn from.
import { ICON } from "../../core/ui/icons/names.js";
import { esc } from "../../core/platform/index.js";
import { nextStep, sizeWords } from "./model.js";

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
/** An address Space reported, as its first label (the app's own) and the rest, quieter; never one built from the name. @param {string} host @returns {[string, string]} */
export const split = (host) => { const i = String(host || "").indexOf("."); return i < 0 ? [host || "", ""] : [host.slice(0, i), host.slice(i)]; };
/** Where Space found a value, in a few words ("Dockerfile EXPOSE" → "the Dockerfile"). @param {string} src */
export const where = (src) => (/^Dockerfile/.test(src) ? "the Dockerfile" : /^package\.json/.test(src) ? "package.json" : /^default/.test(src) ? "the default" : src);
/** @param {unknown} t */
export const cap = (t) => { const s = String(t || ""); return /^\S*[./]/.test(s) ? s : s.replace(/^./, (x) => x.toUpperCase()); }; // a file name keeps its case
/** @param {any} c @param {string} name @param {string} [label] */
export const sizeText = (c, name, label = "") => sizeWords(c.sizes?.tiers.find((/** @type {any} */ t) => t.name === name), label) || name || "";
/** @param {unknown} s */
export const slug = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+/, "").slice(0, 25).replace(/-+$/, "");

/** @param {any} e */
export const failWords = (e) => /** @type {Record<string, string>} */ ({ build_failed: "Build failed", build_timeout: "Build is slow", health_check_failed: "Didn't go live", release_failed: "Didn't go live", release_timeout: "Release is slow", github_workflow_scope: "Needs GitHub", github_not_connected: "Needs GitHub", github_token_invalid: "Needs GitHub", push_rejected: "Push refused", remote_ahead: "Push refused", launchpad_unreachable: "Launchpad didn't answer", github_unreachable: "GitHub didn't answer", launchpad_limit: "App limit reached", launchpad_forbidden: "Launchpad said no", cancelled: "Stopped" })[e.code] || "Didn't deploy";

/** The demo's headline: the state in one word or a few, large, and what it means in a sentence. @param {string} word @param {string} sentence @param {string} [tone] */
export const hero = (word, sentence, tone = "") => `<div class="lpv-hero"><h3 class="lp-h${tone ? ` t-${tone}` : ""}">${word}</h3>${sentence ? `<p class="lp-p">${sentence}</p>` : ""}</div>`;
/** @param {number} ms */
export const span = (ms) => { const m = Math.max(1, Math.round(ms / 60e3)); return m < 60 ? `${m} min` : m < 1440 ? `${Math.round(m / 60)} h` : `${Math.round(m / 1440)} d`; };
/** A decision's own lit button above the form: not when the form is the answer (settings), nor done outside. @param {any} nd @returns {any} */
export const lit = (nd) => { const a = nextStep(nd.action, nd.data); return a && a[1] !== "settings" && a[1] !== "retry" && a[1] !== "log" ? a : null; };
/** @param {any} e */
export const fixOf = (e) => (e.fix ? `<p class="lp-note">${esc(e.fix)}</p>` : "");
/** Space's next step as the lit button; done outside the panel, only a quiet way back once it's done. @param {any} e */
export const actionHtml = (e) => {
  const a = nextStep(e.action);
  if (!a) return e.action === "none" ? "" : `<div class="lp-acts"><button type="button" class="lp-b" data-lp="retry">${ICON.retry}<span>Deploy again once that's done</span></button></div>`;
  if (a[1] === "log") return e.url ? `<div class="lp-acts"><a class="lp-go" href="${esc(e.url)}" target="_blank" rel="noopener"><span>${a[0]}</span>${LP_ICON.out}</a></div>` : "";
  return `<div class="lp-acts"><button type="button" class="lp-go" data-lp="${a[1]}">${a[1] === "reconnect" ? LP_ICON.github : a[1] === "retry" ? ICON.retry : ""}<span>${a[0]}</span></button></div>`;
};
/** A gh login on this machine without `workflow`: Space's command, to copy. @param {string} fix */
export const ghCmd = (fix) => /`([^`]+)`/.exec(fix || "")?.[1] || "";
/** @param {string} cmd @param {any} s */
export const cmdHtml = (cmd, s) => { const on = s && s.cmdCopied > Date.now(); return `<div class="lp-cmd"><code>${esc(cmd)}</code><button type="button" class="lp-ib" data-lp="cmd-copy" data-v="${esc(cmd)}" title="${on ? "Copied" : "Copy the command"}" aria-label="Copy the command">${on ? ICON.check : ICON.copy}</button></div>`; };

/** @param {string} h @param {string} p @param {string} [tone] */
export const head = (h, p, tone = "") => `<div class="lp-hd"><h3 class="lp-h${tone ? ` t-${tone}` : ""}">${h}</h3>${p ? `<p class="lp-p">${p}</p>` : ""}</div>`;
/** @param {string} title @param {string} text @param {string} act @param {string} label @param {string} [icon] @param {any} [s] */
export const rec = (title, text, act, label, icon = "", s = null) => {
  const asking = s && s.asking && /^ask/.test(act), err = s && !s.asking && s.askErr && /^ask/.test(act) ? s.askErr : "";
  return `<div class="lp-rec"><div class="lp-rec-c"><span class="lp-rec-k">${ICON.spark}Recommended</span><b>${title}</b><p>${text}</p></div>` +
    `<button type="button" class="lp-go" data-lp="${act}"${asking ? ' aria-disabled="true"' : ""}>${asking ? '<i class="lp-arc" aria-hidden="true"></i><span>Starting a thread…</span>' : `${icon}<span>${err ? "Try again" : label}</span>`}</button>` +
    (err ? `<p class="lp-err" role="status">Couldn't start the thread: ${esc(err)}.</p>` : "") + `</div>`;
};
/** Where launchpad.json sends the code, and where git's origin points: both whole, so the person sees the difference. @param {any} nd */
export const repoFacts = (nd) => {
  const d = nd.data || {};
  return `<p>launchpad.json names ${d.repo ? `<code>${esc(d.repo)}</code>` : "a repository"}. ${d.origin ? `This project's git origin is <code>${esc(d.origin)}</code>.` : "This project has no git origin."}</p>`;
};
/** The apps a push would also deploy (Space's other_apps), each by its slug or its workflow file, and where the push goes. @param {any} nd */
export const appsFacts = (nd) => {
  const d = nd.data || {}, apps = Array.isArray(d.apps) ? d.apps : [];
  return `<p>${d.repo ? `A push to <code>${esc(d.repo)}</code>${d.branch ? ` (<code>${esc(d.branch)}</code>)` : ""}` : "A push"} also deploys:</p>` +
    (apps.length ? `<ul class="lp-also">${apps.map((/** @type {any} */ a) => `<li><code>${esc(a.slug || a.id || "")}</code>${a.slug && a.workflow ? ` <span>from <code>${esc(a.workflow)}</code></span>` : !a.slug ? " <span>(a workflow file)</span>" : ""}</li>`).join("")}</ul>` : "");
};
/** @param {any} c @param {any} f */
export const sizeHint = (c, f) => (c.sizes?.def && (f.size || c.sizes.def) === c.sizes.def ? "The default; fixed once created." : "Fixed once it's created.");
/** Every hint and error sits under its field, whole; Launchpad's free name is a button of its own under the hint. @param {string} id @param {string} label @param {string} value @param {{ hint?: string, bad?: boolean, mode?: string, short?: boolean, fix?: string }} [o] */
export function field(id, label, value, { hint = "", bad = false, mode = "text", short = false, fix = "" } = {}) {
  return `<label class="lp-f${bad ? " is-bad" : ""}"><span class="lp-l">${label}</span><span class="lp-v"><input class="lp-in${short ? " is-short" : ""}" data-lp-f="${id}" value="${esc(value || "")}" inputmode="${mode}" autocomplete="off" autocapitalize="off" spellcheck="false" aria-describedby="lp-h-${id}"${bad ? ' aria-invalid="true"' : ""}><span class="lp-hint" id="lp-h-${id}">${hint}</span>${fix ? `<button type="button" class="lp-b lp-fix" data-lp="use-name" data-v="${esc(fix)}">Use ${esc(fix)}</button>` : ""}</span></label>`;
}
/** What Space warned of on the way (uncommitted changes left out, env names with no value): worth reading, not fatal. @param {any} s */
export const warnHtml = (s) => (s.warn || []).map((/** @type {string} */ w) => `<p class="lp-note t-need">${esc(w)}</p>`).join("");
