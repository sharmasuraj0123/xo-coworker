// A decision card's parts, the same on every surface (the panel, the thread's dock, Home's next move): what kind of
// ask it is, its headline in words, the one line of why, the one strip of evidence, its facts as chips, its answers
// in order and its buttons. Pure: no DOM, no fetch, no HTML; each surface draws them. Every word is the item's own
// (Space's title, why, risk reasons and options) or a fixed label here; nothing is guessed about the ask.
import { itemParts, holdWords, questionsOf } from "./review.js";

// a sentence that starts with a command ("git push…", "npm install…") keeps its lowercase first word
const COMMANDS = new Set(["git", "npm", "npx", "pnpm", "yarn", "bun", "deno", "node", "python", "python3", "pip", "pip3", "uv", "rm", "mv", "cp", "ls", "cd", "cat", "curl", "wget", "docker", "kubectl", "cargo", "rustc", "sudo", "chmod", "chown", "mkdir", "touch", "sed", "awk", "grep", "ssh", "scp", "tar", "brew", "apt", "gh", "terraform"]);
/** A plain lowercase sentence capitalised; a name, a path or a command left as written. */
export const cap = (s) => { const t = String(s || "").trim(); const w = (t.match(/^[a-z]+(?= |$)/) || [])[0]; return w && !COMMANDS.has(w) ? t.charAt(0).toUpperCase() + t.slice(1) : t; };

const detailOf = (n) => (n.ask.item && n.ask.item.detail) || {};
const mcpText = (m) => (typeof m === "string" ? m : Array.isArray(m) ? m.filter(Boolean).join("/") : m ? [m.server, m.tool].filter(Boolean).join("/") : "");
// code that reads as a command rather than a word: long, or with a space, a path or a shell operator in it
const commandLike = (s) => s.length >= 16 || /[\s/|;&]/.test(s);
// Space's action kinds that are about files, named by detail.paths
const FILE_ACTS = new Set(["read", "search", "list", "edit_file", "create_file", "delete_file"]);
const filesOf = (d) => (FILE_ACTS.has(d.kind) && Array.isArray(d.paths) ? d.paths.map(String).filter(Boolean) : []);
const baseName = (p) => p.replace(/\/+$/, "").split("/").pop() || p;

/**
 * Every kind of card, with where its evidence comes from and which buttons it has. kindOf names one of these for
 * every ask; a new kind is added here or the test fails.
 *  strip: command · url · tool · diff · plan · paths · files · error · none
 *  acts:  binary (the item's yes and no) · answer (a question's own answers) · words (a reply in words) · stopped
 */
export const KINDS = {
  command: { strip: "command", acts: "binary" },
  file: { strip: "files", acts: "binary" },
  web: { strip: "url", acts: "binary" },
  tool: { strip: "tool", acts: "binary" },
  change: { strip: "diff", acts: "binary" },
  plan: { strip: "plan", acts: "binary" },
  action: { strip: "command", acts: "binary" },
  question: { strip: "none", acts: "answer" },
  secret: { strip: "none", acts: "answer" },
  create_project: { strip: "none", acts: "binary" },
  create_job: { strip: "none", acts: "binary" },
  integrity: { strip: "paths", acts: "binary" },
  usage: { strip: "none", acts: "binary" },
  suggestion: { strip: "none", acts: "binary" },
  approval: { strip: "none", acts: "binary" },
  reply: { strip: "none", acts: "words" },
  stopped: { strip: "error", acts: "stopped" },
};

/** The card's kind, from the item's own kind and what its detail carries. */
export function kindOf(n) {
  const a = n.ask;
  if (n.group === "stopped" || a.kind === "stopped") return "stopped";
  if (!a.item) {
    if (a.replyOnly) return "reply";
    if (a.kind === "question") return "question";
    return commandOf(a) ? "command" : "approval";
  }
  const it = a.item, d = it.detail || {};
  if (it.kind === "question") return questionsOf(it).some((q) => q.secret) ? "secret" : "question";
  if (it.kind === "permission" || it.kind === "approval") {
    if (d.plan) return "plan";
    if (d.diff) return "change";
    if (d.command) return "command";
    if (d.url) return "web";
    if (d.mcp) return "tool";
    if (filesOf(d).length) return "file";
    return "approval";
  }
  return it.kind in KINDS ? it.kind : "approval";
}

/**
 * The exact command an ask is about, or "": an item's detail.command; a live ask's title code (a closed `…`, or one
 * the title's clipping left open), or its "Run: …" title.
 */
export function commandOf(ask) {
  if (ask && ask.item) { const c = (ask.item.detail || {}).command; return c ? String(c).trim() : ""; }
  const title = String((ask && ask.title) || "");
  const closed = /`([^`]+)`/.exec(title);
  if (closed && commandLike(closed[1])) return closed[1].trim();
  const open = /`([^`]+)$/.exec(title);
  if (open && commandLike(open[1])) return open[1].trim();
  const run = /^run:\s*(.+)$/i.exec(title);
  return run ? run[1].trim() : "";
}

/**
 * The headline, in words, never the command itself (that is the strip under it).
 * { verb: a leading word set apart ("Run", "Stopped at") or "", text, md: the text is the server's inline markdown }
 */
export function headOf(n) {
  const a = n.ask, t = n.t || {};
  if (kindOf(n) === "stopped") {
    const step = ((t.checklist && t.checklist.items) || []).find((i) => i.state !== "done");
    return { verb: "Stopped at", text: (step && step.text) || t.title || "its last step", md: false };
  }
  const title = String(a.title || "").trim();
  if (!a.item && /^run:/i.test(title)) return { verb: "Run", text: "a command", md: false };
  const cmd = commandOf(a), files = a.item ? filesOf(a.item.detail || {}) : [];
  let text = title;
  if (files.length) text = text.replace(/`([^`]+)(`|$)/g, (m, c) => { const f = files.find((p) => p === c || (c.endsWith("…") && p.startsWith(c.slice(0, -1)))); return f ? "`" + baseName(f) + "`" : m; });
  else if (cmd) {
    text = text.replace(/`([^`]+)`/g, (m, c) => (commandLike(c) ? "a command" : m)).replace(/`[^`]+$/, (m) => (commandLike(m.slice(1)) ? "a command" : m));
    if (text === cmd) text = "";
  }
  text = text.replace(/\s+/g, " ").trim();
  if (!text) return { verb: "Run", text: "a command", md: false };
  if (!a.item && n.risk === "destructive") text = text.replace(/:\s.*$/, "");
  return { verb: "", text, md: !!(a.item || a.live) };
}

/** The one line of why under the headline: the agent's own reason, the thread's last words, or why it stopped. */
export function whyOf(n) {
  const a = n.ask, t = n.t || {};
  if (kindOf(n) === "stopped") return cap(String(t.happened || "It stopped.").replace(/^Stopped:\s*/i, ""));
  if (a.item) return cap(a.item.why || "");
  return String(a.detail || "").trim();
}

/** The first lines of a diff that change something: [{sign: "+" | "-", text}]. */
const diffLines = (diff, max) => String(diff).split("\n").filter((l) => /^[+-](?![+-]{2}\s)/.test(l)).slice(0, max).map((l) => ({ sign: l[0], text: l.slice(1) }));

/**
 * The card's one strip of evidence, or null: { type, text?, lines?, items?, more?, tag? }.
 *  command · url · tool: text (mono), with a "web" or "tool" tag · diff: its first two changed lines
 *  plan: its first lines and how many steps · paths: the changed files with their + and − · error: why it stopped
 */
export function stripOf(n) {
  const kind = kindOf(n), d = detailOf(n), t = n.t || {};
  switch (KINDS[kind].strip) {
    case "command": { const c = commandOf(n.ask); return c ? { type: "command", text: c } : null; }
    case "url": return { type: "url", text: String(d.url), tag: "web" };
    case "tool": return { type: "tool", text: mcpText(d.mcp), tag: "tool" };
    case "diff": { const lines = diffLines(d.diff, 2); return lines.length ? { type: "diff", lines } : null; }
    case "plan": {
      const all = String(d.plan).split("\n").map((l) => l.trimEnd()).filter((l) => l.trim());
      const steps = all.filter((l) => /^\s*(?:\d+[.)]|[-*+])\s/.test(l)).length;
      return { type: "plan", text: all.slice(0, 4).join("\n"), more: all.length > 4, tag: steps > 1 ? `${steps} steps` : "" };
    }
    case "paths": {
      const ch = Array.isArray(d.changes) ? d.changes : [];
      if (!ch.length) return null;
      const count = (s, c) => String(s || "").split("\n").filter((l) => l.startsWith(c) && !l.startsWith(c + c + c)).length;
      const items = ch.slice(0, 4).map((c) => ({ path: c.path || "a changed file", add: count(c.diff, "+"), del: count(c.diff, "-") }));
      return { type: "paths", items, more: Math.max(0, ch.length - items.length) + (+d.more || 0) };
    }
    case "files": { const fs = filesOf(d); return fs.length ? { type: "files", items: fs.slice(0, 4), more: fs.length - Math.min(4, fs.length) } : null; }
    case "error": { const w = String(t.error || t.happened || "").replace(/^Stopped:\s*/i, "").trim(); return w ? { type: "error", text: w } : null; }
    default: return null;
  }
}

const TONE = { destructive: "err", notable: "warn" };

/** A risk reason as one fact: its words without the path it names, and that path. */
const reasonParts = (r) => {
  const s = String(r).trim(), m = /^(.*?)\s*\(([^()]*)\)$/.exec(s);
  return m ? { text: m[1], path: m[2] } : { text: s, path: "" };
};

/**
 * The card's facts, as chips: [{ tone: "err" | "warn" | "", text, count }].
 * An item's risk_groups (a group kept before tiers were stored takes the item's own); a live ask's risk reasons, the
 * same reason for several paths counted once. Then what the kind adds: how many files, when a job runs and with what.
 */
export function chipsOf(n) {
  const it = n.ask.item, d = detailOf(n), out = [];
  const tone = TONE[n.risk] || "";
  if (it) {
    for (const g of it.risk_groups || []) out.push({ tone: g.kind == null ? tone : TONE[g.kind] || "", text: cap(g.text), count: Math.max(1, +g.count || 1) });
  } else {
    const seen = new Map();
    for (const r of n.ask.riskReasons || []) {
      const { text } = reasonParts(r), key = text.toLowerCase();
      if (seen.has(key)) seen.get(key).count++;
      else { const c = { tone, text: cap(text), count: 1 }; seen.set(key, c); out.push(c); }
    }
  }
  if (!it && n.risk === "destructive") out.push({ tone: "err", text: "Can't be undone", count: 1 });
  const kind = kindOf(n);
  if (kind === "change" && Array.isArray(d.paths) && d.paths.length) out.push({ tone: "", text: d.paths.length === 1 ? String(d.paths[0]).split("/").pop() : `${d.paths.length} files`, count: 1 });
  if (kind === "create_job") {
    if (d.schedule) out.push({ tone: "", text: String(d.schedule), count: 1 });
    const j = d.job || {};
    if (j.agent || j.model) out.push({ tone: "", text: [j.agent, j.model].filter(Boolean).join(" · "), count: 1 });
  }
  if (kind === "create_project" && d.first_task) out.push({ tone: "", text: `First task: ${d.first_task}`, count: 1 });
  if (kind === "usage" && it && it.limit && it.limit.threads && it.limit.threads.length) out.push({ tone: "", text: `${it.limit.threads.length} ${it.limit.threads.length === 1 ? "thread waits" : "threads wait"}`, count: 1 });
  return out;
}

/**
 * A question's answers in the card's order: the one the agent recommends first (only when it said why: a
 * description), the rest as it gave them. Each keeps its own index, which is what an answer sends. Nothing here is
 * selected: the card never picks for the person.
 */
export function optionsOf(q) {
  const opts = ((q && q.options) || []).map((o, index) => ({ index, label: String(o.label || ""), description: String(o.description || ""), cost: String(o.cost || ""), recommended: !!o.recommended && !!o.description }));
  const rec = opts.filter((o) => o.recommended).slice(0, 1);
  for (const o of opts) if (o.recommended && o !== rec[0]) o.recommended = false;
  return [...rec, ...opts.filter((o) => !rec.includes(o))];
}

/** The number key (1–9) for each answer in the order shown, 0 for none: the recommended one has none, no key takes it. */
export const pickKeys = (os) => { let k = 0; return os.map((o) => (o.recommended || k >= 9 ? 0 : ++k)); };

/** One plain question with answers to pick: a press on one sends it (no form, no Send). */
export const isOnePress = (n) => {
  const it = n.ask.item;
  if (!it || it.kind !== "question") return false;
  const qs = questionsOf(it);
  return qs.length === 1 && !qs[0].multi && !qs[0].secret && qs[0].options.length > 0 && !itemParts(it).hold;
};

/**
 * The card's buttons, in order: [{ act, label, role: "primary" | "secondary" | "later" }]. act is the card's
 * data-act; labels are the item's own (Allow once, Deny, Approve…) where it has them.
 * opts.canResolve: the world can resolve a thread (Done on a finished reply). opts.refused: XO won't carry a secret.
 */
export function actsOf(n, opts = {}) {
  const a = n.ask, it = a.item, kind = kindOf(n), out = [];
  const later = n.risk === "destructive" || n.effort === "think";
  if (it && kind === "secret" && opts.refused) return [{ act: "thread", label: "Open the thread", role: "primary" }];
  switch (KINDS[kind].acts) {
    case "binary": {
      if (it) {
        const P = itemParts(it);
        if (P.primary) out.push(P.hold ? { act: "hold", label: holdWords(P.primary), role: "primary" } : { act: "allow", label: P.primary.label || "Allow", role: "primary" });
        if (P.back) out.push({ act: P.back.note ? "back" : "back-now", label: P.back.label || "Send back", role: "secondary" });
      } else {
        out.push(n.risk === "destructive" ? { act: "hold", label: "Hold to allow", role: "primary" } : { act: "allow", label: "Allow", role: "primary" });
        out.push({ act: "back", label: "Send back", role: "secondary" });
      }
      break;
    }
    case "answer": {
      const P = it ? itemParts(it) : null;
      if (it && !isOnePress(n)) out.push(P.hold ? { act: "hold", label: holdWords(P.primary), role: "primary" } : { act: "submit", label: questionsOf(it).length > 1 ? "Send answers" : "Send answer", role: "primary" });
      if (!it || isOnePress(n)) out.push({ act: "reply", label: "Reply in words", role: it ? "secondary" : "primary" });
      if (!it) out.push({ act: "back", label: "Send back", role: "secondary" });
      break;
    }
    case "words": {
      out.push({ act: "reply", label: "Reply in words", role: "primary" });
      if (a.live && !a.paused && !a.pending && opts.canResolve) out.push({ act: "done", label: "Done", role: "secondary" });
      break;
    }
    case "stopped":
      out.push({ act: "retry", label: "Try again", role: "primary" }, { act: "note-reply", label: "Tell it what to try", role: "secondary" });
      break;
  }
  if (later) out.push({ act: "later", label: "Later", role: "later" });
  return out;
}

/** The dock's one line for an item that left unanswered: Space's own words (why), else a plain "No longer needed". */
export const goneLine = (g) => ({ head: g && g.state === "expired" ? "Expired" : "Withdrawn", text: cap(String((g && g.why) || "").trim()) || "No longer needed" });
