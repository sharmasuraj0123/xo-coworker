// @ts-check
import { esc } from "../../js/util.js";

/** @typedef {Record<string, any>} Row @typedef {Row | null | undefined} Rt @typedef {Row | null | undefined} Policy */

/** How people say a runtime's name (shown only, never branched on); one not listed shows as the server names it. @type {Record<string, string>} */
const NAME = { claude_code: "Claude Code", codex: "Codex", antigravity: "Antigravity" };
/** The login command a runtime's CLI takes, where we know it (shown as a fix, never run). @type {Record<string, string>} */
const LOGIN = { codex: "codex login" };
/** A usage window's name as people say it. @type {Record<string, string>} */
const WINDOW = { five_hour: "5-hour window", seven_day: "Weekly window", weekly: "Weekly window", daily: "Daily window", monthly: "Monthly window" };

/** @param {string | null | undefined} name */
export const rtName = (name) => NAME[/** @type {string} */ (name)] || String(name || "The agent");

/** A runtime's mark: its company's own sign reads faster than its name in a tight row; Codex wears OpenAI's. @type {Record<string, string>} */
const MARK = { claude_code: "claude", codex: "openai", antigravity: "antigravity" };
/** @param {string} name */
export const markOf = (name) => MARK[name] || null;
/** The mark as HTML, its name on hover and for screen readers, or null; withName writes the name beside it. @param {string} name @param {{ withName?: boolean, lead?: boolean }} [o] */
export function rtMark(name, { withName = false, lead = false } = {}) {
  const m = MARK[name];
  if (!m) return null;
  const n = esc(rtName(name));
  // lead: it opens a line of words (a thread's title in a list), so it keeps the gap a mark keeps before its name
  return withName ? `<span class="agm-n"><i class="agm agm-${m}" aria-hidden="true"></i>${n}</span>` : `<i class="agm agm-${m}${lead ? " is-lead" : ""}" role="img" aria-label="${n}" title="${n}"></i>`;
}
/** @param {string} id */
export const windowName = (id) => WINDOW[id] || String(id || "").replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());

/** @param {Rt} rt @returns {Row} */
const healthOfRt = (rt) => (rt && rt.health) || {};
/** Installed means the CLI can be started: a runtime whose CLI is missing isn't installed, whatever the flag says. @param {Rt} rt */
export const isInstalled = (rt) => { const h = healthOfRt(rt); return h.installed !== false && !(h.error && h.error.code === "cli_missing"); };
/** Runtimes are worth naming only when there is more than one to tell apart. @param {Row[] | null | undefined} rts */
export const manyRuntimes = (rts) => (rts || []).filter(isInstalled).length > 1;
/** @param {Row[] | null | undefined} rts @param {string | null | undefined} name @returns {Row | null} */
export const findRt = (rts, name) => (rts || []).find((r) => r.name === name) || null;

/** "in 2 h 10 min", "in 45 min", "in 3 days", or "" when it has passed. @param {string} iso */
export function untilWords(iso, now = Date.now()) {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return "";
  const m = Math.round((ms - now) / 60000);
  if (m <= 0) return "";
  if (m < 60) return `in ${m} min`;
  const h = Math.floor(m / 60), r = m % 60;
  if (h < 24) return `in ${h} h${r ? ` ${r} min` : ""}`;
  const d = Math.round(h / 24);
  return `in ${d} day${d === 1 ? "" : "s"}`;
}
/** A reset time in the owner's own clock: "18:00" today, "Thu 18:00" this week, else "5 Nov, 18:00". @param {string} iso */
export function clockWords(iso, now = Date.now()) {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return "";
  const d = new Date(ms), t = new Date(now);
  // the app's own clock format (js/ui.js clock): one way of telling the time on every screen
  const hm = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  if (d.toDateString() === t.toDateString()) return hm;
  if (ms - now < 6 * 86400000 && ms > now) return `${d.toLocaleDateString(undefined, { weekday: "short" })} ${hm}`;
  return `${d.toLocaleDateString(undefined, { day: "numeric", month: "short" })}, ${hm}`;
}
/** "18:00, in 2 h 10 min" (or just the clock once it has passed). @param {string} iso */
export const resetWords = (iso, now = Date.now()) => [clockWords(iso, now), untilWords(iso, now)].filter(Boolean).join(", ");

/** One pill and, when it can't take work, why and what fixes it; key: usable, warn, closed, paid, logged_out, missing or down. @param {Rt} rt @returns {{ key: string, word: string, tone: "ok" | "warn" | "bad" | "off", why: string, fix: string }} */
export function healthOf(rt, now = Date.now()) {
  const h = healthOfRt(rt);
  const why = h.why_not ? String(h.why_not).replace(/^\w/, (c) => c.toUpperCase()).replace(/([^.])$/, "$1.") : "";
  // the server's sentence often names its own fix ("install it, or point … at …"): then it says enough
  const said = /install|log ?in|run /i.test(why);
  if (!isInstalled(rt)) return { key: "missing", word: "Not installed", tone: "off", why, fix: said ? "" : "Install its CLI on this machine. XO finds it on the next check." };
  if (h.logged_in === false) {
    const cmd = LOGIN[/** @type {string} */ (rt && rt.name)];
    return { key: "logged_out", word: "Not logged in", tone: "off", why, fix: cmd ? `Run \`${cmd}\` on this machine.` : said ? "" : "Log in with its CLI on this machine." };
  }
  if (h.limit === "closed") return { key: "closed", word: h.resets_at ? `At limit until ${clockWords(h.resets_at, now)}` : "At its limit", tone: "bad", why, fix: h.resets_at ? `It opens again ${untilWords(h.resets_at, now) || "soon"}.` : "" };
  if (h.limit === "paid") return { key: "paid", word: "Paid usage", tone: "warn", why, fix: "" };
  if (h.usable === false) return { key: "down", word: "Not usable", tone: "bad", why, fix: h.error && h.error.message && !why.includes(h.error.message) ? h.error.message : "" };
  if (h.limit === "warn") return { key: "warn", word: "Near limit", tone: "warn", why: "", fix: "" };
  return { key: "usable", word: "Usable", tone: "ok", why: "", fix: "" };
}
/** @param {Rt} rt */
export const usable = (rt) => !!rt && healthOfRt(rt).usable !== false && isInstalled(rt);

/** A runtime's usage windows: [{id, name, state, utilization (0–1 or null), resetsAt}], tightest first. @param {Rt} rt */
export function windowsOf(rt) {
  /** @type {Record<string, Row>} */
  const w = healthOfRt(rt).windows || {};
  /** @type {Record<string, number>} */
  const rank = { closed: 0, paid: 1, warn: 2, open: 3 };
  return Object.entries(w).map(([id, x]) => ({ id, name: windowName(id), state: (x && x.state) || "open", utilization: x && typeof x.utilization === "number" ? Math.max(0, Math.min(1, x.utilization)) : null, resetsAt: (x && x.resets_at) || null }))
    .sort((a, b) => (rank[a.state] ?? 9) - (rank[b.state] ?? 9) || (b.utilization ?? -1) - (a.utilization ?? -1));
}

/** The runtimes a policy lets work run on, by name, in the server's order. @param {Policy} policy @param {Row[] | null | undefined} rts */
export function allowedOf(policy, rts) {
  const a = policy && Array.isArray(policy.allowed) ? policy.allowed : null;
  return (rts || []).filter((r) => (a ? a.includes(r.name) : isInstalled(r))).map((r) => r.name);
}
/** The runtime a thread runs on when the coordinator doesn't choose. @param {Policy} policy @param {Row[] | null | undefined} rts @returns {string | null} */
export const defaultOf = (policy, rts) => (policy && policy.default) || ((rts || []).find((r) => r.default) || (rts || [])[0] || {}).name || null;

/** @param {string[]} names */
const list = (names) => (names.length <= 1 ? names.join("") : `${names.slice(0, -1).join(", ")} or ${names[names.length - 1]}`);
/** "Claude Code or Codex, default Claude Code, no automatic fallback" @param {Policy} policy @param {Row[] | null | undefined} rts */
export function policyWords(policy, rts) {
  const names = allowedOf(policy, rts);
  const all = !(policy && Array.isArray(policy.allowed));
  const head = names.length === 1 ? `Only ${rtName(names[0])}` : all ? `Any runtime (${list(names.map(rtName))})` : list(names.map(rtName));
  const parts = [head];
  if (names.length > 1) parts.push(`default ${rtName(defaultOf(policy, rts))}`);
  if (names.length > 1) parts.push(policy && policy.fallback ? "automatic fallback" : "no automatic fallback");
  return parts.join(", ");
}

/** Where a thread could continue: every allowed runtime, whether it can take work now and why not; its own last, for a fresh context. @param {string | null | undefined} agent @param {Policy} policy @param {Row[] | null | undefined} rts */
export function moveTargets(agent, policy, rts) {
  const names = allowedOf(policy, rts);
  const out = names.map((n) => { const rt = findRt(rts, n); const h = healthOf(rt); return { name: n, usable: usable(rt), why: usable(rt) ? "" : h.why || h.word, own: n === agent }; });
  return [...out.filter((x) => !x.own), ...out.filter((x) => x.own)];
}
/** The thread menu offers a move only when another allowed runtime can take work now. @param {string | null | undefined} agent @param {Policy} policy @param {Row[] | null | undefined} rts */
export const canMove = (agent, policy, rts) => moveTargets(agent, policy, rts).some((x) => !x.own && x.usable);

/** Field errors for a policy the server would refuse (and the server's own 400s mapped onto fields). @param {Policy} p */
export function policyErrors(p) {
  /** @type {Record<string, string>} */
  const e = {};
  if (p && Array.isArray(p.allowed) && !p.allowed.length) e.allowed = "Choose at least one runtime.";
  if (p && p.default && Array.isArray(p.allowed) && !p.allowed.includes(p.default)) e.default = "The default has to be one of the allowed runtimes.";
  if (p && p.preferences && p.preferences.length > 2000) e.preferences = "Keep it to 2,000 characters.";
  return e;
}
/** Which field a refused PUT …/runtime-policy is about (400 unknown_runtime / invalid_argument, a 422), from its message. @param {Row | null | undefined} err */
export function errorField(err) {
  if (!err) return "form";
  const m = String(err.message || "");
  if (/prefer/i.test(m)) return "preferences";
  if (/default/i.test(m)) return "default";
  if (/allow/i.test(m) || err.code === "unknown_runtime") return "allowed";
  return "form";
}

/** A usage item about a closed limit (one per pool), as opposed to the paid-usage item. @param {Row | null | undefined} it */
export const isLimitItem = (it) => !!(it && it.kind === "usage" && it.detail && it.detail.limit === "closed");
const ISO = /\b\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d(?:\.\d+)?)?(?:Z|[+-]\d\d:?\d\d)\b/g;
/** The server's sentence in the owner's terms: its times in their clock, its runtimes by their names. @param {any} text @param {Row[] | null | undefined} [rts] */
export function humanize(text, rts, now = Date.now()) {
  let s = String(text || "").replace(ISO, (iso) => clockWords(iso, now) || iso);
  for (const r of rts || []) if (r && r.name && NAME[r.name]) s = s.replace(new RegExp(`\\b${r.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "g"), NAME[r.name]);
  return s;
}
/** A limit item in the owner's words; its move kept only while a waiting thread's project allows where it would go. @param {Row} it @param {Row[] | null | undefined} rts @param {((chat: string) => Policy) | null | undefined} policyFor */
export function limitItem(it, rts, policyFor, now = Date.now()) {
  const d = it.detail || {};
  const to = d.move_to || null;
  const threads = (d.threads || []).map((/** @type {Row} */ x) => {
    const p = policyFor ? policyFor(x.chat_id) : null;
    const stays = !!(to && p && Array.isArray(p.allowed) && !p.allowed.includes(to));
    return { ...x, stays };
  });
  const canMove = !!to && threads.some((/** @type {Row} */ x) => !x.stays);
  const options = (it.options || []).filter((/** @type {Row} */ o) => o.decision !== "move" || canMove).map((/** @type {Row} */ o) => ({ ...o, label: humanize(o.label, rts, now) }));
  return { ...it, title: humanize(it.title, rts, now), why: humanize(it.why, rts, now), options, limit: { resetsAt: d.resets_at || null, moveTo: to, threads, canMove } };
}
