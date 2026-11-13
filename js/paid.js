// Paid usage (Settings › Runtimes): what the founder chose for the Space and for each agent account, and what
// each account's facts say. Pure: no DOM, no fetch.
//
// The three modes are the founder's, kept by XO (POST /api/chat/intent/paid), never decided here:
//   never   work stops before any paid usage, and when XO can't tell whether it would be paid (the default)
//   ask     work stops before paid usage and asks; it goes on only after the founder allows it, until that window resets
//   always  work goes on into paid usage without asking
// An account follows the Space unless it has a mode of its own. What an account is (its plan, whether it can go
// on to paid usage, its credits) is the Space advisory's: facts with a source and an age, each `known` or not.
// What it is doing now (open, held for a question, on paid usage) is its pool in GET /api/chat/status.
//
// The wire is read in this one place: a field renamed on the server changes here and nowhere else.

import { humanize } from "./runtimes.js";

export const MODES = ["never", "ask", "always"];
export const MODE_NAME = { never: "Never", ask: "Ask me", always: "Always allow" };
export const MODE_SUB = {
  never: "Work stops before any paid usage, and when XO can’t tell whether it would be paid.",
  ask: "Work stops before paid usage and asks you; it goes on only after you allow it, until that window resets.",
  always: "Work goes on into paid usage without asking.",
};
/** The mode when nothing is chosen anywhere: no paid usage. */
export const DEFAULT_MODE = "never";

const AGENT = { claude_code: "Claude Code", codex: "Codex", agy: "Antigravity" };
const agentName = (a) => AGENT[a] || String(a || "").replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());

/** A fact's value when it is known (not stale, not unseen), else null. */
export const known = (f) => (f && f.known ? f.value ?? null : null);

/** A pool's id, as XO makes it from the advisory's agent and account label (pool_id): "<agent>:<account>". */
export const poolId = (agent, account) => `${agent}:${account || "default"}`;

const lapsed = (it, now) => { if (!it.until) return false; const t = Date.parse(it.until); return Number.isFinite(t) && t <= now; };

/**
 * The paid modes that hold now, from GET /api/chat/intent's rows: {space: mode|null, pools: {poolId: mode}}.
 * A mode whose `until` has passed no longer holds. An unknown value is ignored (never guessed at).
 */
export function heldModes(rows, now = Date.now()) {
  const out = { space: null, pools: {} };
  for (const it of rows || []) {
    if (!it || it.key !== "paid" || !MODES.includes(it.value) || lapsed(it, now)) continue;
    if (it.scope === "space") out.space = it.value;
    else if (it.scope === "pool" && it.scope_id) out.pools[it.scope_id] = it.value;
  }
  return out;
}

/** The mode an account runs under and where it comes from: its own, else the Space's, else the default. */
export function effectiveMode(held, pool) {
  const own = held && held.pools && held.pools[pool];
  if (own) return { mode: own, source: "pool" };
  if (held && held.space) return { mode: held.space, source: "space" };
  return { mode: DEFAULT_MODE, source: "default" };
}

const REASON = {
  org_level_disabled: "Paid usage is turned off for your organisation.",
  out_of_credits: "It has no credits left.",
  no_credits: "It has no credits left.",
};
const reasonWords = (r) => REASON[r] || (r ? `${String(r).replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase())}.` : "");

/** What a pool is doing now, in words (its `reason` from the status), or "". */
export function poolWords(pool) {
  if (!pool) return "";
  switch (pool.reason) {
    case "paid_asked": return "Waiting for your answer before it goes on to paid usage.";
    case "paid_threshold": return "Held before paid usage.";
    case "paid_unknown": return "Held: XO can’t tell whether its next use would be paid.";
    case "paid_in_use": return "Held: it is already on paid usage.";
    default: return "";
  }
}

const planWords = (p) => (p ? String(p).replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase()) : "");
/** "7,188 credits" (a balance is shown whole: the cents are noise). */
export const creditsWords = (n) => (typeof n === "number" && Number.isFinite(n) ? `${Math.round(n).toLocaleString("en-US")} credit${Math.round(n) === 1 ? "" : "s"}` : "");

/**
 * One row per agent account, from the advisory: [{pool, agent, name, account, plan, possible (true|false|null),
 * inUse (true|false|null), credits (number|null), why, own (this account's mode or null), mode, source, state, note}].
 * served: GET /api/chat/intent's pools, XO's own word on each account's effective mode (and source), its state and why;
 * where it has none for an account, the mode is worked out from the modes that hold (the same rule). pools: GET
 * /api/chat/status pools, by id, for the state when XO gave none. State "paid" is a hold, never spending: only the
 * advisory's in_use says an account is on paid usage.
 */
export function accountRows({ advisory, held, pools, served }) {
  const byId = pools || {};
  const sv = new Map((served || []).filter((x) => x && x.pool).map((x) => [x.pool, x]));
  return ((advisory && advisory.accounts) || []).filter((a) => a && a.agent).map((a) => {
    const pool = poolId(a.agent, a.account);
    const paid = a.paid || {};
    const possible = known(paid.possible);
    const sp = sv.get(pool) || null;
    const st = sp ? { state: sp.state, reason: sp.reason } : byId[pool] || null;
    const eff = sp && MODES.includes(sp.mode) ? { mode: sp.mode, source: sp.source || "default" } : effectiveMode(held, pool);
    return {
      pool, agent: a.agent, name: agentName(a.agent), account: a.account || "",
      plan: planWords(known(a.plan)),
      possible: possible === null ? null : !!possible,
      inUse: known(paid.in_use) === null ? null : !!known(paid.in_use),
      credits: known(paid.credits),
      why: possible === false ? reasonWords(known(paid.disabled_reason)) : "",
      own: (held && held.pools && held.pools[pool]) || null,
      ...eff,
      state: st ? st.state : null,
      note: poolWords(st),
    };
  });
}

/** Is any account of this runtime on paid usage now? (the informational badge on its card) */
export const onPaid = (rows, runtime) => (rows || []).some((r) => r.agent === runtime && r.inUse === true);

/** The request for a choice: the Space's mode, or an account's (value null: it follows the Space again). */
export function paidBody(scope, id, value) {
  if (scope === "space") {
    if (!MODES.includes(value)) throw new Error("The Space’s paid usage is never, ask or always.");
    return { scope: "space", scope_id: "", value };
  }
  if (!id) throw new Error("An account’s paid usage needs the account.");
  if (value !== null && !MODES.includes(value)) throw new Error("An account’s paid usage is never, ask, always, or the Space’s.");
  return { scope: "pool", scope_id: id, value };
}

/**
 * A paid-usage question (a usage item that isn't a closed limit), ready to show, from the item's own detail
 * ({pool, agent, resets_at, cause: paid_threshold | paid_in_use | paid_unknown, used (0 to 1 or null), credits, login:
 * subscription | api_key}): which account it is about, when its window resets, its credits, and how far Continue
 * reaches. The question's own words and options stay the server's. rows: the account rows, for the plan.
 */
export function paidItem(item, rows) {
  const d = (item && item.detail) || {};
  if (!item || item.kind !== "usage" || d.limit === "closed" || !d.pool) return item;
  const r = (rows || []).find((x) => x.pool === d.pool);
  const apiKey = d.login === "api_key";
  const name = d.agent ? agentName(d.agent) : r ? r.name : "";
  // the server's sentence in the owner's terms: its times in their clock
  return { ...item, title: humanize(item.title), paid: {
    account: name ? `${name}${r && r.plan ? ` · ${r.plan}` : ""}${apiKey ? " · API key" : ""}` : "",
    resetsAt: d.resets_at || null,
    credits: typeof d.credits === "number" ? d.credits : null,
    used: typeof d.used === "number" ? d.used : null,
    apiKey,
    cause: d.cause || null,
    // Continue goes on paying only for this stretch, and the mode stays Ask me: asked again after it
    reach: apiKey ? "Continue pays for the next 24 hours, then asks again." : d.resets_at ? "Continue pays until the window resets, then asks again." : "Continue pays for now, then asks again.",
  } };
}
