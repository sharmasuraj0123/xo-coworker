// How one storm turn reads in a conversation: the server's blocks (ch 09 §2), rendered in place.
// The server builds every header and row line; this only lays them out. Work folds by default:
// a finished thinking block is one line ("Thought for 32s"), an activity group is its header
// ("Created 2 files, ran a command"); open either to see the steps. The running row and growing
// file sizes show live. Colour follows the system: blue = working, amber = waiting on you,
// red = failed, everything else neutral ink.

import { esc } from "./world.js";
import { fileIcon } from "./fileicons.js";
import { ICON, elapsed } from "./ui.js";
import { renderMarkdown, renderInline } from "./markdown.js";
import { mediaHtml, fromSharedFile, dedupeByMade } from "./media.js";

const KIND_ICON = {
  create_file: "doc", edit_file: "edit", delete_file: "close", read: "eye", search: "search", list: "search",
  command: "terminal", web_fetch: "globe", web_search: "globe", mcp: "plug", subagent: "agent", ask: "ask",
  other: "dot", notice: "dot", error: "close",
};
const EXTRA = {
  terminal: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 8l4 4-4 4M11 16h8"/></svg>',
  plug: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 4v4M15 4v4M7 8h10v3a5 5 0 0 1-10 0zM12 16v4"/></svg>',
  agent: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="8" width="14" height="10" rx="3"/><path d="M12 4v4M9.5 13h.01M14.5 13h.01"/></svg>',
  ask: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M9.8 9.5a2.3 2.3 0 1 1 3.2 2.1c-.6.3-1 .8-1 1.5M12 16.5h.01"/></svg>',
  dot: '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><circle cx="12" cy="12" r="2.2" fill="currentColor"/></svg>',
};
const icon = (k) => ICON[KIND_ICON[k]] || EXTRA[KIND_ICON[k]] || EXTRA.dot;
const secs = (ms) => { if (ms == null || !Number.isFinite(ms)) return ""; const t = Math.max(1, Math.round(ms / 1000)); return t < 60 ? `${t}s` : `${Math.floor(t / 60)}m ${t % 60}s`; };

function rowMark(r) {
  if (r.status === "running") return r.waiting ? `<i class="tb-m is-wait" title="Waiting for you"></i>` : `<i class="tb-live" aria-hidden="true"></i>`;
  if (r.status === "error") return `<span class="tb-m is-err" title="Failed">${ICON.close}</span>`;
  if (r.status === "denied") return `<span class="tb-m is-den" title="Denied">${ICON.lock}</span>`;
  if (r.status === "cancelled") return `<span class="tb-m is-den" title="Cancelled">■</span>`;
  return `<span class="tb-m is-ok" title="Done">${ICON.check}</span>`;
}
function rowHtml(r, open) {
  const p = r.progress;
  const prog = p ? [p.tool_calls ? `${p.tool_calls} ${p.tool_calls === 1 ? "step" : "steps"}` : "", p.duration_ms ? secs(p.duration_ms) : ""].filter(Boolean).join(" · ") : "";
  const out = r.output != null && r.output !== "" ? r.output : null;
  const canOpen = !!(out || (r.kind === "command" && r.target));
  const head = `<span class="tb-ri">${icon(r.kind || "other")}</span><span class="tb-rl">${renderInline(r.line || "", true)}</span>` +
    (prog ? `<span class="tb-rp">${esc(prog)}</span>` : "") + rowMark(r);
  const cls = `tb-row s-${esc(r.status || "ok")}${r.waiting ? " is-waiting" : ""}${r.pending ? " is-pending" : ""}`;
  // a sub-agent's row opens that sub-agent, like a thread of its own (ch 14 §11)
  if (r.kind === "subagent" && r.call_id) return `<li class="${cls}"><button type="button" class="tb-rh is-btn" data-run-call="${esc(r.call_id)}" title="Open this sub-agent">${head}</button></li>`;
  if (!canOpen) return `<li class="${cls}"><div class="tb-rh">${head}</div></li>`;
  const key = `row:${r.call_id}`;
  const isOpen = !!open[key];
  return `<li class="${cls}"><button type="button" class="tb-rh is-btn" data-tb="${esc(key)}" aria-expanded="${isOpen}">${head}</button>` +
    (isOpen ? `<div class="tb-rb">${r.kind === "command" && r.target ? `<code class="tb-cmd">${esc(r.target)}</code>` : ""}${out ? `<pre class="tb-out">${esc(out)}</pre>` : r.status === "running" ? `<p class="tb-note">Output appears when it finishes.</p>` : ""}</div>` : "") + `</li>`;
}

/**
 * One block. open: {blockId|row:callId → true}. live: the turn is still running. media: how its shared
 * files are drawn (turnHtml's carried, route, by, at).
 */
function blockHtml(b, open, live, now, media = {}) {
  const isOpen = !!open[b.id];
  switch (b.type) {
    case "thinking": {
      const running = !b.done && live;
      const head = running ? `${esc(b.header || "Thinking…")}${b.started_at ? ` · ${secs(now - Date.parse(b.started_at))}` : ""}` : esc(b.header || "Thought");
      const steps = (b.steps || []).filter(Boolean);
      return `<div class="tb tb-think${running ? " is-live" : ""}"><button type="button" class="tb-h" data-tb="${esc(b.id)}" aria-expanded="${isOpen}"${steps.length ? "" : " disabled"}>` +
        `<span class="tb-hi">${ICON.clock}</span><span class="tb-ht${running ? " shimmer" : ""}">${head}</span>${steps.length ? `<span class="tb-chev">${ICON.chevron}</span>` : ""}</button>` +
        (isOpen && steps.length ? `<ol class="tb-steps">${steps.map((s) => `<li>${renderInline(s, true)}</li>`).join("")}</ol>` : "") + `</div>`;
    }
    case "activity": {
      const rows = b.rows || [];
      const running = !b.done && live;
      const cur = running ? rows.filter((r) => r.status === "running") : [];
      const waiting = rows.some((r) => r.waiting);
      return `<div class="tb tb-act${running ? " is-live" : ""}${waiting ? " is-waiting" : ""}"><button type="button" class="tb-h" data-tb="${esc(b.id)}" aria-expanded="${isOpen}">` +
        `<span class="tb-hi">${running ? `<i class="tb-live" aria-hidden="true"></i>` : ICON.list}</span><span class="tb-ht">${renderInline(b.header || "Working", true)}</span>` +
        `<span class="tb-n">${rows.length}</span><span class="tb-chev">${ICON.chevron}</span></button>` +
        (isOpen ? `<ul class="tb-rows">${rows.map((r) => rowHtml(r, open)).join("")}</ul>` : cur.length ? `<ul class="tb-rows is-cur">${cur.map((r) => rowHtml(r, open)).join("")}</ul>` : "") + `</div>`;
    }
    case "plan": {
      const items = b.items || [];
      const mark = (s) => (s === "done" ? "✓" : s === "doing" ? "✱" : "○");
      return `<div class="tb tb-plan"><button type="button" class="tb-h" data-tb="${esc(b.id)}" aria-expanded="${!isOpen ? "false" : "true"}">` +
        `<span class="tb-hi">${ICON.list}</span><span class="tb-ht">${esc(b.header || "Plan")}</span><span class="tb-chev">${ICON.chevron}</span></button>` +
        (isOpen || (live && !b.done) ? `<ol class="tb-plan-l">${items.map((i) => `<li class="ck ck-${esc(i.state)}"><span class="ck-m" aria-hidden="true">${mark(i.state)}</span><span>${renderInline(i.text || "", true)}</span></li>`).join("")}</ol>` : "") + `</div>`;
    }
    case "shared_files": {
      // what an agent hands you is shown, not attached (js/media.js): its pictures in the conversation,
      // its other files as cards that open in the viewer. A file its message carries too (the same
      // made_id) shows there instead, never twice.
      const all = b.files || [];
      const files = dedupeByMade(all, media.carried || []);
      if (!files.length) return "";
      const items = files.map((f) => fromSharedFile(f, { route: media.route, by: media.by, at: media.at }));
      const pics = items.some((it) => it.kind === "image");
      if (pics) return `<div class="tb tb-files">${mediaHtml(items, { side: "them", caption: b.caption || "" })}</div>`;
      // files alone keep their line: "Shared 3 files"
      const header = files.length === all.length ? b.header || "Shared files" : `Shared ${files.length} ${files.length === 1 ? "file" : "files"}`;
      return `<div class="tb tb-files"><p class="tb-fh">${ICON.doc}<span>${esc(header)}${b.caption ? ` · ${esc(b.caption)}` : ""}</span></p>${mediaHtml(items, { side: "them" })}</div>`;
    }
    case "narration":
      return `<div class="tb tb-narr prose">${renderMarkdown(b.text || "")}</div>`;
    case "text":
      return `<div class="tb tb-text prose${!b.done && live ? " is-live" : ""}">${renderMarkdown(b.text || "")}</div>`;
    case "answer":
      return `<div class="tb tb-answer prose">${renderMarkdown(b.text || "")}</div>`;
    default:
      return "";
  }
}

// hub #29: a long task's work (its thinking, tool groups and narration) folds into one line for the
// whole turn, so the answer isn't buried under thirty folded lines. While the turn runs, the line
// counts up and the latest block shows under it, live; once it ends, the files it created or edited
// show as chips, and a step that failed stays outside the fold. Opening the line shows every block
// as before, on a thin rail.
const WORK = new Set(["thinking", "activity", "narration"]);
// The person's shape (js/shape.js, xo:thread/work), set by app.js: "raw" is the above; "words" folds every
// turn's tool work into one plain line ("Changed 2 files and ran 3 checks"), with the commands and paths
// kept for Details (opening the line), so nothing on screen reads like an engineer's terminal.
let WORDS = false;
export function setWorkMode(mode) { WORDS = mode === "words"; }
const EDITS = new Set(["create_file", "edit_file", "delete_file"]);
/** What a turn's steps did, in plain words. */
function plainWork(rows) {
  const steps = rows.filter((r) => r.kind !== "notice" && r.kind !== "error");
  const edits = steps.filter((r) => EDITS.has(r.kind));
  const files = new Set(edits.map((r) => r.target || r.call_id)).size;
  const checks = steps.filter((r) => r.kind === "command").length;
  const tools = steps.length - edits.length - checks;
  const n = (k, one, many) => `${k} ${k === 1 ? one : many}`;
  const parts = [files && `changed ${n(files, "file", "files")}`, checks && `ran ${n(checks, "check", "checks")}`, tools && `used ${n(tools, "tool", "tools")}`].filter(Boolean);
  const s = !parts.length ? "thought it through" : parts.length < 2 ? parts[0] : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
  return s[0].toUpperCase() + s.slice(1);
}
const BAD = new Set(["error", "denied"]);
const CHANGED = new Set(["create_file", "edit_file"]);
const base = (p) => String(p || "").replace(/\/+$/, "").split("/").pop();

/**
 * The files a finished turn created or edited, as chips: what it touched on the way stays a reference. A
 * file it also shared (in a block, or on its message: `carried`) is a deliverable and shows there instead.
 * more: the data-tb key "+N more" opens (the work it hides).
 */
function changedChips(rows, blocks, more, carried = []) {
  const shared = new Set([...blocks.filter((b) => b.type === "shared_files").flatMap((b) => b.files || []), ...carried].map((f) => base(f.path || f.name)));
  const files = new Map();
  for (const r of rows) if (CHANGED.has(r.kind) && r.status === "ok" && r.target && !shared.has(base(r.target))) files.set(r.target, r);
  if (!files.size) return "";
  const list = [...files.values()];
  const shown = list.slice(0, 6);
  const rest = list.length - shown.length;
  return `<ul class="tb-chg" aria-label="Files changed">${shown.map((r) => `<li><button type="button" class="tb-cf" data-file="${esc(r.target)}" data-file-name="${esc(base(r.target))}" title="${esc(r.target)}"><span class="tb-cfi">${fileIcon(r.target)}</span><span class="tb-cfn">${esc(base(r.target))}</span></button></li>`).join("")}` +
    (rest > 0 ? `<li><button type="button" class="tb-cf is-more" data-tb="${esc(more)}">+${rest} more</button></li>` : "") + `</ul>`;
}

function workFold(turn, work, blocks, open, live, now, media = {}) {
  const key = `work:${turn.id}`;
  const isOpen = !!open[key];
  const rows = work.flatMap((b) => (b.type === "activity" ? b.rows || [] : []));
  const steps = rows.filter((r) => r.kind !== "notice" && r.kind !== "error").length;
  const end = turn.end || {};
  const started = Date.parse(turn.at);
  const took = live ? null : end.wall_ms ?? null;
  const time = live
    ? (Number.isFinite(started) ? ` · <span class="elapsed" data-since="${started}">${elapsed(Math.max(0, Math.floor((now - started) / 1000)))}</span>` : "")
    : took != null ? ` ${secs(took)}` : "";
  const waiting = live && rows.some((r) => r.waiting);
  const head = `<button type="button" class="tb-h tb-wh" data-tb="${esc(key)}" aria-expanded="${isOpen}">` +
    // while it runs, the agent's glowing tile beside the turn says so (turnAv); the line needs no spinner
    (live ? "" : `<span class="tb-hi">${ICON.list}</span>`) +
    `<span class="tb-ht${live && !waiting ? " shimmer" : ""}">${live ? `${waiting ? "Waiting for you" : "Working"}${time}` : WORDS ? esc(plainWork(rows)) : `Worked${time}`}</span>` +
    (WORDS && !live ? (took != null ? `<span class="tb-wn">${secs(took)}</span>` : "") : steps ? `<span class="tb-wn">${steps} ${steps === 1 ? "step" : "steps"}</span>` : "") + `<span class="tb-chev">${ICON.chevron}</span></button>`;
  if (isOpen) return `<div class="tb tb-work is-open${live ? " is-live" : ""}">${head}<div class="tb-rail">${work.map((b) => blockHtml(b, open, live, now)).join("")}</div></div>`;
  let under = "";
  if (live) {
    // the ticker: only the latest block, as it streams; older ones are in the count. A step that
    // waits on you shows wherever it is.
    const asks = rows.filter((r) => r.waiting);
    under = asks.length ? `<ul class="tb-rows is-cur">${asks.map((r) => rowHtml(r, open)).join("")}</ul>` : WORDS ? "" : blockHtml(work[work.length - 1], open, live, now);
  } else {
    // a failed turn's own error is said in its last line already. A command that exited non-zero in a
    // turn that went on to finish is the agent feeling its way (`ls`, `which`): it stays in the fold,
    // because surfacing it in red would cry wolf (design-research/2026-11-vision/audit H2). A denial
    // or a real error step still shows.
    const routine = (r) => r.kind === "command" && r.status === "error" && turn.status !== "failed";
    const bad = rows.filter((r) => (BAD.has(r.status) || r.kind === "error") && !(turn.status === "failed" && r.kind === "error") && !routine(r));
    // in words, a step that didn't work is said, not shown: what it ran is one click away, in Details
    if (bad.length) under += WORDS ? `<p class="tb-note tb-wbad">${bad.length === 1 ? "One step" : `${bad.length} steps`} didn't work. Open the line above to see what happened.</p>` : `<ul class="tb-rows tb-bad">${bad.slice(-3).map((r) => rowHtml(r, open)).join("")}</ul>`;
    under += changedChips(rows, blocks, key, media.carried);
  }
  return `<div class="tb tb-work${live ? " is-live" : ""}${waiting ? " is-waiting" : ""}">${head}${under}</div>`;
}

/**
 * A block without the runtime's "sent something I don't know" notices (code unknown_wire): news for
 * whoever maintains the runtime, not for you, so they go to the console. A group left empty goes.
 */
const wireSeen = new Set();
function withoutWireNotices(b) {
  if (b.type !== "activity" || !(b.rows || []).some((r) => r.kind === "notice" && r.summary === "unknown_wire")) return b;
  const rows = b.rows.filter((r) => {
    if (r.kind !== "notice" || r.summary !== "unknown_wire") return true;
    if (!wireSeen.has(r.line)) { wireSeen.add(r.line); console.info(`[runtime] ${r.line}`); }
    return false;
  });
  return rows.length ? { ...b, rows } : null;
}

/**
 * A turn's blocks as HTML. opts: {open, hideAnswer, now, carried, route, by}. A turn that ended with no
 * blocks (the CLI said nothing) renders nothing; a stopped or failed turn says so in one quiet line.
 * Two or more work blocks fold into one line where the first of them was (hub #29).
 * carried: the files the conversation's messages carry (a shared file among them isn't drawn twice);
 * route(path): a shared file's project route ({project, rel} or {why}); by: who made them (the lightbox).
 */
export function turnHtml(turn, blocks, { open = {}, hideAnswer = false, now = Date.now(), carried = [], route = null, by = "" } = {}) {
  const media = { carried, route, by, at: Date.parse(turn.at) || null };
  const live = turn.status === "running";
  const shown = blocks.filter((b) => !(hideAnswer && b.type === "answer")).map(withoutWireNotices).filter(Boolean);
  const work = shown.filter((b) => WORK.has(b.type));
  const fold = work.length >= 2 || (WORDS && work.some((b) => b.type === "activity"));
  const parts = [];
  for (const b of shown) {
    if (fold && WORK.has(b.type)) { if (b === work[0]) parts.push(workFold(turn, work, shown, open, live, now, media)); continue; }
    parts.push(blockHtml(b, open, live, now, media));
    // a turn whose work is one tool group (codex often has no thinking or narration): its files show
    // under that group, as they would under the fold
    if (b.type === "activity" && !live && b.done && !open[b.id]) parts.push(changedChips(b.rows || [], shown, b.id, carried));
  }
  const html = parts.filter(Boolean);
  const end = turn.end || {};
  let foot = "";
  if (turn.status === "stopped" || turn.stopped) foot = `<p class="tb-end is-stop">■ Stopped${turn.stopped && turn.stopped.last_step ? ` after “${esc(turn.stopped.last_step)}”` : ""}</p>`;
  else if (turn.status === "failed") foot = `<p class="tb-end is-err">${ICON.close}<span>This turn failed${end.error ? `: ${esc(String(end.error).slice(0, 240))}` : ""}</span></p>`;
  else if (turn.status === "interrupted") foot = `<p class="tb-end">Interrupted${end.reason === "restart" ? " by a restart; it picks up again" : ""}</p>`;
  if (!html.length && !foot) return "";
  return `<div class="turn${live ? " is-live" : ""}" data-turn="${esc(turn.id)}">${html.join("")}${foot}</div>`;
}

/**
 * The tile beside a turn, in the avatar column: while the turn runs, the agent's mark with a blue glow
 * travelling round its border (the sidebar's working cubes, at avatar size); amber and still while a
 * step waits on you. A finished turn leaves the column empty, as a continuation of the agent's words.
 */
export function turnAv(turn, blocks = []) {
  if (!turn || turn.status !== "running") return `<div class="av av-gap"></div>`;
  const waiting = blocks.some((b) => (b.rows || []).some((r) => r.status === "running" && r.waiting));
  return `<div class="av av-live${waiting ? " is-wait" : ""}" role="img" aria-label="${waiting ? "Waiting for you" : "Working"}" title="${waiting ? "Waiting for you" : "Working"}">${ICON.thread}${waiting ? "" : `<i class="arc" aria-hidden="true"></i>`}</div>`;
}
