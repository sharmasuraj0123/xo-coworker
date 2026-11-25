// @ts-check

import { commsTool } from "./comms.js";

/** @type {Record<string, string>} */
const KIND_ICON = {
  create_file: "file-new", edit_file: "edit", delete_file: "delete", read: "eye", search: "search", list: "folder-open",
  command: "terminal", web_fetch: "web", web_search: "web", mcp: "plug", subagent: "agent", plan: "checklist", ask: "question",
  other: "wrench", notice: "info", error: "alert",
};
/** @type {[RegExp, string][]} */
const CMD_ICON = [
  [/^git\s+(?:-C\s+\S+\s+)?push\b/, "cloud-upload"], [/^git\s+(?:-C\s+\S+\s+)?commit\b/, "commit"], [/^gh\s+pr\b/, "pull-request"],
  [/^git\s+(?:-C\s+\S+\s+)?(?:merge|rebase|cherry-pick)\b/, "merge"],
  [/^(?:(?:npm|pnpm|yarn|bun)\s+(?:run\s+)?test|pytest|vitest|jest|node\s+--test|go\s+test|cargo\s+test)\b|^node\s+\S*\.test\.m?[jt]s\b/, "test-flask"],
  [/^(?:docker|docker-compose|podman)\b/, "container"], [/^(?:rm|rmdir|git\s+rm)\b/, "delete"], [/^(?:sed|perl)\s+(?:-\w+\s+)*-i/, "edit"],
  [/^(?:cat|tee|printf|echo)\b[^>]*(?:^|[^2&>])>{1,2}\s*(?!&|\/dev\/)\S/, "file-new"],
  [/^(?:curl|wget|http)\b/, "api"], [/^git\s+(?:-C\s+\S+\s+)?clone\b/, "download"],
  [/^(?:grep|egrep|rg|ag|ack|git\s+grep)\b/, "search"],
  [/^(?:cat|sed|head|tail|less|bat|nl|wc|jq|awk|xxd|od)\b/, "eye"],
  [/^(?:ls|find|fd|tree|du)\b/, "folder-open"],
  [/^git\s+(?:-C\s+\S+\s+)?(?:checkout|switch|branch|worktree)\b/, "branch"], [/^git\s+(?:-C\s+\S+\s+)?(?:diff|status|show)\b/, "diff"],
  [/^git\s+(?:-C\s+\S+\s+)?log\b/, "history"], [/^git\s+(?:-C\s+\S+\s+)?(?:pull|fetch)\b/, "download"],
];
/** Choose the strongest operation in a command chain. @param {unknown} cmd */
export function cmdIcon(cmd) {
  let best = CMD_ICON.length;
  for (const stage of String(cmd || "").replace(/<<-?\s*['"]?(\w+)['"]?([^\n]*)\n[\s\S]*?(?:\n\1\b|$)/g, "$2").split(/&&|\|\||;|\n/)) {
    const c = stage.split("|")[0].trim().replace(/^(?:sudo\s+|timeout\s+\S+\s+|\w+=\S*\s+)+/, "").replace(/^\(\s*/, "");
    const i = CMD_ICON.findIndex(([re]) => re.test(c));
    if (i >= 0 && i < best) best = i;
  }
  return best < CMD_ICON.length ? CMD_ICON[best][1] : "terminal";
}
/** @type {[RegExp, string][]} */
const TOOL_ICON = [
  [/todo|plan/i, "checklist"], [/worktree/i, "branch"], [/cron|schedule|wakeup|trigger|timer/i, "alarm"],
  [/skill/i, "wand"], [/toolsearch|search|find|grep/i, "search"], [/image/i, "image"], [/monitor|output|logs?$/i, "logs"],
  [/stop|kill/i, "stop"], [/agent|workflow|subagent/i, "agent"], [/message|send/i, "send"], [/permission/i, "lock"],
  [/browser|url|web/i, "web"], [/read|view/i, "eye"], [/write|edit|patch/i, "edit"],
];
/** @type {Record<string, string>} */
const COMMS_ICON = {
  message_thread: "send", message_coordinator: "send", message_coordinator_reply: "send", forward_to_project: "forward",
  ask: "question", ask_owner: "question", ask_workspace: "question", withdraw_ask: "undo", post_message: "chat", reply: "chat", react: "emoji",
  start_thread_session: "thread", continue_thread: "thread", stop_thread: "stop", report: "comment", handoff_note: "note", no_reply_needed: "minus-circle",
  update_status: "checklist", add_todo: "checklist", update_todo: "checklist", list_todos: "checklist", submit_result: "check-circle", set_thread_resolved: "check-circle",
  share_files: "share", wake_me: "alarm", cancel_wake: "bell-off", lease: "lock", release: "lock-open",
  create_job: "calendar-add", list_jobs: "calendar", cancel_job: "x-circle", set_goal: "flag", create_task: "plus-circle", propose_project: "project",
  rename_thread: "tag", set_thread_label: "tag", update_memory: "bookmark", read_memory: "eye", read_state: "eye", annotate_review: "highlighter", list_review: "list",
};
/** @type {[RegExp, string][]} */
const VERB_ICON = [[/^(?:read|view|show|look at|inspect|open|check)\b/i, "eye"], [/^(?:search|find|grep|look for|locate)\b/i, "search"], [/^list\b/i, "folder-open"], [/^(?:run|rerun)\b.*\btests?\b/i, "test-flask"]];
/** @param {[RegExp, string][]} list @param {string | null} [s] */
const nameIcon = (list, s) => (list.find(([re]) => re.test(s || "")) || [])[1];
/** @param {{ kind?: string | null, tool?: string | null, target?: string | null, line?: string | null, pending?: boolean }} [step] */
export function stepIcon({ kind, tool, target, line, pending } = {}) {
  if (pending && !kind && !tool) return "compose"; // still being written out: its tool isn't known yet
  const comms = commsTool({ tool: tool ?? undefined, target: target ?? undefined });
  if (comms) return COMMS_ICON[comms] || (/^(?:fetch|list)_/.test(comms) ? "eye" : "plug");
  if (kind === "command") { const c = cmdIcon(target); return c !== "terminal" ? c : nameIcon(VERB_ICON, String(line || "").replace(/[`*_]/g, "").trim()) || c; }
  if (kind && kind !== "other" && KIND_ICON[kind]) return KIND_ICON[kind];
  return nameIcon(TOOL_ICON, tool) || "wrench";
}
