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
/** The comms tool a step calls, or null. */
export function commsTool(row) {
  const m = COMMS.exec(String((row && (row.tool || row.target)) || ""));
  return m ? m[1] : null;
}
const parse = (s) => { if (!s || typeof s !== "string" || s[0] !== "{") return {}; try { return JSON.parse(s) || {}; } catch { return {}; } };
const q = (t) => (t ? `“${t}”` : "");

/** [running words, done words] for a comms call; done words may name what the result returned. */
function words(tool, res) {
  const thread = res.thread_id ? names.thread(res.thread_id) : null;
  const t = thread ? q(thread) : "a thread";
  const here = names.here() || "its project";
  const proj = res.project || (res.chat_id && names.project(res.chat_id)) || null;
  switch (tool) {
    case "message_thread": return ["Talking to a thread", res.delivery === "steer" || res.turn_running ? `Sent to ${t} while it works` : `Sent to ${t}`];
    case "start_thread_session": return ["Starting a thread", res.ok === false && res.error === "thread_exists" ? `${t} was already running` : `Started ${t}`];
    case "message_coordinator": return [`Talking to the ${here} coordinator`, `Sent to the ${here} coordinator`];
    case "ask_workspace": return ["Talking to the Workspace coordinator", "Asked the Workspace coordinator"];
    case "forward_to_project": return [`Talking to ${proj ? `the ${proj}` : "a project's"} coordinator`, `Sent to ${proj ? `the ${proj}` : "a project's"} coordinator`];
    case "ask_owner": return ["Asking you", "Asked you"];
    case "post_message": case "reply": return ["Writing to you", "Wrote to you"];
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

/** A step's line in words (markdown-safe plain text), or null when it isn't a comms call we know. */
export function commsLine(row) {
  const tool = commsTool(row);
  if (!tool) return null;
  const res = parse(row.summary);
  const w = words(tool, { ...res, ok: row.status === "error" ? false : res.ok });
  if (!w) return null;
  if (row.status === "running") return `${w[0]}…`;
  if (row.status === "error") return `Couldn't: ${w[0].charAt(0).toLowerCase()}${w[0].slice(1)}`;
  return w[1];
}

/** A group header for steps that are all comms calls: what they did, the last two in order. */
export function commsHeader(rows) {
  if (!rows || !rows.length || !rows.every((r) => commsTool(r))) return null;
  const said = rows.map(commsLine).filter(Boolean).filter((l) => l !== "Nothing to add");
  if (!said.length) return null;
  const last = said.slice(-2);
  return last.length === 2 ? `${last[0]}, then ${last[1].charAt(0).toLowerCase()}${last[1].slice(1)}` : last[0];
}
