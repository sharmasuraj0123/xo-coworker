// @ts-check
import assert from "node:assert/strict";
import { setImmediate, setInterval, setTimeout } from "node:timers";
import { readFileSync } from "node:fs";
import { STONE, FLAVOURS } from "../../core/ui/flavours.js";
import { xi } from "../../core/ui/icons/icon.js";
import { ICON } from "../../core/ui/icons/names.js";
import { deferred, dom } from "../lib/dom.mjs";
import { checkSettingsPreferences } from "../lib/settings-preferences.mjs";
import { checkFeatureOwnership } from "../lib/feature-ownership.mjs";
import { checkConversationFileRoutes, projectChanges } from "../lib/conversation-file-routes.mjs";

const connectorReplies = JSON.parse(readFileSync(new URL("../../core/platform/tests/fixtures/connector-responses.json", import.meta.url)));
const { window, document } = await dom(readFileSync(new URL("../../index.html", import.meta.url), "utf8"));
const lastHomeVisit = Date.now() - 86_400_000;
const storage = new Map([
  ["cv-sound", "on"],
  ["cv-theme", "light"], ["cv-flavour", "onyx"], ["xo-seen", JSON.stringify({ home: lastHomeVisit, "p:demo": lastHomeVisit - 86_400_000 })],
]);
const blockedStorage = new Set();
const audioAccess = [];
for (const name of ["Audio", "AudioContext", "webkitAudioContext"]) {
  Object.defineProperty(globalThis, name, { configurable: true, get() { audioAccess.push(name); return undefined; } });
}
const sinceReads = [];
const settingsReads = new Map();
const runtimeWrites = [];
let heldRuntimes;
let heldRuntimeReads = 0;
const runtimeList = { runtimes: [{ name: "codex", cli: { logged_in: true } }, { name: "claude_code" }] };
let runtimePolicy = { allowed: ["codex", "claude_code"], preferences: null };
const chatTitleRead = deferred();
const initialChats = deferred();
const initialShape = deferred();
let shapeReads = 0;
let shapeWrites = 0;
/** @type {AbortSignal | undefined} */
let chatTitleSignal;
/** @type {Map<Element, (entries: { target: Element; isIntersecting: boolean }[]) => void>} */
const visibleChatTitles = new Map();
const githubRead = deferred();
const createGithubRead = deferred();
const createCloneWrite = deferred();
let createGithubSignal;
let createCloneSignal;
let createClonePolls = 0;

/** @type {AbortSignal | undefined} */
let githubSignal;
const artifactsRead = deferred();
/** @type {AbortSignal | undefined} */
let artifactsSignal;
const shellStatus = deferred();
/** @type {AbortSignal | undefined} */
let shellSignal;
let settingsStarted = false;
let phone = false;
let promptCount = 0;
/** @type {string[]} */
const modelReads = [];
const lateCatalog = deferred();
/** @type {AbortSignal | undefined} */
let catalogSignal;
const threadDeletes = [];
const threadResolves = [];
const outgoingPosts = new Map();
let holdRunRead = false;
let lateRunRead = deferred();
/** @type {AbortSignal | undefined} */
let runSignal;
let stormSignal;
const lateStatus = deferred();
let heldStatusSignal;
/** @type {ReadableStreamDefaultController<Uint8Array>} */
let stream;
const encoder = new TextEncoder();
const commands = Array.from({ length: 9 }, (_, i) => ({
  id: `command-${i + 1}`, kind: "background_command", title: `Command ${i + 1}`, state: "finished",
}));
const run = { id: "sub-agent", kind: "subagent", title: "Read the change", state: "finished", children: commands };
const streamBody = new ReadableStream({ start(controller) {
  stream = controller;
  stream.enqueue(encoder.encode("event: heartbeat\ndata: {}\n\n"));
} });
function retireChat() {
  const data = { type: "session", seq: 1, session_id: "plain-chat", data: { reason: "retired" } };
  stream.enqueue(encoder.encode(`id: 1\nevent: session\ndata: ${JSON.stringify(data)}\n\n`));
}
/** @type {string[]} */
const clipboard = [];
/** @type {Map<number, FrameRequestCallback>} */
const frames = new Map();
const shellRelocationObservers = new Set();
const threadDockObservers = new Set();
const mainFollowObservers = new Set();
const mainDecorationObservers = new Set();
const keyboardLayerObservers = new Set();
const resizeTargets = new WeakMap();
const stageLayoutObservers = new Set();
const historyCalls = [];
let historyState = null;
let nextFrame = 0;
function flushFrames() {
  for (const [id, frame] of [...frames]) if (frames.delete(id)) frame(performance.now());
}
const matches = window.Element.prototype.matches;
window.HTMLElement.prototype.scrollTo = function () {};
window.HTMLElement.prototype.getAnimations = function () { return []; };
const dialogPrototype = Object.getPrototypeOf(document.createElement("dialog"));
dialogPrototype.showModal = function () { this.open = true; };
dialogPrototype.close = function () { this.open = false; this.dispatchEvent(new window.Event("close")); };
const chipRects = window.HTMLElement.prototype.getClientRects;
window.HTMLElement.prototype.getClientRects = function () {
  if (this.id === "iq") return [{ width: 40, height: 20 }];
  return chipRects.call(this);
};
window.Element.prototype.matches = function (selector) {
  if (selector === ":focus-within") return this.contains(document.activeElement);
  if (selector === ":focus-visible") return this === document.activeElement;
  return matches.call(this, selector);
};
Object.assign(globalThis, {
  location: new URL("http://localhost/"),
  innerWidth: 1440,
  innerHeight: 900,
  history: {
    get state() { return historyState; },
    replaceState(state) { historyState = state; },
    pushState(state) { historyState = state; historyCalls.push("push"); },
    back() { historyCalls.push("back"); },
  },
  sessionStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
  localStorage: {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => {
      if (blockedStorage.has(key)) throw new DOMException("QuotaExceededError");
      storage.set(key, value);
    },
  },
  MutationObserver: class extends window.MutationObserver {
    observe(node, options) {
      if (node.id === "shd" && options.attributeFilter?.includes("hidden")) shellRelocationObservers.add(this);
      if (node.id === "keys" && options.attributeFilter?.includes("hidden")) keyboardLayerObservers.add(this);
      if (node.id === "typing" || node.id === "msgs") mainDecorationObservers.add(this);
      return super.observe(node, options);
    }
    disconnect() {
      shellRelocationObservers.delete(this);
      mainDecorationObservers.delete(this);
      keyboardLayerObservers.delete(this);
      return super.disconnect();
    }
  },
  ResizeObserver: class {
    constructor() { resizeTargets.set(this, new Set()); }
    observe(node) {
      resizeTargets.get(this).add(node.id);
      if (node.id === "tpdock") threadDockObservers.add(this);
      if (node.id === "column") mainFollowObservers.add(this);
      if (node.matches("#side, .stg-frames")) stageLayoutObservers.add(this);
    }
    disconnect() {
      resizeTargets.get(this).clear();
      threadDockObservers.delete(this);
      stageLayoutObservers.delete(this);
      mainFollowObservers.delete(this);
    }
  },
  IntersectionObserver: class {
    constructor(callback) { this.callback = callback; this.nodes = new Set(); }
    observe(node) {
      if (node.matches(".chl-row")) { this.nodes.add(node); visibleChatTitles.set(node, this.callback); }
    }
    unobserve(node) { this.nodes.delete(node); visibleChatTitles.delete(node); }
    disconnect() { for (const node of this.nodes) this.unobserve(node); }
  },
  customElements: window.customElements,
  isSecureContext: true,
  matchMedia: (query) => ({
    get matches() { return query === "(prefers-reduced-motion: reduce)" || (query === "(max-width: 760px)" && phone); },
    addEventListener() {}, removeEventListener() {},
  }),
  getComputedStyle: window.getComputedStyle,
  requestAnimationFrame: (fn) => {
    frames.set(++nextFrame, fn);
    return nextFrame;
  },
  cancelAnimationFrame: (id) => frames.delete(id),
  setInterval: (fn, ms) => setInterval(fn, ms).unref(),
  setTimeout: (fn, ms) => setTimeout(fn, ms).unref(),
  fetch: async (input, init) => {
    const { pathname: path, searchParams } = new URL(String(input), location.href);
    if (path === "/api/chat/shape") {
      if (init?.method === "PUT") { shapeWrites++; return Response.json({}); }
      shapeReads++;
      return initialShape.promise;
    }
    if (path === "/api/xo-projects/demo/changes") return Response.json(projectChanges);
    if (path === "/api/coworker/xo-projects/demo/paths") return Response.json({ root: "/demo", stamp: "v1", paths: ["notes.md"], dirs: [], truncated: false });
    const resource = path.split("/").at(-1);
    if (path === "/api/chat/stream") { stormSignal = init?.signal; return new Response(streamBody); }
    if (path === "/api/chat/status" && heldStatusSignal === null) {
      heldStatusSignal = init?.signal;
      return lateStatus.promise;
    }
    if (path === "/api/deploy/demo/check") return Response.json(connectorReplies.check);
    if (path === "/api/deploy/demo/preflight") return Response.json(connectorReplies.preflight);
    if (path === "/api/config/workspace") return Response.json({ default: "home", roots: { home: "/home/test" } });
    if (path === "/api/connectors/github/status") { createGithubSignal = init?.signal; return createGithubRead.promise; }
    if (path === "/api/xo-projects" && init?.method === "POST") {
      assert.equal(JSON.parse(init.body).wait, false);
      createCloneSignal = init.signal;
      return createCloneWrite.promise;
    }
    if (path.startsWith("/api/xo-projects/clones/")) {
      createClonePolls++;
      return Response.json({ detail: { code: "not_found", message: "Unexpected clone poll" } }, { status: 404 });
    }
    if (path === "/api/terminal/status") {
      shellSignal = init?.signal;
      return shellStatus.promise;
    }
    if (path === "/api/chat/prompt") {
      promptCount++;
      return Response.json({ message: "Temporary failure" }, { status: 500 });
    }
    if (path === "/api/chat/chats/project-chat/threads/boot-thread" && init.method === "DELETE") {
      threadDeletes.push(JSON.parse(init.body));
      return Response.json({ deleted: true });
    }
    if (path.startsWith("/api/chat/chats/project-chat/threads/") && init?.method === "PATCH") {
      const response = deferred();
      threadResolves.push({ thread: resource, body: JSON.parse(init.body), signal: init.signal, response });
      return response.promise;
    }
    if (path === "/api/chat/chats/project-chat/messages" && init?.method === "POST") {
      const response = deferred();
      outgoingPosts.set(JSON.parse(init.body).text, { signal: init.signal, response });
      return response.promise;
    }
    if (path === "/api/xo-projects/demo/github/issues") {
      githubSignal = init.signal;
      return githubRead.promise;
    }
    if (path === "/api/xo-projects/catalog-test/github/issues") {
      return Response.json({ project_id: "catalog-test", state: "empty", repo: null, fetched_at: null,
        issues: [], tracked: 0, untracked: 0, error: null });
    }
    if (path === "/api/chat/chats/project-chat/made") {
      artifactsSignal = init?.signal;
      return artifactsRead.promise;
    }
    if (path === "/api/chat/worktrees" || path === "/api/chat/rules") {
      const response = deferred();
      const pending = { response, signal: init.signal };
      if (resource === "worktrees" && !settingsStarted) sinceReads.push(pending);
      else settingsReads.set(resource, pending);
      return response.promise;
    }
    if (path === "/api/chat/chats") return (await initialChats.promise).clone();
    if (path === "/api/chat/chats/workspace-chat/messages") return Response.json({ messages: [{
      id: "first-workspace-reply", chat_id: "workspace-chat", author_kind: "owner", seq: 1,
      created_at: new Date(lastHomeVisit).toISOString(), text: "The first message in Workspace",
    }] });
    if (path === "/api/chat/runtimes") {
      if (heldRuntimes) { heldRuntimeReads++; return heldRuntimes.promise; }
      return Response.json(runtimeList);
    }
    if (path.startsWith("/api/chat/runtimes/") && resource === "models") {
      modelReads.push(path);
      if (path === "/api/chat/runtimes/claude_code/models") {
        catalogSignal = init?.signal;
        return lateCatalog.promise;
      }
      return Response.json({ models: [{ id: "codex-fixture", name: "Fixture Codex" }] });
    }
    if (path === "/api/chat/runtime-policy") {
      if (init?.method === "PUT") {
        const response = deferred();
        runtimeWrites.push({ body: JSON.parse(init.body), signal: init.signal, response });
        runtimePolicy = await response.promise;
      }
      return Response.json({ space: runtimePolicy, effective: runtimePolicy });
    }
    if (path === "/api/chat/chats/project-chat/threads") return Response.json({ threads: [
      { ts: "boot-thread", chat_id: "project-chat", title: "Thread from the panel", state: "working", session_id: "boot-session", pin: { model: "codex-fixture" }, runs: { total: 1 }, can_delete: true },
      { ts: "failed-thread", chat_id: "project-chat", title: "Review the draft", state: "failed" },
      { ts: "failed-late", chat_id: "project-chat", title: "Review the second draft", state: "failed" },
    ].map((thread) => ({ ...thread, created_at: new Date(lastHomeVisit).toISOString(), updated_at: new Date(lastHomeVisit).toISOString() })) });
    if (path === "/api/chat/chats/catalog-chat/threads") return Response.json({ threads: [
      { ts: "catalog-origin", chat_id: "catalog-chat", title: "First model composer", state: "working",
        session_id: "claude-session", session: { agent: "claude_code" } },
      { ts: "cmsg_catalog_next", chat_id: "catalog-chat", title: "Next model composer", state: "working", pin: { model: "held-model" } },
    ].map((thread) => ({ ...thread, created_at: new Date(lastHomeVisit).toISOString(), updated_at: new Date(lastHomeVisit).toISOString() })) });
    if (path === "/api/chat/chats/project-chat/messages" && searchParams.get("thread") === "boot-thread") {
      return Response.json({ messages: [{
        id: "queued-reply", chat_id: "project-chat", author_kind: "owner", seq: 4,
        created_at: new Date().toISOString(), text: "Read this next",
      }] });
    }
    if (path === "/api/chat/sessions") return Response.json({ sessions: [
      { id: "boot-session", agent: "codex" },
      { id: "claude-session", agent: "claude_code" },
      { id: "plain-chat", role: "plain", agent: "codex", title: "Draft ideas", created_at: new Date(lastHomeVisit).toISOString() },
      { id: "second-plain-chat", role: "plain", agent: "codex", native_id: "title-pending", created_at: new Date(lastHomeVisit).toISOString() },
    ] });
    if (path === "/api/messages/title-pending") {
      chatTitleSignal = init?.signal;
      return chatTitleRead.promise;
    }
    if (path === "/api/chat/sessions/plain-chat") return Response.json({ id: "plain-chat", role: "plain", agent: "codex" });
    if (path === "/api/chat/sessions/boot-session/runs") return Response.json({ runs: [run] });
    if (path === "/api/chat/runs/sub-agent") {
      if (!holdRunRead) return Response.json(run);
      runSignal = init.signal;
      return lateRunRead.promise;
    }
    if (path === "/api/advisory") return Response.json({ accounts: [] });
    if (path === "/api/chat/active") return Response.json({ turns: [] });
    if (path === "/api/chat/intent") return Response.json({ intents: [], pools: [] });
    if (path === "/api/chat/events") return Response.json({ events: [] });
    if (path === "/api/chat/runs/sub-agent/transcript") return Response.json({ items: [], next: null });
    if (path.startsWith("/api/chat/chats/")) {
      if (resource === "runtime-policy") return Response.json({ project: null, effective: runtimePolicy });
      if (resource === "made") return Response.json({ made: [], next_before: null });
      if (resource === "messages") return Response.json({ messages: [] });
      if (resource === "hops") return Response.json({ hops: [] });
    }
    return Response.json({});
  },
  EventSource: class { addEventListener() {} close() {} },
});
Object.defineProperty(navigator, "clipboard", { value: { writeText: async (text) => { clipboard.push(text); } } });
function setPhone(value) { phone = value; }
function setHoldRunRead(value) { holdRunRead = value; }
function setLateRunRead(value) { lateRunRead = value; }
function setHeldRuntimes(value) { heldRuntimes = value; }
function setSettingsStarted(value) { settingsStarted = value; }
function setHeldStatusSignal(value) { heldStatusSignal = value; }

export {
  document, assert, initialChats, setImmediate, flushFrames,
  window, xi, ICON, modelReads, visibleChatTitles,
  chatTitleSignal, chatTitleRead, promptCount, retireChat, setTimeout,
  clipboard, checkFeatureOwnership, STONE, FLAVOURS, storage,
  blockedStorage, phone, lastHomeVisit, artifactsSignal, setPhone,
  stream, encoder, catalogSignal, lateCatalog, threadDockObservers,
  resizeTargets, runSignal, lateRunRead, run, deferred,
  threadDeletes, setHoldRunRead, setLateRunRead, checkSettingsPreferences, checkConversationFileRoutes,
  runtimeWrites, heldRuntimes, heldRuntimeReads, runtimeList, settingsReads,
  sinceReads, githubSignal, shellSignal, setHeldRuntimes, setSettingsStarted,
  outgoingPosts, stageLayoutObservers, mainFollowObservers, mainDecorationObservers, keyboardLayerObservers,
  heldStatusSignal, stormSignal, shellRelocationObservers, threadResolves, frames,
  shapeReads, createGithubSignal, createCloneSignal, readFileSync, createCloneWrite,
  createGithubRead, initialShape, createClonePolls, shapeWrites, lateStatus,
  historyCalls, githubRead, connectorReplies, artifactsRead,
  shellStatus, audioAccess, setHeldStatusSignal,
};
