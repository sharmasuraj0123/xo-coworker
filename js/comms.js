// The team, visible: what an agent's XO tool call means, in people's words (design-research/2026-11-lg).
//
// Coordinators and threads work together through XO's comms tools (message_thread, message_coordinator,
// ask_workspace, forward_to_project, start_thread_session, …). The server reports each call as a step whose
// line is the tool's name ("`message_thread` on `xo_comms`"), so the conversation, the working bubble and
// the Map said nothing about the cooperation they were watching. This turns a step into what it is,
// from the call itself and nothing else: while it runs, what it is doing ("Talking to xo-space's
// coordinator"); once done, what it did ("Sent to “Experimental LG UI”", from the result the call returned).
// A target the call didn't name yet is said generally ("a thread"), never guessed. Unknown tools keep the
// server's own line.

let names = { thread: () => null, project: () => null, here: () => null };
/** app.js tells it how to name things: a thread's title by id, a project by chat id, the open conversation's project. */
export function nameWith(fns) { names = { ...names, ...fns }; }

const COMMS = /^(?:mcp__)?xo_comms(?:__|\/)([\w-]+)$/;
// What each sending tool returns when it worked (read from live results, 2026-11-08): its receipt. A result
// without one (a runtime that reports no result body, say) is said as written, never as sent.
const RECEIPT = {
  message_thread: (r) => r.delivered === true,
  message_coordinator: (r) => r.delivered === true || r.ok === true || !!r.hop_id,
  ask_workspace: (r) => r.asked === true || !!r.hop_id,
  forward_to_project: (r) => !!r.hop_id || !!r.project,
  post_message: (r) => !!r.message_id,
  reply: (r) => !!r.message_id,
};
/** The comms tool a step calls, or null. */
export function commsTool(row) {
  const m = COMMS.exec(String((row && (row.tool || row.target)) || ""));
  return m ? m[1] : null;
}
const parse = (s) => { if (!s || typeof s !== "string" || s[0] !== "{") return {}; try { return JSON.parse(s) || {}; } catch { return {}; } };
const q = (t) => (t ? `“${t}”` : "");

/** [in flight, done, failed] for a comms call; done words may name what the result returned. ctx.project: the
    project the calling agent works in (the Map shows several), else the open conversation's. */
function words(tool, res, ctx = {}) {
  const thread = res.thread_id ? names.thread(res.thread_id) : null;
  const t = thread ? q(thread) : "a thread";
  const here = ctx.project || names.here();
  const coord = here ? `the ${here} coordinator` : "its coordinator";
  const proj = res.project || (res.chat_id && names.project(res.chat_id)) || null;
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
    default: return null;
  }
}

/** A step's line in words (markdown-safe plain text), or null when it isn't a comms call we know.
    "Sent" means the call says it was delivered: a refused, cancelled or failed call, or a result that says
    it wasn't (ok:false, delivered:false, an error), says that instead. */
export function commsLine(row, ctx) {
  const tool = commsTool(row);
  if (!tool) return null;
  const res = parse(row.summary);
  const w = words(tool, res, ctx);
  if (!w) return null;
  const lower = (x) => x.charAt(0).toLowerCase() + x.slice(1);
  if (row.status === "running") return `${w[0]}…`;
  if (row.status === "denied") return `Not allowed: ${lower(w[0])}`;
  if (row.status === "cancelled") return `Stopped: ${lower(w[0])}`;
  const failed = row.status === "error" || res.ok === false || res.delivered === false || !!res.error;
  if (failed) return w[2] || `Didn't finish: ${lower(w[0])}`;
  // a message tool's success is its own receipt; without one (Codex drops the result body) it's said neutrally,
  // "Message to …", which claims neither delivery nor failure
  if (RECEIPT[tool] && !RECEIPT[tool](res)) return w[3] || w[1];
  return w[1];
}

/** A group header for steps that are all comms calls: what they did, the last two in order. */
export function commsHeader(rows, ctx) {
  if (!rows || !rows.length || !rows.every((r) => commsTool(r))) return null;
  const said = rows.map((r) => commsLine(r, ctx)).filter(Boolean).filter((l) => l !== "Nothing to add");
  if (!said.length) return null;
  // side by side, not "then": two calls may have run at once
  return said.slice(-2).join(" · ");
}
