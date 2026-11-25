// @ts-check

const reads = [
  /^\/schedules(?:\/[^/]+(?:\/runs)?)?$/,
  /^\/xo-projects\/[^/]+\/(?:file|tree|versions|changes)$/,
  /^\/xo-projects\/clones\/[^/]+$/,
  /^\/coworker\/xo-projects\/[^/]+\/(?:paths|search)$/,
  /^\/config\/workspace$/,
  /^\/xo-projects\/[^/]+\/github\/(?:issues|pulls)(?:\/[^/]+)?$/,
];
const posts = [
  /^\/xo-projects$/,
  /^\/files\/mkdir$/,
  /^\/xo-projects\/[^/]+\/files\/(?:rename|delete|mkdir)$/,
  /^\/xo-projects\/[^/]+\/edits\/[^/]+\/undo$/,
];

/** @param {string} path @param {string} [method] */
export function hasCheckedProjectResponse(path, method = "GET") {
  switch (method.toUpperCase()) {
    case "GET": return reads.some((pattern) => pattern.test(path));
    case "POST": return posts.some((pattern) => pattern.test(path));
    case "PUT": return /^\/xo-projects\/[^/]+\/file$/.test(path);
    case "DELETE": return /^\/xo-projects\/clones\/[^/]+$/.test(path);
    default: return false;
  }
}

/** @param {string} path @param {string} [method] */
export function hasCheckedTerminalResponse(path, method = "GET") {
  const verb = method.toUpperCase();
  if (path === "/terminal/status") return verb === "GET";
  if (path === "/terminal/sessions") return verb === "GET" || verb === "POST";
  if (/^\/terminal\/sessions\/[^/]+\/attach$/.test(path)) return verb === "POST";
  return /^\/terminal\/sessions\/[^/]+$/.test(path) && ["GET", "PATCH", "DELETE"].includes(verb);
}

/** @param {string} path @param {string} [method] */
export function hasCheckedGithubAuthResponse(path, method = "GET") {
  const verb = method.toUpperCase();
  return verb === "GET" && path === "/connectors/github/status"
    || verb === "POST" && /^\/connectors\/github\/(?:disconnect|cli\/(?:start|poll|cancel))$/.test(path);
}

/** @param {string} path @param {string} [method] */
export function hasCheckedUploadResponse(path, method = "GET") {
  return method.toUpperCase() === "POST" && /^\/chat\/chats\/[^/]+\/attachments$/.test(path);
}

/** @param {string} path @param {string} [method] */
export function hasCheckedLaunchpadResponse(path, method = "GET") {
  switch (method.toUpperCase()) {
    case "GET": return /^\/deploy\/[^/]+\/(apps|check|preflight|watch)$/.test(path);
    case "POST": return /^\/deploy\/[^/]+(?:\/(link|agent))?$/.test(path);
    case "DELETE": return /^\/deploy\/[^/]+(?:\/link)?$/.test(path);
    default: return false;
  }
}

/** @param {string} path @param {string} [method] */
export function hasCheckedSignInResponse(path, method = "GET") {
  const verb = method.toUpperCase();
  return verb === "POST" && /^\/?connect\/(?:(?:claude-code|antigravity)(?:\/callback)?|codex)$/.test(path)
    || verb === "DELETE" && /^\/?connect\/claude-code$/.test(path);
}
