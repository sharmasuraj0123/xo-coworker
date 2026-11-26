// @ts-check
import { esc } from "../../core/platform/util.js";
import { clockWords } from "../../core/platform/time.js";
import { rtName, rtMark, healthOf, windowsOf, resetWords } from "../../core/services/runtimes.js";

/** @import { Runtime } from "../../core/services/runtime-types" */

/** @import { Flow, JobView, RowView, RowAction, RowParts, Remote } from "./lifecycle-types" */

/** Runtimes whose sign-in page shows a code to paste back; the rest show a one-time code to type there. */
export const PASTE = new Set(["claude_code", "antigravity"]);
/** Runtimes with a remote control. */
export const REMOTE = new Set(["claude_code", "codex"]);
/** @type {Record<string, string>} */
const RUNNING = { installing: "install", updating: "update", uninstalling: "uninstall" };
/** @type {Record<string, [string, string]>} */
const DOING = {
  install: ["Installing", "Install"], update: ["Updating", "Update"],
  uninstall: ["Uninstalling", "Uninstall"], sign_out: ["Signing out", "Sign-out"],
};

/** The link and one-time code a device sign-in printed, or null until both came. @param {string[]} lines @param {string | null} url */
export function deviceCode(lines, url = null) {
  const text = lines.join("\n");
  const link = url || (text.match(/https:\/\/[^\s"'<>]+/) || [])[0];
  const code = (text.match(/\b[A-Z0-9]{4,}-[A-Z0-9]{4,}\b/) || [])[0];
  return link && code ? { url: link.replace(/[.,;)]+$/, ""), code } : null;
}

/** "0:08", "1:02:09". @param {number} ms */
function elapsed(ms) {
  const s = Math.max(0, Math.floor(ms / 1000)), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  const r = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${r}` : `${m}:${r}`;
}

/** @param {string} id @param {string} label @param {Partial<RowAction>} [o] @returns {RowAction} */
const act = (id, label, o = {}) => ({ id, label, ...o });
/** @param {string} key @param {[string, string]} pill @param {string} line @param {Partial<RowView>} [o] @returns {RowView} */
const view = (key, pill, line, o = {}) => ({ key, tone: "", pill, line, busy: false, next: [], menu: [], ...o });
/** @type {[string, string]} */
const SIGNING = ["Signing in", "off"];

/** @param {JobView} j */
const logAct = (j) => act("log", j.open ? "Hide log" : "Show log");

/** A sign-in under way: what to do next on the provider's page. @param {Flow} flow */
function flowView(flow) {
  const stop = act("cancel", "Cancel"), href = flow.url || "";
  if (flow.phase === "code") {
    const open = act("open", "Copy code and open sign-in page", { pri: true, href });
    return view("code", SIGNING, "Enter this code on the sign-in page.", { next: [open, stop] });
  }
  if (flow.phase === "paste" || flow.phase === "sending") {
    const open = act("open", "Open sign-in page", { pri: !flow.opened, href });
    const line = "Open the sign-in page, approve, then paste the code it shows you.";
    return view(flow.phase, SIGNING, line, { next: [open, stop] });
  }
  if (flow.phase === "link") {
    const open = act("open", "Open sign-in page", { pri: true, href });
    return view("link", SIGNING, "Open the sign-in page and approve there.", { next: [open, stop] });
  }
  return view("starting", SIGNING, "Starting the sign-in…", { busy: true, next: [stop] });
}

/** A failed job: when, why, and Try again while still offered. @param {Runtime} rt @param {JobView} j @param {number} now */
function failedView(rt, j, now) {
  const [, what] = DOING[j.action] || ["", "The last job"];
  const at = j.end ? ` at ${clockWords(new Date(j.end).toISOString(), now)}` : "";
  const why = j.lost ? " Its log was lost when the Space restarted." : j.error ? ` ${j.error}` : "";
  const next = [];
  if (j.action && rt.lifecycle?.actions.includes(j.action)) next.push(act("retry", "Try again", { pri: true }));
  if (j.log.length) next.push(logAct(j));
  const menu = menuOf(rt, [j.action]);
  return view("failed", ["Failed", "bad"], `${what} failed${at}.${why}`, { tone: "bad", next, menu });
}

/** A row's words, its next step as buttons and the rest in its menu. @param {Runtime} rt @param {RowParts} parts */
function rowView(rt, { flow = null, job = null, now = Date.now() } = {}) {
  const n = rtName(rt.name), lc = rt.lifecycle || null, h = rt.health || {};
  const offers = (/** @type {string} */ a) => !!lc && lc.actions.includes(a);
  const running = job && job.status === "running" ? job.action : (lc && RUNNING[lc.state]) || null;
  if (running) {
    const [doing] = DOING[running] || ["Working"];
    const to = running === "update" && lc && lc.update ? ` to ${lc.update}` : "";
    const time = job && job.at ? ` ${elapsed(now - job.at)}` : "";
    const next = job && job.log.length ? [logAct(job)] : [];
    return view("job", [doing, "off"], `${doing}${to}…${time}`, { busy: true, next });
  }
  if (flow) return flowView(flow);
  if (job && job.status === "failed") return failedView(rt, job, now);
  if (lc && lc.state === "failed") return failedView(rt, { action: "", status: "failed", log: [] }, now);
  const hl = healthOf(rt, now);
  const as = h.account ? ` as ${h.account}` : "";
  if (!lc) return view("legacy", [hl.word, hl.tone], h.logged_in ? `Signed in${as}.` : "");
  /** @type {[string, string]} */
  const absent = ["Not installed", "off"];
  /** @type {[string, string]} */
  const out = ["Not signed in", "warn"];
  const install = act("install", "Install", { pri: true });
  if (!lc.installed && offers("install")) return view("absent", absent, "Not installed on this Space.", { next: [install] });
  if (!lc.installed) return view("absent", absent, `Not installed. Install ${n}'s CLI on this machine; XO finds it on the next check.`);
  if (!lc.signed_in && offers("sign_in")) {
    return view("out", out, `Installed, not signed in. XO can't run ${n} until it is.`, {
      tone: "warn", next: [act("sign_in", "Sign in", { pri: true })], menu: menuOf(rt, ["sign_in"]),
    });
  }
  const term = `Installed, not signed in. ${n} signs in from a terminal on this machine only.`;
  if (!lc.signed_in) return view("out", out, term, { tone: "warn", menu: menuOf(rt, []) });
  const upd = !!lc.needs_update && offers("update");
  const update = act("update", lc.update ? `Update to ${lc.update}` : "Update", { pri: true });
  return view("in", [hl.word, hl.tone], `Signed in${as}.`, { next: upd ? [update] : [], menu: menuOf(rt, upd ? ["update"] : []) });
}

/** The ··· menu: what it offers minus what shows as buttons. @param {Runtime} rt @param {string[]} shown */
function menuOf(rt, shown) {
  const lc = rt.lifecycle;
  if (!lc) return [];
  const has = (/** @type {string} */ a) => lc.actions.includes(a) && !shown.includes(a);
  return [
    lc.installed && has("update") ? act("update", "Update") : null,
    lc.installed && has("sign_in") ? act("sign_in", lc.signed_in ? "Sign in again" : "Sign in") : null,
    lc.signed_in && has("sign_out") ? act("sign_out", "Sign out") : null,
    lc.installed && has("uninstall") ? act("uninstall", "Uninstall…", { danger: true }) : null,
  ].filter((a) => a !== null);
}

/** @param {string} name @param {RowAction} a */
function buttonHtml(name, a) {
  const cls = `btn${a.pri ? " btn-pri" : ""}`, hooks = `data-rt-act="${a.id}" data-rt="${esc(name)}"`;
  if (a.id === "open") return `<a class="${cls}" href="${esc(a.href || "")}" target="_blank" rel="noopener" ${hooks}>${esc(a.label)}</a>`;
  const expanded = a.id === "log" ? ` aria-expanded="${a.label === "Hide log"}"` : "";
  return `<button type="button" class="${cls}" ${hooks}${expanded}>${esc(a.label)}</button>`;
}

/** @param {string} name @param {RowAction[]} menu @param {boolean} open */
function moreHtml(name, menu, open) {
  if (!menu.length) return "";
  const label = esc(`More for ${rtName(name)}`), hooks = `data-rt="${esc(name)}"`;
  const item = (/** @type {RowAction} */ a) => `<button type="button" role="menuitem" data-rt-act="${a.id}" ${hooks}` +
    `${a.danger ? ' class="is-danger"' : ""}>${esc(a.label)}</button>`;
  const list = open ? `<span class="rt-menu" role="menu" tabindex="-1">${menu.map(item).join("")}</span>` : "";
  return `<span class="rt-more"><button type="button" class="btn rt-mb" data-rt-act="menu" ${hooks} aria-haspopup="menu" ` +
    `aria-expanded="${open}" aria-label="${label}" title="More">···</button>${list}</span>`;
}

/** @param {Runtime} rt @param {Remote | null} rc */
function remoteHtml(rt, rc) {
  if (!REMOTE.has(rt.name) || !rt.lifecycle?.signed_in || !rc) return "";
  const head = `<p class="rt-rc"><span class="rt-rcn">Remote control</span>`;
  if (rc.error && !rc.busy) return `${head}<span class="rt-rcs">${esc(rc.error)}</span></p>`;
  const on = !!rc.running, busy = rc.busy ? ' aria-busy="true" aria-disabled="true"' : "";
  const link = on && rc.url ? ` <a href="${esc(rc.url)}" target="_blank" rel="noopener">Open its session</a>` : "";
  const hooks = `data-rt-act="${on ? "rc_off" : "rc_on"}" data-rt="${esc(rt.name)}"`;
  return `${head}<span class="rt-rcs">${on ? "On." : "Off."}${link}</span>` +
    `<button type="button" class="btn" ${hooks}${busy}>${on ? "Stop" : "Start"}</button></p>`;
}

/** @param {string} name @param {RowView} v @param {Flow | null} flow */
function signInHtml(name, v, flow) {
  if (!flow) return "";
  const leave = `<p class="rt-note">It keeps going while you use the rest of XO. Closing or reloading this tab stops it.</p>`;
  if (v.key === "code") {
    return `<p class="rt-code"><b class="cp-code">${esc(flow.code || "")}</b>` +
      `<span class="set-note"><i class="spin" aria-hidden="true"></i> Waiting for ${esc(rtName(name))}…</span></p>${leave}`;
  }
  if (v.key !== "paste" && v.key !== "sending") return leave;
  const sending = v.key === "sending", busy = sending ? ' aria-busy="true" aria-disabled="true"' : "";
  return `<form class="rt-paste" data-rt-form="${esc(name)}" autocomplete="off">` +
    `<label class="field"><span>Code from the sign-in page</span><input name="code" required spellcheck="false" ` +
    `autocomplete="off" placeholder="Paste the code"${sending ? " readonly" : ""}></label><div class="set-fa">` +
    `<button type="submit" class="btn btn-pri"${busy}>${sending ? "Signing in…" : "Sign in"}</button></div></form>${leave}`;
}

/** One usage window's meter. @param {ReturnType<typeof windowsOf>[number]} w */
function meterHtml(w) {
  const tone = w.state === "closed" ? "bad" : w.state === "warn" || w.state === "paid" ? "warn" : "ok";
  const used = w.utilization != null ? `${Math.round(w.utilization * 100)}% used` : w.state === "warn" ? "Near limit" : "Open";
  const word = w.state === "closed" ? "At limit" : w.state === "paid" ? "Paid usage" : used;
  const reset = w.resetsAt ? `${w.state === "closed" ? "Opens" : "Resets"} ${resetWords(w.resetsAt)}` : "";
  const u = w.utilization ?? 1;
  const bar = w.utilization != null || w.state === "closed"
    ? `<span class="rt-bar" role="meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(u * 100)}" ` +
      `aria-label="${esc(w.name)}: ${esc(word)}"><i style="--u:${u}"></i></span>`
    : `<span class="rt-bar is-none"></span>`;
  return `<li class="rt-w t-${tone}"><span class="rt-wn">${esc(w.name)}</span>${bar}` +
    `<span class="rt-wu">${esc(word)}</span><span class="rt-wr">${esc(reset)}</span></li>`;
}

/** A runtime's row: state, next step, menu, sign-in or job, usage and remote control. @param {Runtime} rt @param {RowParts} o */
export function rowHtml(rt, o = {}) {
  const { flow = null, job = null, err = "", remote = null, menuOpen = false, extra = "", now = Date.now() } = o;
  const v = rowView(rt, { flow, job, now }), n = rt.name, name = rtName(n), h = rt.health || {};
  const ver = rt.lifecycle?.version || h.cli_version || rt.cli?.version || null;
  const settled = v.key === "in" || v.key === "legacy", hl = healthOf(rt, now);
  const fix = hl.fix ? ` <span class="rt-fix">${esc(hl.fix).replace(/`([^`]+)`/g, "<code>$1</code>")}</span>` : "";
  const why = settled && (hl.why || hl.fix) ? `<p class="rt-why">${esc(hl.why)}${fix}</p>` : "";
  const more = moreHtml(n, v.menu, menuOpen);
  const pill = `<span class="rt-pill t-${v.pill[1]}">${esc(v.pill[0])}</span>`;
  const acts = `<div class="rt-acts">${pill}${v.next.map((a) => buttonHtml(n, a)).join("")}${more}</div>`;
  const lines = job && job.open ? job.log.slice(-200).join("\n") : "";
  const log = lines ? `<pre class="rt-log" tabindex="0" aria-label="${esc(name)}'s log">${esc(lines)}</pre>` : "";
  const wins = settled ? windowsOf(rt) : [];
  const meters = wins.length ? `<ul class="rt-ws" aria-label="${esc(name)}'s usage">${wins.map(meterHtml).join("")}</ul>` : "";
  const spin = v.busy ? `<i class="spin" aria-hidden="true"></i> ` : "";
  const head = `${rtMark(n) || ""}<b>${esc(name)}</b>${ver ? `<span class="rt-v">${esc(ver)}</span>` : ""}` +
    `${rt.default ? `<span class="rt-v">Preferred</span>` : ""}${extra}`;
  const sub = v.line ? `<p class="rt-sub t-${v.tone || "none"}" role="status">${spin}${esc(v.line)}</p>` : "";
  const fail = err ? `<p class="set-err" role="alert">${esc(err)}</p>` : "";
  return `<li class="rt-card${v.tone === "bad" ? " is-down" : ""}" data-key="rt:${esc(n)}">` +
    `<div class="rt-top"><div class="rt-hd">${head}</div>${acts}</div>` +
    sub + why + signInHtml(n, v, flow) + log + fail + meters + remoteHtml(rt, remote) + `</li>`;
}
