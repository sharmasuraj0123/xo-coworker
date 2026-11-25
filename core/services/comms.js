// @ts-check
import { reportFailure } from "./notices/failures.js";

// An agent's XO comms tool calls in people's words: what it is doing, what it did, and why a turn it ended is only a pause.

/** @typedef {{ thread: (id: string) => string | null, project: (chatId: string) => string | null, here: () => string | null }} Names */

/** @typedef {{ tool?: string, target?: string, status?: string, summary?: unknown }} Row */

/** @type {Names} */
let names = { thread: () => null, project: () => null, here: () => null };
/** @param {Partial<Names>} fns */
export function nameWith(fns) {
  const previous = names;
  const next = { ...previous, ...fns };
  names = next;
  return () => { if (names === next) names = previous; };
}

const COMMS = /^(?:mcp__)?xo_comms(?:__|\/)([\w-]+)$/;
/** @type {Record<string, (r: Record<string, unknown>) => boolean>} */
const RECEIPT = {
  message_thread: (r) => r.delivered === true,
  message_coordinator: (r) => r.delivered === true || r.ok === true || !!r.hop_id,
  ask_workspace: (r) => r.asked === true || !!r.hop_id,
  forward_to_project: (r) => !!r.hop_id || !!r.project,
  post_message: (r) => !!r.message_id,
  reply: (r) => !!r.message_id,
};
/** @param {Row | null | undefined} row */
export function commsTool(row) {
  const m = COMMS.exec(String((row && (row.tool || row.target)) || ""));
  return m ? m[1] : null;
}
/** @param {unknown} s @returns {Record<string, unknown>} */
const parse = (s) => {
  if (typeof s !== "string" || !s.startsWith("{")) return {};
  try { return JSON.parse(s) || {}; }
  catch (error) { if (!(error instanceof SyntaxError)) reportFailure(error); return {}; }
};
/** @param {string | null} t */
const q = (t) => (t ? `“${t}”` : "");

/** @param {unknown} name */
const resourceOf = (name) => (typeof name !== "string" || !name ? "a shared resource" : /browser/i.test(name) ? "the browser" : `“${name}”`);
const HELD = /^(\S+) is held by\b/;
/** @param {Row} row */
export function commsBusy(row) {
  return commsTool(row) === "lease" && row.status === "error" && typeof row.summary === "string" && HELD.test(row.summary);
}

/** @param {string} tool @param {Record<string, unknown>} res @param {{ project?: string }} [ctx] @returns {string[]} */
function words(tool, res, ctx = {}) {
  const thread = typeof res.thread_id === "string" && res.thread_id ? names.thread(res.thread_id) : null;
  const t = thread ? q(thread) : "a thread";
  const here = ctx.project || names.here();
  const coord = here ? `the ${here} coordinator` : "its coordinator";
  const project = typeof res.project === "string" ? res.project : "";
  const proj = project || (typeof res.chat_id === "string" && res.chat_id && names.project(res.chat_id)) || null;
  switch (tool) {
    case "message_thread": return ["Writing to a thread", res.delivery === "steer" || res.turn_running ? `Sent to ${t} while it works` : `Sent to ${t}`, `Couldn't reach ${t}`, `Message to ${t}`];
    case "start_thread_session": return ["Starting a thread", `Started ${t}`, res.error === "thread_exists" ? `${thread ? t : "That thread"} was already started` : "Couldn't start a thread"];
    case "message_coordinator": return [`Writing to ${coord}`, `Sent to ${coord}`, `Couldn't reach ${coord}`, `Message to ${coord}`];
    case "ask_workspace": return ["Talking to the Workspace coordinator", "Asked the Workspace coordinator", "Couldn't reach the Workspace coordinator", "Question to the Workspace coordinator"];
    case "forward_to_project": return [`Handing it to ${proj ? `the ${proj}` : "a project's"} coordinator`, `Sent to ${proj ? `the ${proj}` : "a project's"} coordinator`, `Couldn't reach ${proj ? `the ${proj}` : "that project's"} coordinator`, `Message to ${proj ? `the ${proj}` : "a project's"} coordinator`];
    case "ask_owner": return ["Asking you", "Asked you"];
    case "post_message": case "reply": return ["Writing to you", "Wrote to you", "Couldn't post to you", "Message to you"];
    case "no_reply_needed": return ["Deciding there's nothing to add", "Nothing to add"];
    case "update_status": return ["Updating its checklist", "Updated its checklist"];
    case "list_projects": return ["Looking over your projects", "Looked over your projects"];
    case "propose_project": return ["Proposing a project", "Proposed a project"];
    case "fetch_thread": return [`Reading ${t}`, `Read ${t}`];
    case "fetch_messages": case "fetch_timeline": return ["Reading the conversation", "Read the conversation"];
    case "read_memory": return ["Reading the project's memory", "Read the project's memory"];
    case "update_memory": return ["Updating the project's memory", "Updated the project's memory"];
    case "add_todo": case "update_todo": return ["Updating the project's todos", "Updated the project's todos"];
    case "list_todos": return ["Reading the project's todos", "Read the project's todos"];
    case "share_files": return ["Sharing files", "Shared files"];
    case "react": return ["Reacting", "Reacted"];
    case "rename_thread": return ["Renaming a thread", "Renamed a thread"];
    case "set_thread_label": return ["Labelling a thread", "Labelled a thread"];
    case "set_thread_resolved": return [`Resolving ${t}`, `Resolved ${t}`];
    case "withdraw_ask": return ["Withdrawing a question", "Withdrew a question"];
    case "create_job": return ["Asking to schedule a job", "Asked to schedule a job"];
    case "list_jobs": return ["Looking over the jobs", "Looked over the jobs"];
    case "cancel_job": return ["Turning a job off", "Turned a job off"];
    case "message_coordinator_reply": return ["Answering", "Answered"];
    case "ask": {
      const done = res.review_id ? "Asked you" : res.to === "workspace" ? "Asked the Workspace coordinator" : res.to === "coordinator" ? `Asked ${coord}` : res.hop_id ? "Passed a question on" : "Asked a question";
      return ["Asking a question", done];
    }
    case "report": return ["Reporting its progress", "Reported its progress"];
    case "submit_result": return ["Handing in its result", "Handed in its result"];
    case "create_task": return ["Starting a thread", `Started ${t}`, "Couldn't start a thread"];
    case "continue_thread": return [`Continuing ${t}`, `Continued ${t}`, `Couldn't continue ${t}`];
    case "stop_thread": return [`Stopping ${t}`, `Stopped ${t}`, `Couldn't stop ${t}`];
    case "list_thread_sessions": return ["Looking over its threads", "Looked over its threads"];
    case "set_goal": return ["Setting a goal", "Set a goal"];
    case "read_state": return ["Checking where things stand", "Checked where things stand"];
    case "handoff_note": return ["Writing a handoff note", "Wrote a handoff note"];
    case "wake_me": return ["Setting a reminder", "Set a reminder"];
    case "cancel_wake": return ["Cancelling a reminder", "Cancelled a reminder"];
    case "lease": { const r = resourceOf(res.resource); return [`Reserving ${r}`, `Reserved ${r}`, `Couldn't reserve ${r}`]; }
    case "release": { const r = resourceOf(res.resource); return [`Freeing ${r}`, `Freed ${r}`]; }
    case "fetch_project_card": return ["Reading a project's card", "Read a project's card"];
    case "no_such_project": return ["Saying there's no such project", "Said there's no such project"];
    case "list_review": return ["Looking over what waits on you", "Looked over what waits on you"];
    case "annotate_review": return ["Adding a note to a question", "Added a note to a question"];
    default: return ["Working with XO", "Used an XO tool"];
  }
}

/** @param {Row} row @param {{ project?: string }} [ctx] */
export function commsLine(row, ctx) {
  const tool = commsTool(row);
  if (!tool) return null;
  const res = parse(row.summary);
  const w = words(tool, res, ctx);
  if (!w) return null;
  const lower = (/** @type {string} */ x) => x.charAt(0).toLowerCase() + x.slice(1);
  if (row.status === "running") return `${w[0]}…`;
  if (row.status === "denied") return `Not allowed: ${lower(w[0])}`;
  if (row.status === "cancelled") return `Stopped: ${lower(w[0])}`;
  const refused = typeof row.summary === "string" && /^This turn is closed\b/.test(row.summary);
  const failed = row.status === "error" || refused || res.ok === false || res.delivered === false || !!res.error;
  if (commsBusy(row) && typeof row.summary === "string") {
    const r = resourceOf(HELD.exec(row.summary)?.[1]);
    return `${r.charAt(0).toUpperCase()}${r.slice(1)} was in use`;
  }
  if (failed) return w[2] || `Didn't finish: ${lower(w[0])}`;
  if (RECEIPT[tool] && !RECEIPT[tool](res)) return w[3] || w[1];
  return w[1];
}

/** @param {Row[] | null | undefined} rows @param {{ project?: string }} [ctx] */
export function commsHeader(rows, ctx) {
  if (!rows || !rows.length || !rows.every((r) => commsTool(r))) return null;
  const all = rows.map((r) => commsLine(r, ctx)).filter(Boolean);
  const said = all.filter((l) => l !== "Nothing to add");
  if (!said.length) return all.length ? all[all.length - 1] : null;
  return said.slice(-2).join(" · ");
}

const STEP = /(?:call )?`([\w-]+)` on `xo_comms`/g;
/** @template T @param {T} s @param {{ project?: string }} [ctx] */
export function commsText(s, ctx) {
  if (!s || typeof s !== "string" || !s.includes("xo_comms")) return s;
  return s.replace(STEP, (_, tool, at) => {
    const w = words(tool, {}, ctx)[0];
    return at === 0 ? w : w.charAt(0).toLowerCase() + w.slice(1);
  });
}

/** @param {Row[] | null | undefined} rows */
export function commsPause(rows) {
  const wake = (rows || []).filter((r) => commsTool(r) === "wake_me" && r.status === "ok" && typeof r.summary === "string").pop();
  if (typeof wake?.summary !== "string") return null;
  const on = /"on": ?"([^"]+)"/.exec(wake.summary), at = /"at": ?"([^"]+)"/.exec(wake.summary);
  if (on) {
    const [ev, about] = on[1].split(/:(.*)/);
    if (ev === "lease_freed") return `Paused to wait for ${resourceOf(about)}`;
    if (ev === "task_done") return "Paused until another thread finishes";
    if (ev === "process_exited") return "Paused until a process finishes";
    if (ev === "pool_reopened") return "Paused until its usage limit lifts";
    return "Paused until it's woken";
  }
  const when = at && Date.parse(at[1]);
  if (Number.isFinite(when)) return `Paused until ${new Date(/** @type {number} */ (when)).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  return "Paused until it's woken";
}
