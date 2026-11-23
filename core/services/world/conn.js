// @ts-check
import { currentPools, mainRuntime } from "./sessions.js";
import { heldClock } from "./held.js";

/** @typedef {{mode?: string}} Routing */

/** @typedef {{name: string, cli?: {logged_in?: boolean}, error?: unknown}} Runtime */

/** @typedef {{projects?: {id: string, routing?: Routing}[], router?: Routing, statusCode?: string, errorCode?: string, error?: unknown, statusError?: unknown, conn?: string, runtimes?: Runtime[], pools?: Parameters<typeof currentPools>[0], loaded?: boolean}} Connection */

/** @type {Set<string | undefined>} */
const STORM_DOWN = new Set(["engine_not_running", "engine_elsewhere", "engine_failed", "store_refused", "store_failed", "stream_not_running"]);
/** @type {Record<string, string>} */
const CLI_NAME = { claude_code: "Claude", codex: "Codex", antigravity: "Antigravity" };
/** @param {string | null} [name] */
export const cliName = (name) => CLI_NAME[/** @type {string} */ (name)] || String(name || "The agent");

/** @param {{code?: string, status?: number} | null} err */
export function sendErrorTitle(err) {
  if (!err) return "Message not sent";
  if (err.code === "router_off") return "The router is off";
  if (err.code === "chat_retired") return "This project was removed";
  if (err.code === "auth_required") return "The agent isn't connected";
  if (err.code === "no_runtime") return "No agent can run this";
  if (err.code === "coordinator_busy") return "The coordinator is busy";
  if (err.code === "thread_not_found" || err.code === "session_retired") return "This thread is gone";
  if (STORM_DOWN.has(err.code)) return "XO's chat engine isn't running";
  if (err.code === "timeout") return "No answer from XO";
  if (err.status === 501) return "Not supported by this agent";
  if (err.status === 403) return "Refused by the proxy";
  if (err.status === 0 || err.status === 502) return "Can't reach XO";
  return "Message not sent";
}

/** @param {Connection | null} w @param {string | null} [pid] */
export function routingOf(w, pid = null) {
  const own = pid && (w && w.projects || []).find((p) => p.id === pid)?.routing;
  return own && own.mode ? own : (w && w.router) || null;
}
/** @param {Connection} w @param {string | null} pid */
function offLine(w, pid) {
  const r = routingOf(w, pid), own = pid && (w.projects || []).find((p) => p.id === pid)?.routing;
  if (!r || r.mode !== "off") return null;
  return own && own.mode ? { kind: "off", text: "Routing is off for this chat", sub: "new messages here are refused · replies in threads still work" }
    : { kind: "off", text: "The router is off", sub: "chats using it refuse new messages · replies in threads still work" };
}

/** @param {Connection | null} w @param {{pid?: string | null, thread?: boolean}} [opts] */
export function connLine(w, { pid = null, thread = false } = {}) {
  if (!w) return null;
  if (STORM_DOWN.has(w.statusCode) || STORM_DOWN.has(w.errorCode)) return { kind: "down", text: "XO's chat engine isn't running", sub: "retrying · nothing you write is lost" };
  if (w.error || w.statusError || w.conn === "down") return { kind: "down", text: "Can't reach XO", sub: "retrying · what you see may be out of date" };
  const rts = w.runtimes || [];
  if (rts.length && rts.every((r) => !r.cli || r.cli.logged_in === false || r.error)) {
    const r = /** @type {Runtime} */ (mainRuntime(rts));
    return { kind: "off", text: `${cliName(r.name)} isn't connected`, sub: "connect it in XO · sending waits until then" };
  }
  const off = thread ? null : offLine(w, pid);
  if (off) return off;
  const pools = currentPools(w.pools, rts);
  const closed = pools.find((p) => p.state === "closed");
  if (closed) return { kind: "wait", text: `Paused until ${heldClock(closed.resets_at)}`, sub: "usage limit · running work finishes, new work waits" };
  const paid = pools.find((p) => p.state === "paid");
  if (paid) return paid.reason === "paid_asked" || paid.reason == null
    ? { kind: "wait", text: "Paused for your choice", sub: "before paid usage · it's in Needs you" }
    : { kind: "wait", text: "Paused before paid usage", sub: "paid usage is set to Never · change it in Settings › Runtimes" };
  return null;
}

/** @param {Connection | null} w @param {{timeline?: boolean, pid?: string | null}} [opts] */
export function sendBlock(w, { timeline = true, pid = null } = {}) {
  if (!w) return "";
  if (STORM_DOWN.has(w.statusCode) || STORM_DOWN.has(w.errorCode)) return "XO's chat engine isn't running";
  if (w.error && !(w.projects && w.projects.length)) return "Can't reach XO right now";
  if (!w.loaded) return "Connecting to XO…";
  const rts = w.runtimes || [];
  if (rts.length && rts.every((r) => !r.cli || r.cli.logged_in === false || r.error)) return `${cliName((/** @type {Runtime} */ (mainRuntime(rts))).name)} isn't connected`;
  if (timeline) { const off = offLine(w, pid); if (off) return off.text; }
  return "";
}
