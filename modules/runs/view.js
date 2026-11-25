// @ts-check

import { esc } from "../../core/platform/util.js";
import { count, plural } from "../../core/platform/words.js";
import { ICON, stepMark } from "../../core/ui/icons/names.js";
import { xi, stateMark } from "../../core/ui/icons/icon.js";
import { stepIcon } from "../../core/services/step-icons.js";
import { renderMarkdown, renderInline } from "../../core/ui/markdown/markdown.js";

/** @typedef {import("./types").Run} Run @typedef {import("./types").RunCounts} RunCounts @typedef {import("./types").Said} Said @typedef {import("./types").SheetStop} SheetStop @typedef {import("./types").Ancestry} Ancestry @typedef {import("./types").TranscriptItem} TranscriptItem */

/** @typedef {{ canStop: boolean, saidFor: Said | null, out: string[], cmdsOpen: boolean, cmdsAll: boolean }} Controls */

const LIVE = new Set(["running", "waiting"]);
/** @type {Record<string, string>} */
const STATE_WORD = { running: "Working", waiting: "Waiting on you", finished: "Done", failed: "Failed", stopped: "Stopped", lost: "Lost" };
/** @type {Record<string, string>} */
const KIND_WORD = { subagent: "Sub-agent", worker: "Worker", teammate: "Teammate", workflow_agent: "Workflow agent", remote_agent: "Remote agent", background_command: "Background command", monitor: "Monitor", review: "Review", internal: "Internal", other: "Other" };
/** @param {number | null | undefined} n */
const num = (n) => (n == null ? "" : n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : String(n));
/** @param {string | null | undefined} a @param {string | null | undefined} b */
const dur = (a, b) => {
  const ms = (Date.parse(b || "") || Date.now()) - (Date.parse(a || "") || Date.now());
  if (!Number.isFinite(ms) || ms <= 0) return "";
  const t = Math.round(ms / 1000);
  return t < 60 ? `${t}s` : t < 3600 ? `${Math.floor(t / 60)}m ${t % 60}s` : `${Math.floor(t / 3600)}h ${Math.floor((t % 3600) / 60)}m`;
};
/** @param {string} st */
const glyph = (st) => (st === "running" ? "working" : st === "waiting" ? "needs_reply" : st === "finished" ? "done" : st === "failed" || st === "lost" ? "failed" : "resolved");

/** @param {readonly Pick<Run, "id" | "state" | "title">[]} live @param {number} total */
export function runsStripHtml(live, total) {
  if (live.length) {
    const n = live.length, wait = live.filter((r) => r.state === "waiting").length;
    const word = `${count(n, "sub-agent")} working${wait ? `, ${wait} waiting on you` : ""}`;
    const button = `<button type="button" class="rn-live" data-runs title="${word}" aria-label="${word}">${stateMark(wait ? "needs_reply" : "working")}<b class="rn-n">${n}</b></button>`;
    return button + `<div class="rn-strip" role="list" aria-label="Sub-agents working now">${live.map((r) =>
      `<div class="rn-it" role="listitem"><button type="button" class="rn-chip st-${esc(r.state)}" data-run="${esc(r.id)}" title="Open: ${esc(r.title)}">${stateMark(glyph(r.state))}<span>${esc(r.title)}</span>${r.state === "waiting" ? `<em>waiting on you</em>` : ""}</button></div>`).join("")}</div>`;
  }
  return total ? `<button type="button" class="rn-log" data-runs data-n="${total}" title="What its sub-agents did">${ICON.agent}<span>${count(total, "sub-agent")} ran</span></button>` : "";
}

const CMD = new Set(["background_command", "monitor"]);
export const RUN_COMMAND_LIMIT = 8;
/** @param {Run} r */
const isCmd = (r) => CMD.has(r.kind);
export { isCmd as isCommandRun };
/** @param {Run} r */
const failedOf = (r) => r.state === "failed" || r.state === "lost";
/** @param {Run} r */
const end = (r) => (LIVE.has(r.state) ? null : r.ended_at || r.last_activity_at);
/** @param {Run} a @param {Run} b */
const newest = (a, b) => (/** @type {number} */ (/** @type {unknown} */ (LIVE.has(b.state))) - /** @type {number} */ (/** @type {unknown} */ (LIVE.has(a.state)))) || (Date.parse(/** @type {string} */ (b.started_at || /** @type {unknown} */ (0))) || 0) - (Date.parse(/** @type {string} */ (a.started_at || /** @type {unknown} */ (0))) || 0);
/** @param {Run[] | null | undefined} nodes @param {Run[]} [out] @returns {Run[]} */
const flat = (nodes, out = []) => { for (const n of nodes || []) { out.push(n); flat(n.children, out); } return out; };
/** @param {string} [t] */
const looksCmd = (t) => /&&|\|\s|;\s|^\s*(?:cd|git|node|python3?|npm|npx|curl|bash|rm|ls|grep|sed|cat|timeout|export)\b|\/[\w.-]+\//.test(t || "");
/** @param {string} [t] */
const toolWord = (t) => String(t || "").replace(/^mcp__\w+__/, "").replace(/_/g, " ");
/** @param {Run} r */
const cmdIcon = (r) => stepIcon({ kind: "command", target: r.title, line: r.title });
/** A live run's Stop: busy, taking no repeat, while its stop is on its way. @param {Run} r @param {boolean} canStop @param {string[]} out */
function stopHtml(r, canStop, out) {
  if (!canStop || !LIVE.has(r.state) || r.can_stop === false) return "";
  const busy = out.includes(`run:${r.id}`);
  return `<button type="button" class="rn-stop" data-run-stop="${esc(r.id)}" title="${busy ? "Sending the stop…" : "Stop this sub-agent (Undo for 3 s)"}"${busy ? ' aria-busy="true" aria-disabled="true"' : ""}>${ICON.stop}<span>${busy ? "Stopping…" : "Stop"}</span></button>`;
}

/** An agent's row: its mark, title, what it is and took, what it does now or what it said; its own agents under it. @param {Run} r @param {Controls} o @returns {string} */
function agentHtml(r, o, depth = 0) {
  const live = LIVE.has(r.state);
  const meta = [r.agent_type && r.agent_type !== "general-purpose" ? r.agent_type : KIND_WORD[r.kind] !== "Sub-agent" ? KIND_WORD[r.kind] : "", live ? STATE_WORD[r.state] : failedOf(r) || r.state === "stopped" ? STATE_WORD[r.state] : "",
    r.tool_calls ? count(r.tool_calls, "step") : "", r.tokens ? `${num(r.tokens)} tokens` : "", dur(r.started_at, end(r))].filter(Boolean).join(" · ");
  const kids = (r.children || []).filter((c) => !isCmd(c)).sort(newest);
  const cmds = flat(r.children).filter(isCmd).length;
  const now = live && r.last_tool ? `<span class="rn-now">${xi("step-doing")}<span>${esc(toolWord(r.last_tool))}</span></span>` : "";
  const sum = !live && r.summary && r.summary !== r.title ? `<span class="rn-s">${esc(r.summary)}</span>` : "";
  return `<li class="rn-row st-${esc(r.state)}"><div class="rn-line"><button type="button" class="rn-open" data-run="${esc(r.id)}">` +
    `<span class="rn-tile">${xi("agent")}<i class="rn-dot">${stateMark(glyph(r.state))}</i></span>` +
    `<span class="rn-main"><span class="rn-t">${esc(r.title || "Sub-agent")}</span>${meta ? `<span class="rn-m">${esc(meta)}</span>` : ""}${now}${sum}</span>` +
    (cmds ? `<span class="rn-kids" title="${count(cmds, "command")}">${xi("terminal")}${cmds}</span>` : "") + `<span class="rn-chev">${ICON.right}</span></button>${stopHtml(r, o.canStop, o.out)}</div>` +
    saidHtml(o.saidFor, `run:${r.id}`) +
    (kids.length ? `<ul class="rn-list is-sub">${kids.map((c) => agentHtml(c, o, depth + 1)).join("")}</ul>` : "") + `</li>`;
}
/** @param {Run} r @param {Controls} o */
function cmdHtml(r, o) {
  const t = r.title || "A command";
  return `<li class="rn-cmd st-${esc(r.state)}"><div class="rn-line"><button type="button" class="rn-cmd-b" data-run="${esc(r.id)}">${stateMark(glyph(r.state))}<span class="rn-ci">${xi(cmdIcon(r))}</span>` +
    `<span class="rn-ct${looksCmd(t) ? " is-mono" : ""}">${esc(t)}</span><span class="rn-cd">${esc(dur(r.started_at, end(r)) || "")}</span></button>${stopHtml(r, o.canStop, o.out)}</div>${saidHtml(o.saidFor, `run:${r.id}`)}</li>`;
}
/** Commands, folded into one group: how many run, ended and failed; the first 8, then the rest on asking. @param {Run[]} cmds @param {Controls} o */
function cmdsHtml(cmds, o) {
  if (!cmds.length) return "";
  const f = cmds.filter(failedOf).length, l = cmds.filter((r) => LIVE.has(r.state)).length;
  const sub = [l && `${l} running`, cmds.length - f - l && `${cmds.length - f - l} done`, f && `${f} failed`].filter(Boolean).join(" · ");
  const open = o.cmdsOpen !== false, max = o.cmdsAll ? cmds.length : RUN_COMMAND_LIMIT;
  return `<section class="rn-sec"><button type="button" class="rn-grp" data-runs-cmds aria-expanded="${open}">${xi("terminal")}<span class="rn-gt">Commands</span><span class="rn-gs">${esc(sub)}</span><span class="rn-chev">${ICON.chevron}</span></button>` +
    (open ? `<ul class="rn-cmds">${cmds.slice(0, max).map((r) => cmdHtml(r, o)).join("")}</ul>${cmds.length > max ? `<button type="button" class="rn-more" data-runs-more>Show ${cmds.length - max} more</button>` : ""}` : "") + `</section>`;
}
/** Agents first, live then newest; every command, at any depth, in one group under them. @param {Run[] | null} nodes */
function splitRuns(nodes) {
  const all = flat(nodes);
  return { all, agents: (nodes || []).filter((r) => !isCmd(r)).sort(newest), cmds: all.filter(isCmd).sort(newest) };
}

/** The Sub-agents page: what works and what it cost, the agents, the commands; state is loading, error or ok. @param {Run[] | null} tree @param {RunCounts | null} counts @param {{ canStop: boolean, stops?: SheetStop[], state?: string, error?: string, saidFor?: Said | null, session?: string, out?: string[], cmdsOpen?: boolean, cmdsAll?: boolean }} options */
export function runsListHtml(tree, counts, { canStop, stops = [], state = "ok", error = "", saidFor = null, session = "", out = [], cmdsOpen = true, cmdsAll = false }) {
  const { all, agents, cmds } = splitRuns(tree || []);
  const o = { canStop, saidFor, out, cmdsOpen, cmdsAll };
  const live = all.filter((r) => LIVE.has(r.state)), failed = all.filter(failedOf).length, tokens = all.reduce((s, r) => s + (r.tokens || 0), 0);
  const top = (tree || []).filter((r) => LIVE.has(r.state));
  const nAgents = all.length - cmds.length;
  const said = state === "loading" ? `<p class="rn-none" role="status">${all.length ? "Reading its sub-agents again…" : "Reading its sub-agents…"}</p>`
    : state === "error" ? `<p class="rn-none" role="alert">Couldn't read its sub-agents${all.length ? " again" : ""}: ${esc(error)} <button type="button" class="fl-link" data-runs-retry>Try again</button></p>`
    : !all.length ? `<p class="rn-none">No sub-agents yet.</p>` : "";
  const stopAll = canStop && top.length > 1 ? (out.includes(`all:${session}`)
    ? `<button type="button" class="rn-stopall" data-runs-stop title="Sending the stop…" aria-busy="true" aria-disabled="true">Stopping…</button>`
    : `<button type="button" class="rn-stopall" data-runs-stop title="Stop every sub-agent; the thread's own agent keeps working">Stop all ${top.length}</button>`) : "";
  const pills = all.length ? `<div class="rn-stats">${[live.length && `<span class="is-live"><b>${live.length}</b> working</span>`, `<span><b>${nAgents}</b> agent${nAgents === 1 ? "" : "s"}</span>`,
    cmds.length && `<span><b>${cmds.length}</b> ${plural(cmds.length, "command")}</span>`, tokens && `<span><b>${num(tokens)}</b> tokens</span>`, failed && `<span class="is-err"><b>${failed}</b> failed</span>`].filter(Boolean).join("")}${stopAll}</div>` : "";
  return `<div class="rn-body">` + stopsHtml(stops) + saidHtml(saidFor, `all:${session}`) + pills + said +
    (agents.length ? `<h3 class="rn-k">Agents</h3><ul class="rn-list">${agents.map((r) => agentHtml(r, o)).join("")}</ul>` : "") + cmdsHtml(cmds, o) + `</div>`;
}
/** @param {Said | null} said @param {string} key */
export function saidHtml(said, key) {
  if (!said || said.key !== key) return "";
  return `<p class="rn-said k-${esc(said.kind)}" role="${said.kind === "halt" ? "status" : "alert"}"><b>${esc(said.text)}</b>${said.sub ? `<span>${esc(said.sub)}</span>` : ""}</p>`;
}
/** Stops still in their 3 s Undo, inside the sheet: each with its own Undo. @param {SheetStop[]} stops */
export function stopsHtml(stops) {
  if (!stops || !stops.length) return "";
  return `<ul class="rn-stops" aria-label="Stopping">${stops.map((s) => `<li class="rn-stopping" data-key="stop:${esc(s.key)}"><span>Stopping ${esc(s.what)}</span><button type="button" class="t-undo" data-runs-undo="${esc(s.key)}">Undo</button></li>`).join("")}</ul>`;
}

/** A run's transcript as a conversation (input, text, thinking, tool calls with their results, errors). @param {TranscriptItem[]} items @param {{ open?: Record<string, boolean> }} [options] */
export function transcriptHtml(items, { open = {} } = {}) {
  const results = new Map(items.filter((i) => i.type === "tool_result").map((i) => [i.call_id, i]));
  const out = [];
  for (const it of items) {
    if (it.type === "input") {
      const key = `rt:${it.id}`, long = (it.text || "").length > 360 || (it.text || "").split("\n").length > 5;
      out.push(`<div class="rt-in${long && !open[key] ? " is-clamp" : ""}"><span class="rt-k">Its task</span><div class="prose">${renderMarkdown(it.text || "")}</div>` +
        (long ? `<button type="button" class="rt-all" data-tb="${esc(key)}" aria-expanded="${!!open[key]}">${open[key] ? "Show less" : "Show all"}</button>` : "") + `</div>`);
    }
    else if (it.type === "text") out.push(`<div class="prose rt-text">${renderMarkdown(it.text || "")}</div>`);
    else if (it.type === "thinking") {
      const key = `rt:${it.id}`;
      const steps = it.steps && it.steps.length ? it.steps : it.text ? [it.text] : [];
      out.push(`<div class="tb tb-think"><button type="button" class="tb-h" data-tb="${esc(key)}" aria-expanded="${!!open[key]}"${steps.length ? "" : " disabled"}><span class="tb-hi">${ICON.brain}</span><span class="tb-ht">${it.duration_ms ? `Thought for ${Math.max(1, Math.round(it.duration_ms / 1000))}s` : "Thought"}</span>${steps.length ? `<span class="tb-chev">${ICON.chevron}</span>` : ""}</button>` +
        (open[key] && steps.length ? `<ol class="tb-steps">${steps.map((s) => `<li>${renderInline(s, true)}</li>`).join("")}</ol>` : "") + `</div>`);
    } else if (it.type === "tool_call") {
      const res = results.get(it.call_id);
      const key = `rt:${it.id}`;
      const st = res ? res.status || "ok" : "running";
      const mark = st === "running" ? `<i class="spin tb-spin" aria-hidden="true"></i>` : st === "error" ? `<span class="tb-m is-err">${ICON.close}</span>` : st === "denied" ? `<span class="tb-m is-den">${ICON.lock}</span>` : `<span class="tb-m is-ok">${ICON.check}</span>`;
      const plan = it.plan && it.plan.length ? `<ol class="tb-plan-l">${it.plan.map((p) => `<li class="ck ck-${esc(p.state)}"><span class="ck-m" aria-hidden="true">${stepMark(p.state)}</span><span>${renderInline(p.text || "", true)}</span></li>`).join("")}</ol>` : "";
      const body = res && res.text ? `<pre class="tb-out">${esc(res.text)}${res.truncated ? `\n… ${res.bytes ? `${num(res.bytes)} bytes in all` : "cut"}` : ""}</pre>` : "";
      const label = it.title || [it.tool, it.target].filter(Boolean).join(" ");
      out.push(`<div class="rt-call s-${esc(st)}"><button type="button" class="tb-rh is-btn" data-tb="${esc(key)}" aria-expanded="${!!open[key]}"><span class="tb-ri">${xi(stepIcon({ kind: it.kind, tool: it.tool, target: it.target, line: it.title }))}</span><span class="tb-rl">${renderInline(label || "A step", true)}</span>${mark}</button>${open[key] ? `<div class="tb-rb">${it.target && it.target !== label ? `<code class="tb-cmd">${esc(it.target)}</code>` : ""}${plan}${body}</div>` : ""}</div>`);
    } else if (it.type === "error") out.push(`<p class="tb-end is-err">${ICON.close}<span>${esc(it.text || "An error")}</span></p>`);
    else if (it.type === "other" && it.text) out.push(`<p class="tb-end">${esc(it.text)}</p>`);
  }
  return out.join("");
}

/** A run's page: what it is, its state and cost in tiles, its result, its own agents and commands, its transcript. @param {Run} run @param {{ items: TranscriptItem[], children?: Run[], canStop: boolean, gone?: string | null, error?: string | null, loading?: boolean, open?: Record<string, boolean>, stops?: SheetStop[], saidFor?: Said | null, out?: string[], cmdsOpen?: boolean, cmdsAll?: boolean, anc?: Ancestry | null }} options */
export function runViewHtml(run, { items, children = [], canStop, gone = null, error = null, loading = false, open = {}, stops = [], saidFor = null, out = [], cmdsOpen = true, cmdsAll = false, anc = null }) {
  const live = LIVE.has(run.state), cmd = isCmd(run), t = run.title || (cmd ? "A command" : "Sub-agent");
  const parent = ((anc && anc.runs) || []).filter((r) => r.id !== run.id).pop();
  const kind = [cmd ? KIND_WORD[run.kind] : "Sub-agent", !cmd && run.agent_type && run.agent_type !== "general-purpose" ? run.agent_type : "", parent ? `in ${parent.title || "a sub-agent"}` : ""].filter(Boolean).join(" · ");
  const tiles = [["State", `<span class="rn-sv st-${esc(run.state)}">${stateMark(glyph(run.state))}${esc(STATE_WORD[run.state] || run.state)}</span>`], !cmd && ["Steps", esc(String(run.tool_calls ?? "–"))], !cmd && ["Tokens", esc(num(run.tokens) || "–")], ["Time", esc(dur(run.started_at, end(run)) || "–")]].filter(Boolean);
  const hero = `<div class="rn-hero"><span class="rn-tile is-lg">${xi(cmd ? cmdIcon(run) : "agent")}</span><div class="rn-main"><span class="rn-kind">${esc(kind)}</span><h3 class="rn-ht${looksCmd(t) ? " is-mono" : ""}">${esc(t)}</h3></div>${stopHtml(run, canStop, out)}</div>` +
    `<dl class="rn-tiles">${(/** @type {string[][]} */ (tiles)).map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join("")}</dl>`;
  const result = run.summary && !live && run.summary !== t ? `<div class="rn-result"><span class="rn-kind">Result</span><p>${esc(run.summary)}</p></div>` : "";
  const { agents, cmds } = splitRuns(children);
  const o = { canStop, saidFor, out, cmdsOpen, cmdsAll };
  const kids = (agents.length ? `<h3 class="rn-k">Its sub-agents</h3><ul class="rn-list">${agents.map((r) => agentHtml(r, o)).join("")}</ul>` : "") + cmdsHtml(cmds, o);
  let body;
  if (gone) body = `<p class="rn-note">${xi("history")}<span>Its step-by-step record is no longer kept${result ? "; the result above is what's left" : ""}.</span></p>`;
  else if (error) body = `<p class="rn-none" role="alert">Couldn't read its work: ${esc(error)}</p>`;
  else if (loading && !items.length) body = `<p class="rn-none" role="status"><i class="spin" aria-hidden="true"></i> Reading its work…</p>`;
  else body = transcriptHtml(items, { open }) || `<p class="rn-none">Nothing recorded yet.</p>`;
  return `<div class="rn-body rn-run">${hero}${stopsHtml(stops)}${saidHtml(saidFor, `run:${run.id}`)}<div class="rn-work">${result}${kids}${body}</div></div>`;
}
