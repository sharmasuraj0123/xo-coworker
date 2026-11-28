// @ts-check
import { esc } from "../platform/util.js";
import { clockWords, untilWords } from "../platform/time.js";
export { clockWords, untilWords };

/** @import {Runtime as Row, RuntimePolicy, RuntimeError, UsageItem, RuntimeHealth, SessionThread, SessionsState} from "./runtime-types" */

/** @import { RuntimeModel } from "../platform/runtime-response-types" */

/** @typedef {Row | null | undefined} Rt @typedef {RuntimePolicy | null | undefined} Policy */

/** How people say a runtime's name (shown only, never branched on); one not listed shows as the server names it. @type {Record<string, string>} */
const NAME = { claude_code: "Claude Code", codex: "Codex", antigravity: "Antigravity", cursor: "Cursor", grok_build: "Grok Build" };
/** The login command a runtime's CLI takes, where we know it (shown as a fix, never run). @type {Record<string, string>} */
const LOGIN = { codex: "codex login" };
/** A usage window's name as people say it. @type {Record<string, string>} */
const WINDOW = { five_hour: "5-hour window", seven_day: "Weekly window", weekly: "Weekly window", daily: "Daily window", monthly: "Monthly window" };

/** @param {string | null | undefined} name */
export const rtName = (name) => NAME[/** @type {string} */ (name)] || String(name || "The agent");

/** @type {Record<string, string>} */
const MARK = { claude_code: "claude", codex: "openai", antigravity: "antigravity", cursor: "cursor", grok_build: "grok" };
/** The mark's own name, for a list that draws it ("claude"), or "". @param {string | null | undefined} name */
export const rtMarkName = (name) => (name && MARK[name]) || "";
/** The mark as HTML, its name on hover and for screen readers, or null; withName writes the name beside it. @param {string} name @param {{ withName?: boolean, lead?: boolean }} [o] */
export function rtMark(name, { withName = false, lead = false } = {}) {
  const m = MARK[name];
  if (!m) return null;
  const n = esc(rtName(name));
  return withName ? `<span class="agm-n"><i class="agm agm-${m}" aria-hidden="true"></i>${n}</span>` : `<i class="agm agm-${m}${lead ? " is-lead" : ""}" role="img" aria-label="${n}" title="${n}"></i>`;
}
/** The sessions a runtime action would stop, by thread title and project. @param {unknown} sessions @param {SessionsState} st */
export function sessionThreads(sessions, st) {
  const ids = Array.isArray(sessions) ? sessions.filter((s) => typeof s === "string") : [];
  const projects = st.projects || [];
  return ids.map((s) => {
    const t = st.threads.find((x) => x.sessionId === s);
    const where = t && (projects.find((p) => p.id === t.project)?.name || t.project);
    if (t) return /** @type {SessionThread} */ ({ id: s, title: t.title, where: where || "", go: `t:${t.id}` });
    const p = projects.find((x) => x.sessionId === s);
    if (p) return { id: s, title: `${p.name}'s coordinator`, where: "", go: `p:${p.id}` };
    return { id: s, title: "A session XO doesn't list", where: s.slice(0, 8), go: null };
  });
}
/** One model per family, without the catalog's "default" stand-in. @template {RuntimeModel} M @param {readonly M[]} models */
export const offeredModels = (models) => models.filter((m) => !m.is_default && (m.family_default || !m.family));
/** How people say a thinking effort. @type {Record<string, string>} */
export const EFFORT_WORD = { low: "Quick", medium: "Balanced", high: "Deep", xhigh: "Deeper", max: "Deepest" };
/** A model id as people read it: "gpt-6.1-terra" is "GPT-6.1 Terra" (shown only). @param {string | null | undefined} id */
export function modelWord(id) {
  const parts = String(id || "").trim().replace(/^claude-/i, "").split(/[-_\s]+/).filter((p) => p && !/^\d{8}$/.test(p));
  /** @type {string[]} */
  const out = [];
  for (const p of parts) {
    const last = out[out.length - 1];
    if (/^\d+(\.\d+)*$/.test(p) && last && /^GPT$/.test(last)) out[out.length - 1] = `${last}-${p}`;
    else if (/^\d+(\.\d+)*$/.test(p) && last && /\d$/.test(last)) out[out.length - 1] = `${last}.${p}`;
    else out.push(/^gpt$/i.test(p) ? "GPT" : /^\d/.test(p) ? p : p.charAt(0).toUpperCase() + p.slice(1));
  }
  return out.join(" ");
}
/** @param {string} id */
export const windowName =(id) => WINDOW[id] || String(id || "").replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());

/** @param {Rt} rt @returns {RuntimeHealth} */
const healthOfRt = (rt) => (rt && rt.health) || {};
/** Installed means the CLI can be started: a runtime whose CLI is missing isn't installed, whatever the flag says. @param {Rt} rt */
export const isInstalled = (rt) => { const h = healthOfRt(rt); return h.installed !== false && !(h.error && h.error.code === "cli_missing"); };
/** Runtimes are worth naming only when there is more than one to tell apart. @param {Row[] | null | undefined} rts */
export const manyRuntimes = (rts) => (rts || []).filter(isInstalled).length > 1;
/** @param {Row[] | null | undefined} rts @param {string | null | undefined} name @returns {Row | null} */
export const findRt = (rts, name) => (rts || []).find((r) => r.name === name) || null;

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
/** @import {LivePools} from "./runtime-types" */
const ADMITTING = new Set(["open", "warn"]);
/** Its health with the live pool's limit and windows. @template {Row} R @param {R} rt @param {LivePools} pools @returns {R} */
function withPool(rt, pools) {
  const h = rt && rt.health, p = h && h.pool ? pools[h.pool] : null;
  if (!h || !p || !p.state) return rt;
  const windows = p.windows || h.windows;
  const same = h.limit === p.state && (h.resets_at ?? null) === (p.resets_at ?? null);
  if (same && JSON.stringify(windows) === JSON.stringify(h.windows)) return rt;
  const admits = ADMITTING.has(p.state), works = h.installed !== false && h.logged_in !== false && !h.error;
  const why = admits ? null : `its usage limit is ${p.state}${p.resets_at ? ` until ${p.resets_at}` : ""}`;
  const gate = works ? { usable: admits, why_not: why } : {};
  return { ...rt, health: { ...h, limit: p.state, resets_at: p.resets_at ?? null, windows, ...gate } };
}
/** The same array when no runtime's limit differs. @template {Row} R @param {R[]} rts @param {LivePools} pools */
export function withPools(rts, pools) {
  const out = rts.map((r) => withPool(r, pools));
  return out.every((r, i) => r === rts[i]) ? rts : out;
}
/** @param {Rt} rt */
export const usable = (rt) => !!rt && healthOfRt(rt).usable !== false && isInstalled(rt);

/** A runtime's usage windows: [{id, name, state, utilization (0–1 or null), resetsAt}], tightest first. @param {Rt} rt */
export function windowsOf(rt) {
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
export const defaultOf = (policy, rts) => policy?.default || ((rts || []).find((r) => r.default) || rts?.[0])?.name || null;

/** @param {string[]} names */
const list = (names) => (names.length <= 1 ? names.join("") : `${names.slice(0, -1).join(", ")} or ${names[names.length - 1]}`);
/** @param {Policy} policy @param {Row[] | null | undefined} rts */
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
/** @param {RuntimeError | null | undefined} err */
export function errorField(err) {
  if (!err) return "form";
  const m = String(err.message || "");
  if (/prefer/i.test(m)) return "preferences";
  if (/default/i.test(m)) return "default";
  if (/allow/i.test(m) || err.code === "unknown_runtime") return "allowed";
  return "form";
}

/** @param {UsageItem | null | undefined} it */
export const isLimitItem = (it) => !!(it && it.kind === "usage" && it.detail && it.detail.limit === "closed");
const ISO = /\b\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d(?:\.\d+)?)?(?:Z|[+-]\d\d:?\d\d)\b/g;
/** @param {unknown} text @param {Row[] | null | undefined} [rts] */
export function humanize(text, rts, now = Date.now()) {
  let s = String(text || "").replace(ISO, (iso) => clockWords(iso, now) || iso);
  for (const r of rts || []) if (r && r.name && NAME[r.name]) s = s.replace(new RegExp(`\\b${r.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "g"), NAME[r.name]);
  return s;
}
/** @template {UsageItem} T @param {T} it @param {Row[] | null | undefined} rts @param {((chat: string) => Policy) | null | undefined} policyFor */
export function limitItem(it, rts, policyFor, now = Date.now()) {
  const d = it.detail || {};
  const to = d.move_to || null;
  const threads = (d.threads || []).map((x) => {
    const p = policyFor ? policyFor(x.chat_id) : null;
    const stays = !!(to && p && Array.isArray(p.allowed) && !p.allowed.includes(to));
    return { ...x, stays };
  });
  const canMove = !!to && threads.some((x) => !x.stays);
  const options = (it.options || []).filter((o) => o.decision !== "move" || canMove).map((o) => ({ ...o, label: humanize(o.label, rts, now) }));
  return { ...it, title: humanize(it.title, rts, now), why: humanize(it.why, rts, now), options, limit: { resetsAt: d.resets_at || null, moveTo: to, threads, canMove } };
}
