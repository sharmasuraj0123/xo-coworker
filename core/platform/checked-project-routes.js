// @ts-check

const reads = [
  /^\/schedules(?:\/[^/]+(?:\/runs)?)?$/,
  /^\/xo-projects\/[^/]+\/(?:file|tree|versions|changes)$/,
  /^\/xo-projects\/clones\/[^/]+$/,
  /^\/coworker\/xo-projects\/[^/]+\/(?:paths|search)$/,
  /^\/config\/workspace$/,
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
