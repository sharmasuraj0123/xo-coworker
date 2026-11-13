// The team, visible: what an agent's XO tool call means, in people's words (design-research/2026-11-lg).
//
// Coordinators and threads work together through XO's comms tools (message_thread, message_coordinator,
// ask_workspace, forward_to_project, start_thread_session, …). The server reports each call as a step whose
// line is the tool's name ("`message_thread` on `xo_comms`"), so the conversation, the working bubble and
// the Map said nothing about the cooperation they were watching. This turns a step into what it is,
// from the call itself and nothing else: while it runs, what it is doing ("Talking to xo-space's
// coordinator"); once done, what it did ("Sent to “Experimental LG UI”", from the result the call returned).
// A target the call didn't name yet is said generally ("a thread"), never guessed. A comms tool this file
// doesn't know yet is said generally too ("Working with XO"): the tool's name is never the line.

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

/** A leased resource in words: the browser seat (whatever the lease is called), else its own name. */
const resourceOf = (name) => (!name ? "a shared resource" : /browser/i.test(name) ? "the browser" : `“${name}”`);
// what XO answers a lease another session holds: "headless-browser-suite is held by session cse_… since …"
const HELD = /^(\S+) is held by\b/;
/** A lease refused because another session holds it: the agent waits its turn (it can ask to be woken when
    it frees), so this is routine, not a failure to show in red. */
export function commsBusy(row) {
  return commsTool(row) === "lease" && row.status === "error" && typeof row.summary === "string" && HELD.test(row.summary);
}

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
    // the tools XO added since (storm comms/tools.py, read 2026-11-13): every one has words, so the server's
    // "`ask` on `xo_comms`" never reaches the conversation, the typing line or the Map
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
    // one XO adds later: said generally, never as the tool's name
    default: return ["Working with XO", "Used an XO tool"];
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
  // a call made after the agent ended its turn did nothing (XO refuses it: "This turn is closed, …")
  const refused = typeof row.summary === "string" && /^This turn is closed\b/.test(row.summary);
  const failed = row.status === "error" || refused || res.ok === false || res.delivered === false || !!res.error;
  if (commsBusy(row)) { const r = resourceOf(HELD.exec(row.summary)[1]); return `${r.charAt(0).toUpperCase()}${r.slice(1)} was in use`; }
  if (failed) return w[2] || `Didn't finish: ${lower(w[0])}`;
  // a message tool's success is its own receipt; without one (Codex drops the result body) it's said neutrally,
  // "Message to …", which claims neither delivery nor failure
  if (RECEIPT[tool] && !RECEIPT[tool](res)) return w[3] || w[1];
  return w[1];
}

/** A group header for steps that are all comms calls: what they did, the last two in order. */
export function commsHeader(rows, ctx) {
  if (!rows || !rows.length || !rows.every((r) => commsTool(r))) return null;
  const all = rows.map((r) => commsLine(r, ctx)).filter(Boolean);
  const said = all.filter((l) => l !== "Nothing to add");
  // a group that only ended the turn says so, not the server's "Used a tool"
  if (!said.length) return all.length ? all[all.length - 1] : null;
  // side by side, not "then": two calls may have run at once
  return said.slice(-2).join(" · ");
}

const STEP = /(?:call )?`([\w-]+)` on `xo_comms`/g;
/** A server line with an XO comms call in it ("`ask` on `xo_comms`", a group header or a stopped turn's last
    step) in words: each call becomes what it was doing ("Asking a question"). Anything else stays as it is. */
export function commsText(s, ctx) {
  if (!s || typeof s !== "string" || !s.includes("xo_comms")) return s;
  return s.replace(STEP, (_, tool, at) => {
    const w = words(tool, {}, ctx)[0];
    return at === 0 ? w : w.charAt(0).toLowerCase() + w.slice(1);
  });
}

/** Why a turn the agent ended itself is only a pause: the wake it set before it stopped (wake_me), in words
    ("Paused to wait for the browser"), or null when it set none. Read from the call's result, which the
    runtime may have shortened mid-way, so by its fields rather than as JSON. */
export function commsPause(rows) {
  const wake = (rows || []).filter((r) => commsTool(r) === "wake_me" && r.status === "ok" && typeof r.summary === "string").pop();
  if (!wake) return null;
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
  if (Number.isFinite(when)) return `Paused until ${new Date(when).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  return "Paused until it's woken";
}
