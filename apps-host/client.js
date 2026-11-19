// @ts-check

/** @typedef {(path: string, opts?: { method?: string, body?: unknown, query?: Record<string, unknown>, headers?: Record<string, string> | null, timeout?: number, signal?: AbortSignal }) => Promise<any>} Request @typedef {{ git: string, ref?: string } | { path: string }} Source @typedef {{ project: string, thread?: string }} Where @typedef {ReturnType<typeof createAppsClient>} AppsClient */

const APP_ID = /^[a-z0-9][a-z0-9-]*(\.[a-z0-9][a-z0-9-]*)+$/;
const TOKEN = /^[A-Za-z0-9_-]{1,128}$/;
const HTTPS_GIT = /^https:\/\/[a-z0-9.-]+(:\d+)?\/[A-Za-z0-9._~\/-]+$/;

/** @param {string} id */
const checked = (id) => {
  if (!APP_ID.test(id)) throw new Error(`"${id}" isn't an app id`);
  return id;
};
const app = (/** @type {string} */ id) => `/api/apps/${checked(id)}`;
const live = (/** @type {string} */ id) => `/api/coworker/apps/${checked(id)}`;
/** @param {string} v @param {string} what */
const token = (v, what) => {
  if (!TOKEN.test(v)) throw new Error(`"${v}" isn't a ${what}`);
  return v;
};
/** @param {Where} at @returns {Record<string, string>} */
const stamp = (at) => {
  /** @type {Record<string, string>} */
  const h = { "X-XO-Project": token(at.project, "project id") };
  if (at.thread) h["X-XO-Thread"] = token(at.thread, "thread id");
  return h;
};

/** @param {Source} source */
function checkSource(source) {
  if ("git" in source) {
    if (!HTTPS_GIT.test(source.git)) throw new Error("A repo is an https address, like https://github.com/me/xo-word");
    if (source.ref !== undefined && !/^[A-Za-z0-9._][A-Za-z0-9._\/-]{0,99}$/.test(source.ref)) throw new Error("A ref is a tag, branch or commit");
    return { kind: "git", url: source.git, ...(source.ref ? { ref: source.ref } : {}) };
  }
  if (typeof source.path !== "string" || !source.path.startsWith("/") || source.path.split("/").includes("..")) throw new Error("A folder is an absolute path on this machine");
  return { kind: "folder", path: source.path };
}

/** The one way apps-host reaches xo-space's app routes; request is core/platform's http request. @param {Request} request */
export function createAppsClient(request) {
  return {
    contract: () => request("/api/apps/contract"),
    list: () => request("/api/apps"),
    get: (/** @type {string} */ id) => request(app(id)),
    stage: (/** @type {Source} */ source) => request("/api/apps/installs", { method: "POST", body: { source: checkSource(source) } }),
    staged: (/** @type {string} */ stagingId) => request(`/api/apps/installs/${token(stagingId, "staging id")}`),
    confirm: (/** @type {string} */ stagingId, /** @type {string} */ sha256) => {
      if (!/^[0-9a-f]{64}$/.test(sha256)) throw new Error("the staged package's sha256 is missing");
      return request(`/api/apps/installs/${token(stagingId, "staging id")}/confirm`, { method: "POST", body: { sha256 } });
    },
    update: (/** @type {string} */ id, /** @type {Source | undefined} */ source = undefined) => request(`${app(id)}/update`, { method: "POST", body: source ? checkSource(source) : {} }),
    rollback: (/** @type {string} */ id) => request(`${app(id)}/rollback`, { method: "POST" }),
    remove: (/** @type {string} */ id, { deleteData = false } = {}) => request(app(id), { method: "DELETE", body: { delete_data: !!deleteData } }),
    grant: (/** @type {string} */ id, /** @type {string} */ project) => request(`${app(id)}/grants`, { query: { project: token(project, "project id") } }),
    setGrant: (/** @type {string} */ id, /** @type {string} */ project, /** @type {{ state: "enabled", permissions?: Array<{ cap: string, paths: string[], names: string[] }>, routes?: string[] }} */ grant) =>
      request(`${app(id)}/grants`, { method: "PUT", query: { project: token(project, "project id") }, body: grant }),
    revoke: (/** @type {string} */ id, /** @type {string} */ project) => request(`${app(id)}/grants`, { method: "PUT", query: { project: token(project, "project id") }, body: { state: "disabled" } }),
    approval: (/** @type {string} */ approvalId) => request(`/api/apps/approvals/${token(approvalId, "approval id")}`),
    stop: (/** @type {string} */ id) => request(`${app(id)}/stop`, { method: "POST" }),
    start: (/** @type {string} */ id) => request(`${app(id)}/start`, { method: "POST" }),
    activity: (/** @type {string} */ id) => request(`${app(id)}/activity`),
    settings: (/** @type {string} */ id, /** @type {string} */ project) => request(`${app(id)}/settings`, { query: { project: token(project, "project id") } }),
    saveSettings: (/** @type {string} */ id, /** @type {string} */ project, /** @type {Record<string, unknown>} */ values) =>
      request(`${app(id)}/settings`, { method: "PUT", query: { project: token(project, "project id") }, body: { values } }),
    resource: (/** @type {string} */ id, /** @type {string} */ uri, /** @type {Where} */ at) => {
      if (!uri.startsWith(`ui://${id}/`)) throw new Error("an app reads only its own views");
      return request(`${live(id)}/resources`, { query: { uri }, headers: stamp(at) });
    },
    call: (/** @type {string} */ id, /** @type {Where} */ at, /** @type {string} */ tool, /** @type {unknown} */ args, { confirm = false } = {}) =>
      request(`${live(id)}/call`, { method: "POST", headers: stamp(at), body: { project: at.project, thread: at.thread, tool, arguments: args ?? {}, ...(confirm ? { confirm: "destructive" } : {}) } }),
    prompt: (/** @type {string} */ id, /** @type {Where} */ at, /** @type {string} */ name) => request(`${live(id)}/prompts/${token(name, "prompt name")}`, { headers: stamp(at) }),
    viewOpened: (/** @type {string} */ id, /** @type {Where} */ at, /** @type {string} */ view) => request(`${live(id)}/views/open`, { method: "POST", headers: stamp(at), body: { view } }),
    viewAlive: (/** @type {string} */ id, /** @type {Where} */ at, /** @type {string} */ view) => request(`${live(id)}/views/heartbeat`, { method: "POST", headers: stamp(at), body: { view } }),
    viewClosed: (/** @type {string} */ id, /** @type {Where} */ at, /** @type {string} */ view) => request(`${live(id)}/views/close`, { method: "POST", headers: stamp(at), body: { view } }),
  };
}
