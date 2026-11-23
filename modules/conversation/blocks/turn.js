// @ts-check
import { esc } from "../../../core/platform/util.js";
import { fileIcon } from "../../../core/ui/icons/fileicons.js";
import { elapsed } from "../../../core/platform/index.js";
import { ICON, stepMark, DOTS } from "../../../core/ui/icons/names.js";
import { xi, ARC } from "../../../core/ui/icons/icon.js";
import { renderMarkdown, renderInline } from "../../../core/ui/markdown/markdown.js";
import { mediaHtml } from "../../../core/services/media/render.js";
import { fromSharedFile, dedupeByMade } from "../../../core/services/media/items.js";
import { commsLine, commsHeader, commsText, commsTool, commsBusy, commsPause } from "../../../core/services/comms.js";
import { stepIcon } from "../../../core/services/step-icons.js";

/** @typedef {Parameters<typeof fromSharedFile>[0]} File */

/** @typedef {{kind: string, status: string, waiting?: boolean, pending?: boolean, tool?: string, target?: string, line?: string, summary?: string, call_id?: string, output?: string, progress?: {tool_calls?: number, duration_ms?: number}}} Step */

/** @typedef {{id: string, type: string, done?: boolean, header?: string, started_at?: string, steps?: string[], rows?: Step[], items?: {state: string, text?: string}[], files?: File[], caption?: string, text?: string, seq?: number | null}} Block */

/** @typedef {{id: string, at?: string, status?: string, seq?: number | null, lastSeq?: number | null, end?: {wall_ms?: number | null, error?: unknown, reason?: string} | null, stopped?: {last_step?: string} | null, selfEnded?: boolean}} Turn */

/** @typedef {{additions?: number, deletions?: number, binary?: boolean, on?: boolean}} Change */

/** @typedef {Record<string, boolean>} Open */

/** @typedef {NonNullable<Parameters<typeof fromSharedFile>[1]> & {carried?: File[], changed?: ((target: string) => Change | null) | null}} Media */

/** @typedef {Media & {open?: Open, hideAnswer?: boolean, now?: number, working?: boolean}} RenderOptions */

/** @param {number | null | undefined} ms */
const secs = (ms) => { if (ms == null || !Number.isFinite(ms)) return ""; const t = Math.max(1, Math.round(ms / 1000)); return t < 60 ? `${t}s` : `${Math.floor(t / 60)}m ${t % 60}s`; };
/** @param {string} s @param {string} [kind] */
export const stepLineHtml = (s, kind) => (kind === "subagent" ? esc(String(s).replace(/`([^`]*)`/g, "$1")) : renderInline(s, true));

/** @param {Step} r */
function rowMark(r) {
  if (r.status === "running") return r.waiting ? `<i class="tb-m is-wait" title="Waiting for you"></i>` : `<i class="tb-live" aria-hidden="true"></i>`;
  if (commsBusy(r)) return `<span class="tb-m is-den" title="In use">${ICON.clock}</span>`;
  if (r.status === "error") return `<span class="tb-m is-err" title="Failed">${ICON.close}</span>`;
  if (r.status === "denied") return `<span class="tb-m is-den" title="Denied">${ICON.lock}</span>`;
  if (r.status === "cancelled") return `<span class="tb-m is-den" title="Cancelled">${ICON.stop}</span>`;
  return `<span class="tb-m is-ok" title="Done">${ICON.check}</span>`;
}
/** @param {Step} r @param {Open} open */
function rowHtml(r, open) {
  const p = r.progress;
  const prog = p ? [p.tool_calls ? `${p.tool_calls} ${p.tool_calls === 1 ? "step" : "steps"}` : "", p.duration_ms ? secs(p.duration_ms) : ""].filter(Boolean).join(" · ") : "";
  const out = r.output != null && r.output !== "" ? r.output : null;
  const canOpen = !!(out || (r.kind === "command" && r.target));
  const said = commsLine(r);
  const head = `<span class="tb-ri">${xi(stepIcon(r))}</span><span class="tb-rl">${said ? esc(said) : stepLineHtml(commsText(r.line) || "", r.kind)}</span>` +
    (prog ? `<span class="tb-rp">${esc(prog)}</span>` : "") + rowMark(r);
  const li = `<li class="tb-row s-${esc(r.status || "ok")}${r.waiting ? " is-waiting" : ""}${r.pending ? " is-pending" : ""}" data-r="${esc(r.call_id || "")}"${r.call_id != null ? ` data-call-id="${esc(r.call_id)}"` : ""}>`;
  if (r.kind === "subagent" && r.call_id) return `${li}<button type="button" class="tb-rh is-btn" data-run-call="${esc(r.call_id)}" title="Open this sub-agent">${head}</button></li>`;
  if (!canOpen) return `${li}<div class="tb-rh">${head}</div></li>`;
  const key = `row:${r.call_id}`;
  const isOpen = !!open[key];
  return `${li}<button type="button" class="tb-rh is-btn" data-tb="${esc(key)}" aria-expanded="${isOpen}">${head}</button>` +
    (isOpen ? `<div class="tb-rb">${r.kind === "command" && r.target ? `<code class="tb-cmd">${esc(r.target)}</code>` : ""}${out ? `<pre class="tb-out">${esc(out)}</pre>` : r.status === "running" ? `<p class="tb-note">Output appears when it finishes.</p>` : ""}</div>` : "") + `</li>`;
}

/** @param {Block} b @param {Open} open @param {boolean} live @param {number} now @param {Media} [media] */
function blockHtml(b, open, live, now, media = {}, tail = "") {
  const isOpen = !!open[b.id];
  switch (b.type) {
    case "thinking": {
      const running = !b.done && live;
      const head = running ? `${esc(b.header || "Thinking…")}${b.started_at ? ` · ${secs(now - Date.parse(b.started_at))}` : ""}` : esc(b.header || "Thought");
      const steps = (b.steps || []).filter(Boolean);
      return `<div class="tb tb-think${running ? " is-live" : ""}${isOpen ? " is-unfolded" : ""}" data-b="${esc(b.id)}"><button type="button" class="tb-h" data-tb="${esc(b.id)}" aria-expanded="${isOpen}"${steps.length ? "" : " disabled"}>` +
        `<span class="tb-hi">${ICON.brain}</span><span class="tb-ht${running ? " shimmer" : ""}">${head}</span>${steps.length ? `<span class="tb-chev">${ICON.chevron}</span>` : ""}</button>` +
        (isOpen && steps.length ? `<ol class="tb-steps">${steps.map((s) => `<li>${renderInline(s, true)}</li>`).join("")}</ol>` : "") + `</div>`;
    }
    case "activity": {
      const rows = b.rows || [];
      const running = !b.done && live;
      const cur = running ? rows.filter((r) => r.status === "running") : [];
      const waiting = rows.some((r) => r.waiting);
      return `<div class="tb tb-act${running ? " is-live" : ""}${waiting ? " is-waiting" : ""}${isOpen ? " is-unfolded" : ""}${isOpen || cur.length ? " has-rows" : ""}" data-b="${esc(b.id)}"><button type="button" class="tb-h" data-tb="${esc(b.id)}" aria-expanded="${isOpen}">` +
        `<span class="tb-hi">${cur.length ? xi(stepIcon(cur[0])) : ICON.list}</span><span class="tb-ht">${commsHeader(rows) ? esc(commsHeader(rows)) : renderInline(commsText(b.header) || "Working", true)}</span>` +
        `<span class="tb-n">${rows.length}</span><span class="tb-chev">${ICON.chevron}</span></button>` +
        (isOpen ? `<ul class="tb-rows">${rows.map((r) => rowHtml(r, open)).join("")}</ul>` : cur.length ? `<ul class="tb-rows is-cur">${cur.map((r) => rowHtml(r, open)).join("")}</ul>` : "") + tail + `</div>`;
    }
    case "plan": {
      const items = b.items || [];
      return `<div class="tb tb-plan${isOpen ? " is-unfolded" : ""}" data-b="${esc(b.id)}"><button type="button" class="tb-h" data-tb="${esc(b.id)}" aria-expanded="${!isOpen ? "false" : "true"}">` +
        `<span class="tb-hi">${xi("checklist")}</span><span class="tb-ht">${esc(b.header || "Plan")}</span><span class="tb-chev">${ICON.chevron}</span></button>` +
        (isOpen || (live && !b.done) ? `<ol class="tb-plan-l">${items.map((i) => `<li class="ck ck-${esc(i.state)}"><span class="ck-m" aria-hidden="true">${stepMark(i.state)}</span><span>${renderInline(i.text || "", true)}</span></li>`).join("")}</ol>` : "") + `</div>`;
    }
    case "shared_files": {
      const all = b.files || [];
      const files = dedupeByMade(all, media.carried || []);
      if (!files.length) return "";
      const items = files.map((f) => fromSharedFile(f, { route: media.route, by: media.by, at: media.at }));
      const pics = items.some((it) => it.kind === "image");
      if (pics) return `<div class="tb tb-files">${mediaHtml(items, { side: "them", caption: b.caption || "" })}</div>`;
      const header = files.length === all.length ? b.header || "Shared files" : `Shared ${files.length} ${files.length === 1 ? "file" : "files"}`;
      return `<div class="tb tb-files"><p class="tb-fh">${ICON.doc}<span>${esc(header)}${b.caption ? ` · ${esc(b.caption)}` : ""}</span></p>${mediaHtml(items, { side: "them" })}</div>`;
    }
    case "narration":
      return `<div class="tb tb-narr prose" data-b="${esc(b.id)}">${renderMarkdown(b.text || "")}</div>`;
    case "text":
      { const md = renderMarkdown(b.text || ""); return `<div class="tb tb-text prose${!b.done && live ? " is-live" : ""}${md.includes('<div class="md-table') ? " has-table" : ""}">${md}</div>`; }
    case "answer":
      { const md = renderMarkdown(b.text || ""); return `<div class="tb tb-answer prose${md.includes('<div class="md-table') ? " has-table" : ""}">${md}</div>`; }
    default:
      return "";
  }
}

const WORK = new Set(["thinking", "activity", "narration"]);
let WORDS = false;
/** @param {string} mode */
export function setWorkMode(mode) { WORDS = mode === "words"; }
const EDITS = new Set(["create_file", "edit_file", "delete_file"]);
/** @param {Step[]} rows */
function plainWork(rows) {
  const steps = rows.filter((r) => r.kind !== "notice" && r.kind !== "error");
  const edits = steps.filter((r) => EDITS.has(r.kind));
  const files = new Set(edits.map((r) => r.target || r.call_id)).size;
  const checks = steps.filter((r) => r.kind === "command").length;
  const tools = steps.length - edits.length - checks;
  /** @param {number} k @param {string} one @param {string} many */
  const n = (k, one, many) => `${k} ${k === 1 ? one : many}`;
  const parts = /** @type {string[]} */ ([files && `changed ${n(files, "file", "files")}`, checks && `ran ${n(checks, "check", "checks")}`, tools && `used ${n(tools, "tool", "tools")}`].filter(Boolean));
  const s = !parts.length ? "thought it through" : parts.length < 2 ? parts[0] : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
  return s[0].toUpperCase() + s.slice(1);
}
const BAD = new Set(["error", "denied"]);
const CHANGED = new Set(["create_file", "edit_file"]);
/** @param {string | null | undefined} p */
const base = (p) => String(p || "").replace(/\/+$/, "").split("/").pop();

/** @param {Change | null} c */
function counts(c) {
  if (!c) return "";
  if (c.binary) return "";
  const a = c.additions || 0, d = c.deletions || 0;
  return `<span class="xd-n" aria-label="${a} added, ${d} removed">${a ? `<b class="xd-a">+${a}</b>` : ""}${d ? `<b class="xd-d">−${d}</b>` : ""}</span>`;
}

/** @param {Step[]} rows @param {Block[]} blocks @param {string} more @param {File[]} [carried] @param {Media['changed']} [changed] */
function changedChips(rows, blocks, more, carried = [], changed = null) {
  const shared = new Set([...blocks.filter((b) => b.type === "shared_files").flatMap((b) => b.files || []), ...carried].map((f) => base(f.path || f.name)));
  const files = new Map();
  for (const r of rows) if (CHANGED.has(r.kind) && r.status === "ok" && r.target && !shared.has(base(r.target))) files.set(r.target, r);
  if (!files.size) return "";
  const list = [...files.values()];
  const shown = list.slice(0, 6);
  const rest = list.length - shown.length;
  return `<ul class="tb-chg" aria-label="Files changed">${shown.map((r) => { const c = changed ? changed(r.target) : null; return `<li><button type="button" class="tb-cf${c && c.on ? " is-on" : ""}" data-file="${esc(r.target)}" data-file-name="${esc(base(r.target))}" title="${esc(`${r.target} · ⌘ or Ctrl-click opens it in Files`)}"${c && c.on ? ' aria-current="true"' : ""}><span class="tb-cfi">${fileIcon(r.target)}</span><span class="tb-cfn">${esc(base(r.target))}</span>${counts(c)}</button></li>`; }).join("")}` +
    (rest > 0 ? `<li><button type="button" class="tb-cf is-more" data-tb="${esc(more)}">+${rest} more</button></li>` : "") + `</ul>`;
}

/** @param {Block} b */
const emptyThought = (b) => b.type === "thinking" && b.done && !(b.steps || []).some(Boolean);
/** @type {Set<string | null>} */
const BOOKS = new Set(["reply", "report", "update_status", "submit_result", "no_reply_needed"]);

/** @param {Block[]} work */
const bookkeeping = (work) => work.some((b) => b.type === "activity") && work.every((b) => emptyThought(b) || (b.type === "activity" && b.done && (b.rows || []).length && (/** @type {Step[]} */ (b.rows)).every((r) => BOOKS.has(commsTool(r)) && r.status !== "error" && r.status !== "denied")));

/** @param {Turn} turn @param {Block[]} work @param {Block[]} blocks @param {Open} open @param {boolean} live @param {number} now @param {Media} [media] */
function workFold(turn, work, blocks, open, live, now, media = {}) {
  const key = `work:${turn.id}`;
  const isOpen = !!open[key];
  const rows = work.flatMap((b) => (b.type === "activity" ? b.rows || [] : []));
  const steps = rows.filter((r) => r.kind !== "notice" && r.kind !== "error").length;
  const end = turn.end || {};
  const started = Date.parse(/** @type {string} */ (turn.at));
  const took = live ? null : end.wall_ms ?? null;
  const time = live
    ? (Number.isFinite(started) ? ` · <span class="elapsed" data-since="${started}">${elapsed(Math.max(0, Math.floor((now - started) / 1000)))}</span>` : "")
    : took != null ? ` ${secs(took)}` : "";
  const waiting = live && rows.some((r) => r.waiting);
  const head = `<button type="button" class="tb-h tb-wh" data-tb="${esc(key)}" aria-expanded="${isOpen}">` +
    (live ? (waiting ? "" : DOTS) : `<span class="tb-hi">${ICON.list}</span>`) +
    `<span class="tb-ht${live && !waiting ? " shimmer" : ""}">${live ? `${waiting ? "Waiting for you" : "Working"}${time}` : WORDS ? esc(plainWork(rows)) : `Worked${time}`}</span>` +
    (WORDS && !live ? (took != null ? `<span class="tb-wn">${secs(took)}</span>` : "") : steps ? `<span class="tb-wn">${steps} ${steps === 1 ? "step" : "steps"}</span>` : "") + `<span class="tb-chev">${ICON.chevron}</span></button>`;
  if (isOpen) return `<div class="tb tb-work is-open${live ? " is-live" : ""}" data-b="${esc(key)}">${head}<div class="tb-rail">${work.filter((b) => !emptyThought(b)).map((b) => blockHtml(b, open, live, now)).join("")}</div></div>`;
  let under = "";
  if (live) {
    const asks = rows.filter((r) => r.waiting);
    const last = work[work.length - 1];
    const step = last && last.type === "activity" ? /** @type {Step[]} */ ([(last.rows || []).filter((r) => r.status === "running").pop() || (last.rows || []).at(-1)].filter(Boolean)) : null;
    under = asks.length ? `<ul class="tb-rows is-cur">${asks.map((r) => rowHtml(r, open)).join("")}</ul>` : WORDS || !last ? "" : step ? (step.length ? `<ul class="tb-rows is-cur">${step.map((r) => rowHtml(r, open)).join("")}</ul>` : "") : blockHtml(last, open, live, now);
  } else {
    /** @param {Step} r */
    const routine = (r) => (r.kind === "command" && r.status === "error" && turn.status !== "failed") || commsBusy(r);
    const bad = rows.filter((r) => (BAD.has(r.status) || r.kind === "error") && !(turn.status === "failed" && r.kind === "error") && !routine(r));
    if (bad.length) under += WORDS ? `<p class="tb-note tb-wbad">${bad.length === 1 ? "One step" : `${bad.length} steps`} didn't work. Open the line above to see what happened.</p>` : `<ul class="tb-rows tb-bad">${bad.slice(-3).map((r) => rowHtml(r, open)).join("")}</ul>`;
    under += changedChips(rows, blocks, key, media.carried, media.changed);
  }
  return `<div class="tb tb-work${live ? " is-live" : ""}${waiting ? " is-waiting" : ""}${under.includes('<ul class="tb-rows') ? " has-rows" : ""}" data-b="${esc(key)}">${head}${under}</div>`;
}

const wireSeen = new Set();
/** @param {Block} b */
function withoutWireNotices(b) {
  if (b.type !== "activity" || !(b.rows || []).some((r) => r.kind === "notice" && r.summary === "unknown_wire")) return b;
  const rows = (/** @type {Step[]} */ (b.rows)).filter((r) => {
    if (r.kind !== "notice" || r.summary !== "unknown_wire") return true;
    if (!wireSeen.has(r.line)) { wireSeen.add(r.line); console.info(`[runtime] ${r.line}`); }
    return false;
  });
  return rows.length ? { ...b, rows } : null;
}

const WORDS_BLOCKS = new Set(["text", "answer", "narration"]);
/** @param {Block[]} blocks */
function afterSilence(blocks) {
  let cut = -1;
  blocks.forEach((b, i) => { if (b.type === "activity" && (b.rows || []).some((r) => commsTool(r) === "no_reply_needed" && r.status !== "error" && r.status !== "denied")) cut = i; });
  return cut < 0 ? blocks : blocks.filter((b, i) => i <= cut || !WORDS_BLOCKS.has(b.type));
}

/** @param {string | undefined | null} step */
function stoppedAt(step) {
  if (!step) return "Stopped";
  const said = commsText(step);
  if (said !== step && !said.includes("`")) return `Stopped while ${said.charAt(0).toLowerCase()}${said.slice(1)}`;
  return `Stopped after “${renderInline(said, true)}”`;
}

/** @param {Turn} turn @param {unknown[]} blocks @param {RenderOptions} [options] */
export function turnHtml(turn, blocks, { open = {}, hideAnswer = false, now = Date.now(), carried = [], route = null, by = "", working = false, changed = null } = {}) {
  const media = { carried, route, by, at: Date.parse(/** @type {string} */ (turn.at)) || null, changed };
  const live = turn.status === "running";
  const kept = /** @type {Block[]} */ (afterSilence(/** @type {Block[]} */ (blocks)).filter((b) => !(hideAnswer && b.type === "answer")).map(withoutWireNotices).filter(Boolean));
  const quiet = !live && bookkeeping(kept.filter((b) => WORK.has(b.type)));
  const bare = !live && kept.some(emptyThought) && kept.filter((b) => WORK.has(b.type)).every(emptyThought);
  const shown = quiet || bare ? kept.filter((b) => !WORK.has(b.type)) : kept;
  const work = shown.filter((b) => WORK.has(b.type));
  const fold = work.length >= 2 || (live && work.length > 0) || (WORDS && work.some((b) => b.type === "activity"));
  const parts = [];
  for (const b of shown) {
    if (fold && WORK.has(b.type)) { if (b === work[0]) parts.push(workFold(turn, work, shown, open, live, now, media)); continue; }
    const chips = b.type === "activity" && !live && b.done && !open[b.id] ? changedChips(b.rows || [], shown, b.id, carried, changed) : "";
    parts.push(blockHtml(b, open, live, now, media, chips));
  }
  if (live && !work.length && (working || shown.length)) parts.push(workFold(turn, [], shown, open, live, now, media));
  const html = parts.filter(Boolean);
  const end = turn.end || {};
  let foot = "";
  if (turn.status === "stopped" || turn.stopped) foot = `<p class="tb-end is-stop">${ICON.stop}<span>${stoppedAt(turn.stopped && turn.stopped.last_step)}</span></p>`;
  else if (turn.status === "failed") foot = `<p class="tb-end is-err">${ICON.close}<span>This turn failed${end.error ? `: ${esc(String(end.error).slice(0, 240))}` : ""}</span></p>`;
  else if (turn.status === "interrupted") foot = `<p class="tb-end">Interrupted${end.reason === "restart" ? " by a restart; it picks up again" : ""}</p>`;
  else if (turn.selfEnded) { const why = commsPause((/** @type {Block[]} */ (blocks)).flatMap((b) => (b.type === "activity" ? b.rows || [] : []))); if (why) foot = `<p class="tb-end is-pause">${ICON.clock}<span>${esc(why)}</span></p>`; }
  if (!html.length && !foot) return "";
  const said = !!foot || html.some((h) => /^<div class="tb tb-(?:text|answer|files)\b/.test(h));
  return `<div class="turn${live ? " is-live" : ""}${said ? " is-said" : ""}" data-turn="${esc(turn.id)}">${html.join("")}${foot}</div>`;
}

/** @param {Turn} turn @param {Block[]} blocks @param {({seq: number, at: number} | null)[]} [says] */
export function turnSegments(turn, blocks, says = []) {
  const running = turn.status === "running";
  const first = turn.seq ?? -Infinity, lastF = turn.lastSeq ?? Infinity;
  const cut = says.filter(/** @returns {m is {seq: number, at: number}} */ (m) => /** @type {boolean} */ (m && m.seq != null && m.seq > first && (running || m.seq <= lastF))).sort((a, b) => a.seq - b.seq);
  const t0 = Date.parse(/** @type {string} */ (turn.at));
  const end = !running && turn.end && turn.end.wall_ms != null && Number.isFinite(t0) ? t0 + turn.end.wall_ms : null;
  /** @type {{k: number, blocks: Block[], from: number | null, after: number | null}[]} */
  const segs = [{ k: 0, blocks: [], from: Number.isFinite(t0) ? t0 : null, after: null }];
  for (const [i, m] of cut.entries()) segs.push({ k: i + 1, blocks: [], from: Number.isFinite(m.at) ? m.at : null, after: m.seq });
  let k = 0;
  for (const b of blocks) {
    if (b.seq != null) while (k < cut.length && cut[k].seq < b.seq) k++;
    segs[k].blocks.push(b);
  }
  return segs.map((s, i) => ({
    k: s.k, blocks: s.blocks, last: i === segs.length - 1,
    seq: i === 0 ? turn.seq : (s.blocks.find((b) => b.seq != null)?.seq ?? (/** @type {number} */ (s.after)) + 0.5),
    from: s.from, to: i < cut.length ? (Number.isFinite(cut[i].at) ? cut[i].at : null) : end,
  })).filter((s) => s.blocks.length || s.last);
}

/** @template {Turn} T @param {T} turn @param {{k: number, from: number | null, to: number | null, last: boolean}} seg */
export function segmentTurn(turn, seg) {
  const id = seg.k === 0 ? turn.id : `${turn.id}#${seg.k}`;
  const at = seg.from != null ? new Date(seg.from).toISOString() : turn.at;
  if (seg.last) return seg.k === 0 ? turn : { ...turn, id, at, end: turn.end ? { ...turn.end, wall_ms: seg.to != null && seg.from != null ? seg.to - seg.from : turn.end.wall_ms } : turn.end };
  return { ...turn, id, at, status: "finished", stopped: null, selfEnded: false, end: { wall_ms: seg.to != null && seg.from != null ? seg.to - seg.from : null } };
}

/** @param {{status?: string} | null} turn @param {unknown[]} [blocks] */
export function turnAv(turn, blocks = []) {
  if (!turn || turn.status !== "running") return `<div class="av av-gap"></div>`;
  const waiting = (/** @type {Block[]} */ (blocks)).some((b) => (b.rows || []).some((r) => r.status === "running" && r.waiting));
  return `<div class="av av-live${waiting ? " is-wait" : ""}" role="img" aria-label="${waiting ? "Waiting for you" : "Working"}" title="${waiting ? "Waiting for you" : "Working"}">${ICON.thread}${waiting ? "" : ARC}</div>`;
}
