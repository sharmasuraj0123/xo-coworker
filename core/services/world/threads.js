// @ts-check

/** @typedef {Record<string, any>} Row */

/** The state a thread shows: Working while its agent works or input it holds waits behind a gate; else storm's word (an open item still wins, askingState). @param {string | null | undefined} state @param {Row | null | undefined} turn @param {boolean} [busy] @param {boolean} [held] */
export function threadState(state, turn, busy = false, held = false) {
  if (state === "needs_reply" && turn && turn.status === "running" && turn.origin === "person") return "working";
  if ((busy || held) && (state === "done" || state === "failed")) return "working";
  if (held && state === "needs_reply") return "working";
  return state || "working";
}

/** The state a thread shows while it has open items: they wait on the person, unless it was continued elsewhere or already waits. @param {string} state @param {number} openItems @param {boolean} [frozen] */
export function askingState(state, openItems, frozen = false) {
  if (!openItems || frozen || state === "needs_reply" || state === "needs_approval" || state === "paused") return state;
  return "needs_approval";
}

/** @param {string} s @param {number} n */
const clip = (s, n) => (s.length > n ? s.slice(0, n - 1).replace(/\s+\S*$/, "") + "…" : s);

/** Plain text for a title: no markdown marks, links keep their words. @param {any} md */
export function plainText(md) {
  return String(md || "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[*_`#>]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** A message split into a short title (its first sentence, at most `max`) and the rest. @param {any} md */
export function askText(md, max = 140) {
  const s = plainText(md);
  if (!s) return { title: "", rest: "" };
  const m = /^(.{12,}?[.?!:])(\s|$)/.exec(s);
  let title;
  if (m && m[1].length <= max) title = m[1].replace(/:$/, ".");
  else if (s.length <= max) title = s;
  else title = s.slice(0, max - 1).replace(/\s+\S*$/, "") + "…";
  const used = m && m[1].length <= max ? m[1].length : title.replace(/…$/, "").length;
  return { title, rest: s.slice(used).trim() };
}

/** What a thread asks of the person: its open items, one each in the queue's order; else its card's question, its loop-breaker pause, or an approval on its way. @param {Row} t @param {Row[]} [items] @returns {Row[]} */
export function stormAsks(t, items = []) {
  const asks = [];
  for (const it of items) {
    asks.push({
      id: it.id, kind: it.kind, title: it.title || "It needs your decision", detail: it.why || "",
      risk: it.risk || "notable", riskReasons: it.risk_reasons || [], options: null,
      blocking: !!it.blocking, item: it, live: true, storm: true,
    });
  }
  if (asks.length) return asks;
  if (t.state === "needs_reply") {
    const full = String((t.card && t.card.needs_you) || t.happened || "").trim();
    const { title, rest } = askText(full);
    asks.push({ id: `${t.id}:${(t.card && t.card.updated_at) || t.lastAt}`, kind: "question", title: title || "It's waiting for your reply", detail: clip(rest, 220), full, risk: "notable", options: null, replyOnly: true, live: true });
  } else if (t.state === "paused" && !t.frozen) {
    // a thread continued elsewhere is frozen, not waiting on you
    const why = String(t.paused || "it was stuck on a denied step");
    asks.push({ id: `${t.id}:paused:${t.lastAt}`, kind: "question", title: "It paused and waits for you", detail: `Why: ${why}. A reply in the thread resumes it.`, full: why, risk: "notable", options: null, replyOnly: true, live: true, paused: true });
  } else if (t.state === "needs_approval") {
    // the item hasn't reached this tab yet (or was decided elsewhere a moment ago)
    asks.push({ id: `${t.id}:approval:${t.lastAt}`, kind: "approval", title: String((t.card && t.card.needs_you) || "It needs your decision"), detail: "Open the thread to see what it needs.", risk: "notable", options: null, replyOnly: true, live: true, pending: true });
  }
  return asks;
}

/** Who stopped a thread on purpose, and why ({by: you, coordinator, workspace or null, reason}), or null when it isn't stopped on purpose. @param {string | null | undefined} activity @param {string | null | undefined} waitReason @param {Row[] | null | undefined} [controls] */
export function stopOf(activity, waitReason, controls = []) {
  if (activity !== "stopped") return null;
  const why = String(waitReason || "");
  if (/^stopped by the founder\b/i.test(why)) return { by: "you", reason: null };
  let c = null;
  for (const x of controls || []) if (x && x.action === "stop") c = x;
  const by = !c ? null : c.by === "workspace-coordinator" ? "workspace" : "coordinator";
  return { by, reason: c && c.reason ? String(c.reason).replace(/\s+/g, " ").trim() : null };
}
