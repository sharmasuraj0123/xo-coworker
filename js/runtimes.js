// Runtimes, the pure part: what a runtime is called, how healthy it is, what a runtime policy
// allows, and the words for both. No DOM and no fetches here, so it is tested from Node.
//
// The backend is the source of truth (xo-space's mixed-runtime handoff, §1.6): every runtime, its
// health, the policy and the `why_not` sentences come from the API. Names are only ever *shown*
// through the display map below; no logic branches on a runtime's name.

/** How people say a runtime's name. Anything not listed shows as the server names it. */
const NAME = { claude_code: "Claude Code", codex: "Codex", antigravity: "Antigravity" };
/** The login command a runtime's CLI takes, where we know it (shown as a fix, never run). */
const LOGIN = { codex: "codex login" };
/** A usage window's name as people say it. */
const WINDOW = { five_hour: "5-hour window", seven_day: "Weekly window", weekly: "Weekly window", daily: "Daily window", monthly: "Monthly window" };

export const rtName = (name) => NAME[name] || String(name || "The agent");
export const windowName = (id) => WINDOW[id] || String(id || "").replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());

const healthOfRt = (rt) => (rt && rt.health) || {};
/** Installed means the CLI can be started: a runtime whose CLI is missing isn't installed, whatever the flag says. */
export const isInstalled = (rt) => { const h = healthOfRt(rt); return h.installed !== false && !(h.error && h.error.code === "cli_missing"); };
/** Runtimes are worth naming only when there is more than one to tell apart (F1). */
export const manyRuntimes = (rts) => (rts || []).filter(isInstalled).length > 1;
export const findRt = (rts, name) => (rts || []).find((r) => r.name === name) || null;

const pad = (n) => String(n).padStart(2, "0");
/** "in 2 h 10 min", "in 45 min", "in 3 days", or "" when it has passed. */
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
/** A reset time in the owner's own clock: "18:00" today, "Thu 18:00" this week, else "5 Nov, 18:00". */
export function clockWords(iso, now = Date.now()) {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return "";
  const d = new Date(ms), t = new Date(now);
  const hm = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  if (d.toDateString() === t.toDateString()) return hm;
  if (ms - now < 6 * 86400000 && ms > now) return `${d.toLocaleDateString(undefined, { weekday: "short" })} ${hm}`;
  return `${d.toLocaleDateString(undefined, { day: "numeric", month: "short" })}, ${hm}`;
}
/** "18:00, in 2 h 10 min" (or just the clock once it has passed). */
export const resetWords = (iso, now = Date.now()) => [clockWords(iso, now), untilWords(iso, now)].filter(Boolean).join(", ");

/**
 * A runtime's health as one pill and, when it can't take work, why and what fixes it.
 * → {key, word, tone: "ok" | "warn" | "bad" | "off", why, fix}
 *   key: usable | warn | closed | paid | logged_out | missing | down
 */
export function healthOf(rt, now = Date.now()) {
  const h = healthOfRt(rt);
  const why = h.why_not ? String(h.why_not).replace(/^\w/, (c) => c.toUpperCase()).replace(/([^.])$/, "$1.") : "";
  if (!isInstalled(rt)) return { key: "missing", word: "Not installed", tone: "off", why, fix: "Install its CLI on this machine. XO finds it on the next check." };
  if (h.logged_in === false) {
    const cmd = LOGIN[rt && rt.name];
    return { key: "logged_out", word: "Not logged in", tone: "off", why, fix: cmd ? `Run \`${cmd}\` on this machine.` : "Log in with its CLI on this machine." };
  }
  if (h.limit === "closed") return { key: "closed", word: h.resets_at ? `At limit until ${clockWords(h.resets_at, now)}` : "At its limit", tone: "bad", why, fix: h.resets_at ? `It opens again ${untilWords(h.resets_at, now) || "soon"}.` : "" };
  if (h.limit === "paid") return { key: "paid", word: "Paid usage", tone: "warn", why, fix: "" };
  if (h.usable === false) return { key: "down", word: "Not usable", tone: "bad", why, fix: h.error && h.error.message && !why.includes(h.error.message) ? h.error.message : "" };
  if (h.limit === "warn") return { key: "warn", word: "Near limit", tone: "warn", why: "", fix: "" };
  return { key: "usable", word: "Usable", tone: "ok", why: "", fix: "" };
}
export const usable = (rt) => !!rt && healthOfRt(rt).usable !== false && isInstalled(rt);

/** A runtime's usage windows: [{id, name, state, utilization (0–1 or null), resetsAt}], tightest first. */
export function windowsOf(rt) {
  const w = healthOfRt(rt).windows || {};
  const rank = { closed: 0, paid: 1, warn: 2, open: 3 };
  return Object.entries(w).map(([id, x]) => ({ id, name: windowName(id), state: (x && x.state) || "open", utilization: x && typeof x.utilization === "number" ? Math.max(0, Math.min(1, x.utilization)) : null, resetsAt: (x && x.resets_at) || null }))
    .sort((a, b) => (rank[a.state] ?? 9) - (rank[b.state] ?? 9) || (b.utilization ?? -1) - (a.utilization ?? -1));
}

// ── the runtime policy (§2.2) ───────────────────────────────────────────────
/** The runtimes a policy lets work run on, by name, in the server's order. */
export function allowedOf(policy, rts) {
  const a = policy && Array.isArray(policy.allowed) ? policy.allowed : null;
  return (rts || []).filter((r) => (a ? a.includes(r.name) : isInstalled(r))).map((r) => r.name);
}
/** The runtime a thread runs on when the coordinator doesn't choose. */
export const defaultOf = (policy, rts) => (policy && policy.default) || ((rts || []).find((r) => r.default) || (rts || [])[0] || {}).name || null;

const list = (names) => (names.length <= 1 ? names.join("") : `${names.slice(0, -1).join(", ")} or ${names[names.length - 1]}`);
/** "Claude Code or Codex, default Claude Code, no automatic fallback" */
export function policyWords(policy, rts) {
  const names = allowedOf(policy, rts);
  const all = !(policy && Array.isArray(policy.allowed));
  const head = names.length === 1 ? `Only ${rtName(names[0])}` : all ? `Any runtime (${list(names.map(rtName))})` : list(names.map(rtName));
  const parts = [head];
  if (names.length > 1) parts.push(`default ${rtName(defaultOf(policy, rts))}`);
  if (names.length > 1) parts.push(policy && policy.fallback ? "automatic fallback" : "no automatic fallback");
  return parts.join(", ");
}

/**
 * Where a thread could continue (F4): every allowed runtime but its own, each with whether it can
 * take work now and why not. Its own runtime comes last, for a fresh context.
 * → [{name, usable, why, own}]
 */
export function moveTargets(agent, policy, rts) {
  const names = allowedOf(policy, rts);
  const out = names.map((n) => { const rt = findRt(rts, n); const h = healthOf(rt); return { name: n, usable: usable(rt), why: usable(rt) ? "" : h.why || h.word, own: n === agent }; });
  return [...out.filter((x) => !x.own), ...out.filter((x) => x.own)];
}
/** The thread menu offers a move only when another allowed runtime can take work now. */
export const canMove = (agent, policy, rts) => moveTargets(agent, policy, rts).some((x) => !x.own && x.usable);

/** Field errors for a policy the server would refuse (and the server's own 400s mapped onto fields). */
export function policyErrors(p) {
  const e = {};
  if (p && Array.isArray(p.allowed) && !p.allowed.length) e.allowed = "Choose at least one runtime.";
  if (p && p.default && Array.isArray(p.allowed) && !p.allowed.includes(p.default)) e.default = "The default has to be one of the allowed runtimes.";
  if (p && p.preferences && p.preferences.length > 2000) e.preferences = "Keep it to 2,000 characters.";
  return e;
}
/** Which field a refused PUT …/runtime-policy is about (400 unknown_runtime / invalid_argument, a 422), from its message. */
export function errorField(err) {
  if (!err) return "form";
  const m = String(err.message || "");
  if (/prefer/i.test(m)) return "preferences";
  if (/default/i.test(m)) return "default";
  if (/allow/i.test(m) || err.code === "unknown_runtime") return "allowed";
  return "form";
}
