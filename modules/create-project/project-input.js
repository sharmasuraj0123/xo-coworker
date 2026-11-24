// @ts-check
import { ApiError } from "../../core/platform/http.js";

/** @param {unknown} error @returns {import("./read-types").ProjectFailure} */
export function projectFailure(error) {
  if (!(error instanceof Error)) return { message: String(error) };
  return {
    message: error.message,
    status: error instanceof ApiError ? error.status : undefined,
    code: "code" in error && typeof error.code === "string" ? error.code : undefined,
    detail: "detail" in error && typeof error.detail === "string" ? error.detail : undefined,
  };
}

/** @param {unknown} name */
export function slugify(name) {
  return String(name || "").normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48);
}

// GitHub as Space reads it: any page of a repo names the repo; owner/repo alone does too
const GH_PAGE = new RegExp(
  /^(?:https?:\/\/)?(?:www\.)?github\.com\/([A-Za-z0-9][A-Za-z0-9-]{0,38})\//.source +
  /([A-Za-z0-9._-]{1,100}?)(?:\.git)?(?:\/[^?#]*)?(?:[?#].*)?$/.source, "i",
);
const GH_SHORT = /^([A-Za-z0-9][A-Za-z0-9-]{0,38})\/([A-Za-z0-9._-]{1,100}?)(?:\.git)?\/?$/;

/** @param {unknown} raw @returns {import("./types").Repo | null} */
export function parseRepo(raw) {
  const v = String(raw || "").trim();
  if (!v || /\s/.test(v)) return null;
  const gh = v.match(GH_PAGE) || v.match(GH_SHORT);
  if (gh && !/^\.+$/.test(gh[2])) {
    const label = `${gh[1]}/${gh[2]}`;
    return { url: `https://github.com/${label}.git`, label, name: gh[2], github: true };
  }
  const ssh = v.match(/^git@([A-Za-z0-9.-]+):([A-Za-z0-9._/-]+?)(?:\.git)?$/);
  // GitHub's SSH form clones over HTTPS, so the GitHub connection (not this server's SSH keys) opens it
  if (ssh && ssh[1] === "github.com" && /^[A-Za-z0-9-]+\/[A-Za-z0-9._-]+$/.test(ssh[2])) return parseRepo(ssh[2]);
  if (ssh) {
    const [, host, path] = ssh;
    const github = host === "github.com";
    return { url: v, label: github ? path : `${host}:${path}`, name: path.split("/").pop(), github };
  }
  try {
    const u = new URL(v);
    const path = u.pathname.replace(/\/+$/, "").replace(/\.git$/, "");
    if (!/^(https|ssh):$/.test(u.protocol) || u.password || (u.username && u.protocol === "https:") || u.search || u.hash) return null;
    if (path.split("/").filter(Boolean).length < 1) return null;
    return { url: v, label: `${u.host}${path}`, name: path.split("/").pop(), github: false };
  } catch { return null; }
}
