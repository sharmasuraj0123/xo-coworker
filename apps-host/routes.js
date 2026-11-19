// @ts-check

/** @typedef {{ method: string, template: string, parts: string[] }} Route */

export const METHODS = Object.freeze(["GET", "POST", "PUT", "PATCH", "DELETE"]);

const FLOOR_PREFIX = Object.freeze([
  "/api/secrets", "/api/config", "/api/runtime-config", "/api/terminal", "/api/schedules", "/api/deploy",
  "/api/connectors", "/api/connections", "/api/files", "/api/apps", "/api/doctor", "/api/chat/rules", "/api/chat/intent",
  "/api/agents", "/api/coworker", "/mcp", "/claude", "/connect", "/auth", "/update",
]);
/** @type {ReadonlyArray<[string, RegExp]>} */
const FLOOR_MATCH = Object.freeze([
  ["*", /\/secrets?(\/|$)/],
  ["*", /\/reveal(\/|$)/],
  ["*", /^\/api\/chat\/review\/[^/]+\/decision$/],
  ["*", /\/restore$/],
  ["*", /\/edits\/[^/]+\/undo$/],
  ["DELETE", /^\/api\/chat\//],
  ["*", /^\/api\/xo-projects\/[^/]+\/files\/delete$/],
]);
const SEGMENT = /^[A-Za-z0-9._~:@!$&'()*+,;=-]+$/;
const PARAM = /^\{[a-z_][a-z0-9_]*\}$/;

/** True for a route no app may reach, whatever it declares or was granted. @param {string} method @param {string} path */
export function onFloor(method, path) {
  const p = path.toLowerCase();
  if (FLOOR_PREFIX.some((f) => p.startsWith(f))) return true;
  if (!p.startsWith("/api/")) return true;
  return FLOOR_MATCH.some(([m, re]) => (m === "*" || m === method) && re.test(p));
}

/** A manifest route like "POST /api/chat/chats/{chat_id}/messages", or the reason it isn't one. @param {unknown} text @returns {Route | string} */
export function parseRoute(text) {
  if (typeof text !== "string") return "a route must be text like \"GET /api/chat/status\"";
  const m = /^([A-Z]+) (\/\S*)$/.exec(text);
  if (!m) return `"${text}" must look like "GET /api/chat/status"`;
  const [, method, template] = m;
  if (!METHODS.includes(method)) return `"${text}": ${method} isn't a method apps can use`;
  const parts = template.split("/").slice(1);
  if (!parts.length || parts.some((s) => !(PARAM.test(s) || (SEGMENT.test(s) && s !== "." && s !== "..")))) return `"${text}" isn't a clean path template`;
  const probe = "/" + parts.map((s) => (PARAM.test(s) ? "x" : s)).join("/");
  if (onFloor(method, probe)) return `"${text}" is a route XO never opens to apps (secrets, raw files, settings, decisions or app management)`;
  return { method, template, parts };
}
