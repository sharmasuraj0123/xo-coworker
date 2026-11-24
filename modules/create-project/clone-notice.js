// @ts-check

/** @import { CloneNotice, GitHubState, ProjectFailure } from "./read-types.d.ts" */

/** @import { Repo } from "./types.d.ts" */

/** @param {ProjectFailure} err @param {Repo} r @param {string} id @param {GitHubState} gh @returns {CloneNotice} */
export function cloneError(err, r, id, gh) {
  const code = err.code, host = r.github ? "GitHub" : r.label.split(/[/:]/)[0];
  const connectAction = { id: "connect", label: gh.status === "connected" ? "Reconnect GitHub" : "Connect GitHub" };
  switch (code) {
    case "project_exists": return [`There's already a project called “${id}”. Pick another name.`, null, "name"];
    case "invalid_repository_url": return ["Use owner/repo, or an HTTPS or SSH Git URL without a password or token.", null, "repo"];
    case "repo_not_found_or_private":
      if (r.github && gh.status !== "connected") return ["This repo is private, or doesn't exist.", connectAction, "repo"];
      return r.github
        ? [`GitHub has no repo there that @${gh.username || "you"} can see.`, null, "repo"]
        : ["There's no repository there that this server can reach.", null, "repo"];
    case "auth_failed":
      return r.github
        ? ["GitHub turned the connection down.", connectAction]
        : [`${host} turned this server's Git access down.`, null];
    case "host_unreachable": return [`Couldn't reach ${host}. Check the URL, or try again in a moment.`, null, "repo"];
    case "timed_out": return ["The clone stalled, so it stopped. Try again.", null];
    case "clone_in_progress": return [`“${id}” is already being cloned. It shows in Projects when it's done.`, null];
    case "too_many_clones": return ["Four clones are already running. Try again when one finishes.", null];
    case "clone_not_found": return ["XO restarted, so the clone stopped. Try again.", null];
    case "invalid_project_details": return [err.message, null, "name"];
  }
  if (r.github && gh.status !== "connected" && code === "clone_failed") return ["Couldn't clone it. Is it private?", connectAction, "repo"];
  return [err.detail ? `${err.message} (${err.detail})` : err.message, null];
}
