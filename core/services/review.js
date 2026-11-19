// @ts-check

// Storm's review items as a decision card places them: the main yes, the no, the wider allows, the hold, the request body.

/** @type {Set<string>} */
const YES = new Set(["allow", "approve", "done", "continue", "answer", "move"]);
/** @type {Set<string>} */
const NO = new Set(["deny", "send_back", "cant", "wait"]);

/** @type {Record<string, string>} */
export const VERB = { allow: "Allowed", deny: "Denied", answer: "Answered", approve: "Approved", send_back: "Sent back", done: "Done", cant: "Can't do it", continue: "Continued", wait: "Waiting", move: "Moving" };

/** @param {any} item */
export function itemParts(item) {
  const opts = Array.isArray(item && item.options) ? item.options : [];
  const scopes = opts.filter((/** @type {any} */ o) => o.decision === "allow" && (o.scope === "thread" || o.scope === "rule"));
  const primary = opts.find((/** @type {any} */ o) => YES.has(o.decision) && !scopes.includes(o)) || null;
  const back = opts.find((/** @type {any} */ o) => NO.has(o.decision)) || null;
  const hold = !!(primary && (primary.hold_to_confirm || (item.risk === "destructive" && YES.has(primary.decision))));
  return { primary, back, scopes, hold, why: (primary && primary.why) || null };
}

/** @param {any} primary */
export function holdWords(primary) {
  const d = primary && primary.decision;
  /** @type {Record<string, string>} */
  const fixed = { allow: "Hold to allow", approve: "Hold to approve", done: "Hold to confirm", continue: "Hold to continue", answer: "Hold to answer" };
  if (fixed[d] && (d !== "approve" || !primary.label || /^approve$/i.test(primary.label))) return fixed[d];
  return `Hold to ${String((primary && primary.label) || "confirm").replace(/^\w/, (c) => c.toLowerCase())}`;
}

/** @param {any} item */
export function questionsOf(item) {
  const q = item && item.detail && Array.isArray(item.detail.questions) ? item.detail.questions : [];
  return q.map((/** @type {any} */ x, /** @type {number} */ i) => ({ id: x.id || String(i), header: x.header || "", question: x.question || item.title || "", options: Array.isArray(x.options) ? x.options : [], multi: !!x.multi, secret: !!x.secret }));
}

/** @param {any} item @param {any} choice @param {string} [note] @returns {Record<string, any>} */
export function itemBody(item, choice, note = "") {
  const { primary, back, scopes } = itemParts(item);
  note = String(note || "").trim();
  if (choice === "deny" || (choice && choice.no)) {
    if (!back) throw new Error("This item has no way to say no.");
    /** @type {Record<string, any>} */
    const body = { decision: back.decision };
    if (note && back.note) body.note = note.slice(0, 4000);
    return body;
  }
  if (choice && choice.scope) {
    const o = scopes.find((/** @type {any} */ x) => x.id === choice.scope.id);
    if (!o) throw new Error("That choice isn't offered for this item.");
    if (o.scope === "thread") return { decision: "allow", scope: "thread" };
    return { decision: "allow", option: o.id, rule_sentence: o.sentence };
  }
  if (item.kind === "question") {
    if (choice && choice.answers) return { decision: "answer", answer: choice.answers };
    if (choice && choice.option != null) return { decision: "answer", option: String(choice.option).slice(0, 200) };
    if (choice && choice.text != null) return { decision: "answer", answer: String(choice.text) };
    throw new Error("Pick an answer or reply in words.");
  }
  if (item.kind === "create_project" && choice && choice.name != null) {
    const name = String(choice.name).trim();
    return name ? { decision: "allow", answer: name } : { decision: "allow" };
  }
  if (choice !== "allow") throw new Error("This one is answered with its buttons, not in words.");
  if (!primary) throw new Error("This item has no answer to give.");
  return { decision: primary.decision };
}

/** @param {any} body */
export const isNo = (body) => NO.has(body && body.decision);

/** @param {any} item */
export function itemEffort(item) {
  if (item.risk === "destructive") return "think";
  if (item.kind === "integrity" || item.kind === "usage" || item.kind === "suggestion") return "glance";
  if (item.kind === "action") return "think";
  if (item.kind === "permission") return item.risk === "routine" ? "glance" : "decide";
  if (item.kind === "approval" && item.detail && item.detail.plan) return "think";
  return "decide";
}

/** @param {any} item */
export const fromWords = (item) => (item && (item.origin === "xo" || item.origin === "engine") ? "From XO" : "From the agent");

/** @param {any} item */
export function evidenceOf(item) {
  const d = (item && item.detail) || {};
  /** @type {{ label: string, lang: string, text: string }[]} */
  const blocks = [];
  /** @type {string[]} */
  const facts = [];
  if (d.command) blocks.push({ label: "Command", lang: "sh", text: String(d.command) });
  if (d.diff) blocks.push({ label: "Change", lang: "diff", text: String(d.diff) });
  if (Array.isArray(d.paths) && d.paths.length) blocks.push({ label: d.paths.length === 1 ? "File" : "Files", lang: "txt", text: d.paths.join("\n") });
  if (d.url) blocks.push({ label: "Address", lang: "txt", text: String(d.url) });
  if (d.mcp) blocks.push({ label: "Tool", lang: "txt", text: typeof d.mcp === "string" ? d.mcp : `${d.mcp.server || ""}/${d.mcp.tool || ""}` });
  if (d.plan) blocks.push({ label: "The plan", lang: "md", text: String(d.plan) });
  if (d.text) blocks.push({ label: fromWords(item), lang: "md", text: String(d.text) });
  if (item.kind === "create_project") {
    if (d.purpose) facts.push(`For: ${d.purpose}`);
    if (d.why_new) facts.push(`Why a new project: ${d.why_new}`);
    if (d.first_task) facts.push(`First task: ${d.first_task}`);
    if (d.suggestion && d.suggestion.forward_to) facts.push(`Or send it to ${d.suggestion.forward_to} instead`);
  }
  if (item.kind === "create_job") {
    if (d.schedule) facts.push(`When: ${d.schedule}`);
    if (d.project) facts.push(`In: ${d.project}`);
    const j = d.job || {};
    if (j.agent || j.model || j.effort) facts.push(`With: ${[j.agent, j.model, j.effort].filter(Boolean).join(" · ")}`);
    if (j.prompt || d.text) blocks.push({ label: "What it will do each time", lang: "md", text: String(j.prompt || d.text) });
  }
  if (item.kind === "integrity") {
    if (d.failed) facts.push(`The check couldn't run: ${d.reason || "unknown reason"}`);
    for (const c of (d.changes || []).slice(0, 20)) blocks.push({ label: c.path || "changed file", lang: "diff", text: String(c.diff || c.summary || c.change || "") });
    if (d.more) facts.push(`${d.more} more changed`);
  }
  if (item.kind === "usage" && d.resets_at) facts.push(`Your plan resets at ${d.resets_at}`);
  if (item.risk_reasons && item.risk_reasons.length) facts.push(...item.risk_reasons.map((/** @type {string} */ r) => r.charAt(0).toUpperCase() + r.slice(1)));
  if (item.parked) facts.push("Parked: the agent was told to wait; an answer wakes it");
  return { blocks, facts };
}

/** @param {any} item */
export function hostOf(item) {
  if (item.thread_ts) return null;
  if (item.kind === "usage") return { id: `pool:${(item.detail && item.detail.pool) || "account"}`, chat: null, title: "Your agent account" };
  if (item.chat_id) return { id: `chat:${item.chat_id}`, chat: item.chat_id, title: null };
  if (item.session_id) return { id: `session:${item.session_id}`, chat: null, session: item.session_id, title: "A plain chat" };
  return { id: `item:${item.id}`, chat: null, title: "XO" };
}

/** @param {any} item @param {any} [session] */
export function askedBy(item, session) {
  if (!item || (item.origin !== "cli" && item.origin !== "agent")) return null;
  return !session || !session.role || /coordinator/.test(session.role) ? "coordinator" : null;
}
