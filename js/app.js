import { createWorld, esc, WAITING } from "./world.js";
import { copyText, COPY_REFUSED, clock, dayOf, short, busyAttrs } from "../core/platform/index.js";
import { redraw } from "../core/ui/redraw.js";
import { patch } from "../core/ui/patch.js";
import "./dropdown.js"; // <xo-select>: the one dropdown, in place of the browser's <select>
import { renderMarkdown, renderInline, setThreadInfo, setWebImages } from "./markdown.js";
import * as Kit from "../modules/decisions/kit.js";
import * as K from "../core/platform/keys.js";
import { createDecisions } from "./decide.js";
import { createPacing } from "../modules/decisions/pacing.js";
import { createIntel } from "../modules/chats/intel.js";
import { EFFORT, evidenceFor } from "../modules/decisions/rank.js";
import { ICON, stepMark, stateMark, XO, $, RM, reconcile, wait, hold, morph, expand } from "./ui.js";
import { sound } from "../core/services/sound.js";
import { stopWords, uiMsg, forwardOrigin, echoes, threadAnchors, connLine, plainText, hopLine, relayedInto, waitsForTurn, hopNotes, reactionGroups, pageFloor, inPage, canPageOlder, heldWords, heldShort, heldBadge } from "./timeline.js";
import { turnHtml, turnAv, turnSegments, segmentTurn, stepLineHtml } from "./turnview.js";
import { nameWith } from "../core/services/comms.js";
import { mediaHtml, fromAttachment, fromSharedFile, hydrateMedia, viewerFile, wireDragOut, webImagesHtml } from "./media.js";
// math and diagrams in a reply, drawn between keystrokes (KaTeX, Mermaid: vendored, loaded only when needed)
import { startRich } from "./rich.js";
import { createLightbox } from "./lightbox.js";
import { createRunsPanel } from "../modules/runs/panel.js";
import { createRunsOpener } from "../modules/runs/controller.js";
import { createRunsReads } from "../modules/runs/read.js";
import { createRunsStrip } from "../modules/runs/strip.js";
import { createRunsStop } from "../modules/runs/stop.js";
import { createSettings } from "./settings.js";
import { createRuntimeSettings } from "../modules/runtimes/settings.js";
import { createChats } from "./chats.js";
import { initFollow, toLatest, toTop, unpin, isPinned, fromTop, toRow, fromLatest, createFollow } from "../modules/conversation/follow.js";
import { createTyping } from "../modules/conversation/typing.js";
import { createDrafts, DRAFTS } from "../modules/conversation/drafts.js";
import { createReadingLayout } from "../modules/conversation/reading-layout.js";
import { createConversationStops } from "../modules/conversation/stops.js";
import { createDelivery } from "../modules/conversation/delivery.js";
import { createComposerTarget } from "../modules/conversation/target.js";
import { tickElapsed } from "../shell/elapsed.js";
import { headOf, goneLine } from "../modules/decisions/cardparts.js";
import { createAccounts } from "../modules/settings/accounts.js";
import { decorateConversation } from "./msgx.js";
import { createViewer } from "./viewer.js";
import { createMap } from "../modules/map/map.js";
import { createStage } from "../shell/panel/panel.js";
import { createSide } from "../shell/rail/side.js";
import { kernel } from "../shell/kernel.js";
import { headerActionsHtml, wireHeaderActions } from "../shell/header.js";
import { createTopHeader } from "../shell/top-header.js";
import { createWorkspaceHeader } from "../shell/workspace-header.js";
import { stackLayers } from "../shell/layers.js";
import { wireBack } from "../shell/back.js";
import { createBackSteps } from "../shell/back-steps.js";
import { createNavigation } from "../shell/navigation.js";
import { createReturnPill } from "../shell/return-pill.js";
import { createDecisionPings } from "../shell/decision-pings.js";
import { createShellRenderer, createShellScheduler } from "../shell/render.js";
import { createDrawer } from "../shell/phone.js";
import { drawPlaceIcons, drawFrameIcons } from "../shell/frame-icons.js";
import { startShell } from "../shell/start.js";
import { createLaunchpad } from "../modules/launchpad/launchpad.js";
import { createLpApi } from "../modules/launchpad/client.js";
import { createFiles } from "../modules/files/files.js";
import { createConversationFiles } from "../modules/files/conversation-files.js";
import { createMediaOpener } from "../modules/files/open-media.js";
import { fileScope, localIn } from "../modules/files/scope.js";
import { filePlace } from "../modules/files/search-place.js";
import { createPaths } from "../core/services/paths.js";
import { createQuickOpen } from "../modules/search/quickopen.js";
import { createJump } from "../modules/search/jump.js";
import { createJumpItems } from "../modules/search/jump-items.js";
import { createFilesPage } from "../modules/files/page.js";
import { createChanges, lineRef, fileRef } from "../modules/changes/store.js";
import { createSavedSoon } from "../modules/changes/saved.js";
import { createRowResolve } from "../modules/threads/row-resolve.js";
import { createThreadResolve } from "../modules/threads/resolve.js";
import { createThreadGroups } from "../modules/threads/groups.js";
import { threadsCtl } from "../modules/threads/header.js";
import { createAllThreads } from "../modules/threads/all.js";
import { createThreadMenu } from "../modules/threads/menu.js";
import { createThreadDeleteView } from "../modules/threads/delete-view.js";
import { createThreadDelete } from "../modules/threads/delete.js";
import { createThreadEditing, threadTitleInput, threadLabelInput } from "../modules/threads/editing.js";
import { createPanelThreadOpener } from "../modules/threads/open-panel-thread.js";
import { createLpWindow } from "../modules/launchpad/window.js";
import { createLpPage } from "../modules/launchpad/page.js";
import { createGhPage } from "../modules/github/page.js";
import { fileIcon } from "./fileicons.js";
import { setTheme as setDiffTheme } from "../modules/changes/diffview.js";
import { createChangesFrame } from "../modules/changes/frame.js";
import { createTray, fmtSize, kindOf, isLargePaste, pasteLabel, uploadErrorText, FINAL, MAX_FILES } from "./attach.js";
import { api, uploadAttachment } from "../core/platform/api.js";
import { initCreate } from "../modules/create-project/create.js";
import { createProjectIconPicker } from "../modules/projects/icon-picker.js";
import { createProjectIconChoice } from "../modules/projects/icon-choice.js";
import { createShells } from "../modules/shells/dock.js";
import { createShellPanel } from "../modules/shells/panel.js";
import { createRecord } from "./recordview.js";
import { createRecordLines } from "../modules/chats/record-lines.js";
import { createHomeParts } from "../modules/home/parts.js";
import { createOpenNext } from "../modules/home/open-next.js";
import { createNextCard } from "../modules/home/next-card.js";
import { createHandled } from "../modules/home/handled.js";
import { createHomeView } from "../modules/home/view.js";
import { greeting, today } from "../modules/home/skeleton.js"; // Home's shell, drawn before this module graph arrives
import { wireGestures, dockGestures, conversationGestures } from "./gestures.js";
import { rtName, untilWords } from "../core/services/runtimes.js";
import { createThreadRuntime } from "../modules/runtimes/thread.js";
// the UI's shape per person: which surfaces show, in what order, how dense, in which words (core/services/shape)
import { createShapeStore } from "../core/services/shape/index.js";
import { createSettingsFrame, createSettingsSections, createKeysPage, createShapeView, SHAPE_IC } from "../modules/settings/index.js";
import { keysSheetRender } from "../modules/settings/keys-sheet.js";
import { setWorkMode } from "./turnview.js";
import { radioKeys, menuKeys, focusOpened } from "./keynav.js";
import { createHerald, noticeFor } from "../core/services/notices.js";
import { createSideRows } from "../shell/rail/rows.js";
import { createAnnouncer } from "../core/ui/a11y/announce.js";
import { wireAppearance, wireChatBubbles, wireMessageHops, wireWebPictures } from "../modules/settings/appearance.js";
import { createDeviceNotice } from "../modules/settings/device-notice.js";
import { wireSound } from "../modules/settings/sound.js";
import { createShapeApply } from "../modules/settings/apply-shape.js";
import { createTheme, wireThemeToggle } from "../core/ui/theme.js";
import { regionRings } from "./ring.js";
import { keepFocusInView, usable } from "./focusview.js";

const world = createWorld();
const schedule = createShellScheduler(() => render());
// what the backend can do, asked each time (a surface that needs a missing one stays away); filled in below
const CAP = {};
// mine is Storm's where it keeps shapes (GET/PUT /api/chat/shape): read on load, written only on your change,
// another device's change heard on the stream; a conflict or a write that didn't land is said in the herald
const SHAPE = createShapeStore({
  caps: { has: (c) => !CAP[c] || CAP[c]() },
  remote: { get: () => api.shape(), put: (body) => api.putShape(body) },
  notice: (h) => heraldShow({ kind: "calm", ...h }, 6000),
});
world.onEvent((e) => { if (e.kind === "shape") SHAPE.heard(e.value); });
// pictures from the web in an agent's words (markdown's ![alt](https://…)) show like shared ones, unless this
// device's "Show pictures from the web" is off (the shape's xo:conversation/webpics): then they're links
const WEBPICS = "xo:conversation/webpics";
// A picture in the conversation's own folder (![alt](plots/fit.png)) always shows: it's the agent's own work, read
// from XO, not from a site; it's found the way a shared file is (fileRoute), else it's a card saying why it can't open.
setWebImages((list) => {
  const web = list.filter((x) => x.url), files = list.filter((x) => x.file);
  if (web.length && !SHAPE.on(WEBPICS)) return null;
  const own = files.map((x) => fromSharedFile({ path: x.file, name: x.file.split("/").pop(), title: x.alt || null }, { route: fileRoute }));
  if (!web.length) return mediaHtml(own, { side: "them" });
  return own.length ? mediaHtml(own, { side: "them" }) + webImagesHtml(web) : webImagesHtml(web);
});
startRich();
/** A noun in the shape's words (HTML). Where it isn't XO's own, XO's word stays in a tooltip, so help
 *  text and agents never disagree with the screen. */
const noun = (w) => { const x = SHAPE.word(w); return x === w ? esc(w) : `<span title="${esc(`XO's word: ${w}`)}">${esc(x)}</span>`; };

const params = new URL(location.href).searchParams;
const PROJ = (id) => (id === "workspace" ? "Workspace" : id === "@account" ? "Your account" : id === "@chats" ? "Chats" : world.project(id)?.name || id);
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } },
};
const PHONE = matchMedia("(max-width: 760px)");
const NUM = ["No", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten"];
const num = (n) => NUM[n] || String(n);
const plural = (n, w) => `${w}${n === 1 ? "" : "s"}`;
// Stop's square: all of its 14 px box, with 4 px corners (css/app.css, .send.is-stop)
const STOP_ICON = ICON.stop;

const { THEME, applyTheme } = createTheme(setDiffTheme);

// ── state ───────────────────────────────────────────────────────────────────
const S = {
  view: "home",            // home | ws | p:<project> | t:<thread>
  parent: {}, backTo: {}, scroll: {},
  dockFold: {},
  lref: {},                // beside a file: the lines a message will be about, per conversation {path, a, b, name}
  get showHops() { return SHAPE.on("xo:thread/hops"); },  // the shape's xo:thread/hops (cv-hops folded into this device's layer)
  tbOpen: {},              // storm blocks opened by the person (by block id, or row:<call id>)
  stops: new Map(),        // live Stops by session: waiting out their Undo, or on their way
  tEdit: null,             // a thread header field being edited: {tid, field: "title"|"label"}
  recording: null, keyErr: null,  // Settings › Keyboard: the action waiting for a new key, and why the last one was refused            // asks folded away in their thread so you can read it first (by ask key)
  local: {}, alias: new Map(),
  drafts: store.get(DRAFTS, {}),
  later: new Set(),
  pin: null,
  wash: new Map(),
  herald: null,
  ckOpen: {}, ckSeen: {}, ckFresh: null,
  handledOpen: false,
  desc: {},
  seen: null,
  allFilter: "all", allDone: false,
  trail: [],               // places visited before this one, for the phone's Back (a thread's own Back is its parent)
  n: 0,
};
const waitSince = new Map();
const announce = createAnnouncer($("#live"));

// ── the parts ───────────────────────────────────────────────────────────────
const P = createPacing({ params });
// one card at the right edge: the newest shows, the one it covers steps aside and comes back when it closes
const EDGE = { under: null };
const edgeOver = (covered) => { if (covered.isOpen) { covered.park(); EDGE.under = covered; } };
const edgeBack = (from) => { const u = EDGE.under; if (u === from) { EDGE.under = null; u.unpark(); } };
const decisionsCard = { get isOpen() { return D.isOpen(); }, park: () => D.park(), unpark: () => D.unpark() };
const D = createDecisions({
  world, P, PROJ, announce, waitSince,
  onShown: () => edgeOver(VW),
  onGone: () => edgeBack(VW),
  render: () => schedule(),
  back: (sels) => { const here = placeRegion(); if (usable(here)) here.focus({ preventScroll: true }); S.focusNext = [...sels, placeRegion]; schedule(); },
  later: S.later,
  onOpenThread: (tid) => {
    // an item hosted by a chat (no thread) opens that conversation; one hosted by the account has no page yet
    const h = (world.state.hosts || []).find((x) => x.id === tid);
    if (h) { if (h.chatId) go(convOfChat(h.project), { keepPanel: true }); else if (h.plainSession) go("c:" + h.plainSession); else heraldShow({ kind: "calm", text: "It isn't tied to a conversation", sub: h.title }, 3600); return; }
    go("t:" + tid, { keepPanel: true });
  },
  // a decision refused after its window: the honest correction replaces "All clear"
  onNotSent: (title, why) => { setTimeout(() => heraldShow({ kind: "stopped", text: "Not sent", sub: `${String(title).replace(/`/g, "").replace(/[.?!]$/, "")} · ${why}`, force: true }, 7000), RM.matches ? 0 : 950); },
  onAllClear: (summary) => { setTimeout(() => heraldShow({ kind: "clear", text: "All clear", sub: summary }, 4600), RM.matches ? 0 : 900); },
  // a docked decision's own line ("Allowed. Undo") ends the moment its decision is undone, by its Undo or a key
  onUndone: (key) => { if (S.view === "home") { S.pin = key; S.pinAnim = "undo"; } for (const d of [TD, TP.dock?.TD]) if (d?.undone && d.undone.key === key) d.undone.end(); },
  onBreak: (left) => heraldShow({ kind: "calm", text: "Taking a break", sub: `${left} wait safely` }, 5200),
  onSent: (part) => {
    // "Stop here" after you stopped a thread: it ends there, honestly
    if (part.ask.stopByYou && part.choice && part.choice.option === "Stop here") setTimeout(() => { world.act.resolve(part.t.id).catch(() => {}); }, 1600);
  },
});
const IQ = createIntel({
  world, PROJ,
  // the shape's xo:composer/intel: "simple" opens Auto · Deep first, today's picker behind More options
  simple: () => SHAPE.opts("xo:composer/intel").mode === "simple",
  onChange: (o) => { for (const K of composers()) chipRender(o && o.fade, K); },
  record: (session, rec) => recordLine(session, rec),
  onMoved: (next, agent) => { announce(`Continuing on ${rtName(agent)}. This thread is frozen; write in it to pick it back up.`); if (next) go(`t:${next.id}`, { focus: true }); },
});

const CH = createChats({
  world, announce, heraldShow: (...a) => heraldShow(...a), go: (...a) => go(...a), schedule: () => schedule(),
  view: () => S.view,
  // a new chat that was refused: your words go back into an empty composer on the Chats page
  restore: (text, { force = false } = {}) => {
    if (force && S.view !== "chats") go("chats");
    if (S.view !== "chats") return false;
    if (say.value.trim() && !force) return false;
    putBack(text);
    return true;
  },
});
world.ui = { tbOpen: S.tbOpen }; // turn blocks open or folded, shared with the Chats view
// what a place changed, from Space's /changes (modules/changes/store.js): the panel's Changes, Files' diffs, the chips' counts
const CHG = createChanges({ world, api, onChange: () => schedule() });
const VW = createViewer({
  announce, onChange: () => schedule(), changes: CHG,
  ask: { target: (f) => askPlace(f)?.name || null, send: askAboutLines, compose: (f, a, b) => composeAbout(f, a, b), file: (f) => askAboutFile(f) },
  // each save (⌘S): its place's changes are read again, once you pause
  edits: { saved: (f) => savedSoon(f) },
  // who made a version: an agent's thread, by its title
  threadTitle: (ts) => world.thread(ts)?.title || null,
  // Esc from a file: back to the panel's sections, the file kept as the Files tab (js/filespage.js)
  away: () => { if (!FP.isOpen) return false; STAGE.back(); return true; },
  // every way a file opens ends in the panel's Files page
  opened: (f, o) => { edgeOver(decisionsCard); FP.show(o); },
  closed: () => edgeBack(decisionsCard),
  // closed, with what opened it gone and nothing drawn in its place: where you'd carry on
  home: () => [$("#say"), placeRegion()].find(usable) || null,
}); // a file, in the panel's Files page (modules/files/page.js)
const savedSoon = createSavedSoon(CHG);
// a file changed on disk (Space's file.version): the open file takes it in, and the place's file list follows
world.onEvent((e) => {
  if (e.kind !== "file") return;
  VW.fileChanged({ ...e.data, type: e.type });
  const d = e.data || {}, m = /^(\.xo\/worktrees\/[^/]+)\/(.+)$/.exec(d.path || "");
  if (d.project_id && (d.kind === "create" || d.kind === "delete" || d.kind === "rename")) {
    PATHS.changed({ project: d.project_id, base: m ? m[1] : "" }, { kind: d.kind, path: m ? m[2] : d.path, old_path: d.old_path ? d.old_path.replace(/^\.xo\/worktrees\/[^/]+\//, "") : null });
  }
});
// every file in a place (core/services/paths.js), for ⌘P and the tree's Find; ⌘P and ⌘⇧F themselves (modules/search/quickopen.js)
const PATHS = createPaths({ api, onChange: () => { QO.refresh(); FILES.pathsChanged && FILES.pathsChanged(); } });
/** The place the view shows files of (a thread's worktree, a project's folder), or null. */
const placeNow = () => filePlace(S.view, { thread: (id) => world.thread(id), project: (id) => PROJ(id) });
const QO = createQuickOpen({
  paths: PATHS, api, place: placeNow, announce,
  openFile: (rel, { line }) => VW.open({ path: rel, name: rel.split("/").pop(), project: placeNow().project, rel, ...(line ? { lines: [line, line] } : {}) }, null),
  openFiles: () => VW.openFiles || [],
  layer: { shown: () => syncInert(), hidden: () => syncInert() },
});
// a picture opens over the conversation (js/lightbox.js); Open in Files hands it to the viewer, which brings Files up
const LB = createLightbox({ openFile: (it, from) => VW.open(viewerFile(it), from), announce });
wireDragOut($("#msgs"));
// shells (js/shells/): the dock under the main column, the sidebar's Shells row, the top bar's Shell buttons
const SH = createShells({ PROJ, announce, notify: (h) => heraldShow(h, 6000), onChange: () => schedule(), wanted: () => SHAPE.on("xo:dock/shells") });
CAP.terminal = () => SH.available;
// a project's record: Since you left, Made, Recently made
const REC = createRecord({ world, go: (v) => go(v), VW, PROJ, schedule: () => schedule(), announce, mark: (t) => threadMark(t, { lead: true }), places: kernel.places });
REC.view = () => S.view;
/** A Shell button for the top bar: a count when shells already run there (it opens their list then). */

// ── world helpers ───────────────────────────────────────────────────────────
const projects = () => world.state.projects.filter((p) => p.id !== "workspace");
const wsHeadRender = createWorkspaceHeader(S, projects);
const { ownIcon, projectIcon, forgetIcon } = createProjectIconChoice({ world, SHAPE });
const { PICK, pickIcon, closePick } = createProjectIconPicker({ world, SHAPE, PROJ, ownIcon, forgetIcon, announce, render: () => render(), wirePickKeys });

function wirePickKeys(el, closePick) {
  el.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); closePick({ focus: true }); return; }
    const os = [...el.querySelectorAll(".pk-o")], i = os.indexOf(document.activeElement);
    if (i < 0) return;
    const cols = Math.max(1, Math.round(el.querySelector(".pk-grid").clientWidth / os[0].offsetWidth));
    const d = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: cols, ArrowUp: -cols, Home: -i, End: os.length - 1 - i }[e.key];
    if (d == null) return;
    e.preventDefault();
    const j = Math.max(0, Math.min(os.length - 1, i + d));
    os[i].tabIndex = -1; os[j].tabIndex = 0; os[j].focus({ preventScroll: true });
  });
}
document.addEventListener("click", (e) => { const b = e.target.closest?.("[data-pj-icon]"); if (b) pickIcon(b.dataset.pjIcon, b); });
document.addEventListener("pointerdown", (e) => { if (PICK.el && !e.target.closest(".pk-pop,[data-pj-icon]")) closePick(); });
const threadsOf = (pid) => world.state.threads.filter((t) => t.project === pid && t.state !== "resolved");
const convThread = (v) => (v && v.startsWith("t:") ? world.thread(v.slice(2)) : null);
// the team, visible (core/services/comms.js): a comms call names the thread, project or coordinator it reached
nameWith({
  thread: (id) => world.thread(id)?.title || null,
  project: (chatId) => (world.state.projects || []).find((p) => p.chatId === chatId)?.name || null,
  here: () => { const v = S.view || ""; const t = convThread(v); return t ? PROJ(t.project) : v.startsWith("p:") ? PROJ(v.slice(2)) : null; },
});
const convProject = (v) => (v === "ws" || v === "home" ? "workspace" : v.startsWith("p:") ? v.slice(2) : convThread(v)?.project);
const sessionOf = (v) => (v === "home" ? "ws" : v);
const askTitle = (n) => { const h = headOf(n); return (h.verb ? `${esc(h.verb)} ` : "") + (h.md ? renderInline(h.text, true) : esc(h.text)); };
const askShort = (n) => { const h = headOf(n); return [h.verb, h.md ? plainText(h.text) : h.text].filter(Boolean).join(" "); };
const STATE_WORD = { working: "Working", needs_reply: "Needs you", needs_approval: "Needs you", paused: "Paused", done: "Done", failed: "Stopped", resolved: "Resolved" };
// "Working" only while its agent really works (storm's `busy`, live by timeline.js sessionBusy); an idle session reads "Waiting".
const isBusy = (t) => t.busy === true || (t.state === "working" && t.busy !== false);
const isHeld = (t) => !!(t && t.held && !isBusy(t) && t.state === "working");
// a thread continued on another runtime is frozen, not waiting on you: a quiet "Continued" (F4)
// a stop someone meant (timeline.js stopOf) is drawn quiet, in the ink, never the red of a failure: "stopped"
const glyphOf = (t) => (isHeld(t) ? "paused" : t.state === "working" && t.busy === false ? "idle" : t.frozen ? "resolved" : t.stop ? "stopped" : t.state);
// an open thread whose agent sits idle is "Waiting": the word the panel, the header and All threads use (the owner, 19 Nov)
const wordOf = (t) => (isHeld(t) ? heldShort(t.held) : glyphOf(t) === "idle" ? "Waiting" : t.frozen ? "Continued" : STATE_WORD[t.state]);
// the state a badge or card is coloured by: a held thread in the pause's amber, never Working's blue
const stOf = (t) => (t.frozen ? "resolved" : isHeld(t) ? "paused" : t.stop ? "stopped" : t.state);
// a thread link in any message is a token led by that thread's live state (js/markdown.js)
setThreadInfo((id) => { const t = world.thread(id); return t ? { state: glyphOf(t), word: wordOf(t), title: t.title } : null; });
// the Map (js/map.js): where your agents are working, drawn in the panel's Map frame
const MAP = createMap({ world, go: (v) => go(v, { panel: true }), announce, isBusy, openFile: (f, from) => VW.open(f, from), stepLineHtml });
const { STATE_WORDS, threadState, panelThreads, threadCounts } = createThreadGroups({
  world, D, MAP, convProject, askShort, threadMark: (t) => threadMark(t), isBusy, isHeld,
});
// the panel: one card on the right with tabs (Map, Made, File; later apps), one header button, ⌘\
// Files: the project's files, and the one place a file opens (js/files.js)
const FILES = createFiles({ world, viewer: VW, isBusy, PROJ, go: (v) => go(v), changes: CHG, onFold: (f) => FP.treeFolded(f), paths: PATHS });
const lpProject = (v) => (v && v.startsWith("p:") ? v.slice(2) : v && v.startsWith("t:") ? world.thread(v.slice(2))?.project || null : null);
// the thread "Ask an agent" started: by its id when Launchpad has it (whatever its title, past older threads of the
// same title; resolved reads as done); without one, discovered by xo-space's title "Deploy to Launchpad", while open
const lpThread = (p, id) => { const t = id ? world.thread(id) : world.state.threads.find((x) => x.project === p && /^deploy to launchpad/i.test(x.title || "") && x.state !== "resolved"); return t && t.project === p ? { thread: t.id, title: t.title, since: t.createdAt, busy: isBusy(t), held: isHeld(t) ? heldShort(t.held) : null, done: t.state === "done" || t.state === "resolved" } : null; };
const LP = createLaunchpad({ api: createLpApi(), projectOf: lpProject, nameOf: (p) => PROJ(p), findThread: lpThread, go: (v) => { LW.close(); go(v); }, announce, onChange: () => schedule(),
  // Launchpad's own Undo names where focus goes (Stop, the header's Deploy, the page's work): ownFocus
  // and its kind: a failure ("err") reads as every failure notice here does (kind "stopped": the error's mark and
  // ink), never with the success check (Launchpad grader on 842a6d1: "Couldn't unlink" showed a green check)
  notify: (text, undo, kind = "done") => heraldShow({ kind: kind === "err" ? "stopped" : kind, text, ...(undo ? { undo, undoUntil: Date.now() + 3000, ownFocus: true } : {}) }, undo ? 3200 : kind === "err" ? 6000 : 4200),
  // one notice per subject (a stop, an unlink: mid), changed in place as it goes on, or taken away (C041's pattern;
  // the owner's choice B): its Undo's deadline is the action's own (l.until), so it can't outlive what it undoes
  notice: (mid, l, ms) => { const h = { mid, kind: l.kind === "err" ? "stopped" : l.kind || "done", text: l.text, ...(l.sub ? { sub: l.sub } : {}), ...(l.undo ? { undo: l.undo, undoLabel: l.undoLabel, undoUntil: l.until || 0, ownFocus: true } : {}) }; return heraldFor(mid, () => h, ms) || heraldShow(h, ms); },
  unnotice: (mid) => heraldDrop(mid) });
const LW = createLpWindow({ launch: LP, projectOf: lpProject, nameOf: (p) => PROJ(p), iconOf: (p) => (p ? projectIcon(p) : ""), allApps: () => go("launchpad"), onChange: () => schedule() });
const LPP = createLpPage({ el: $("#lpp"), launch: LP, projects: () => projects().map((p) => p.id), iconOf: (p) => projectIcon(p), open: (v, from) => LW.open(v, from), press: (name) => LW.press(name) });
const PAGE_OF = { home: "#home", artifacts: "#arts", launchpad: "#lpp" };
const pageEl = (v) => (PAGE_OF[v] ? $(PAGE_OF[v]) : null);
const panelPlace = (v) => /^(?:ws$|[pt]:)/.test(v || "");
const atOf = (v) => { const t = convThread(v); return { view: v, project: t ? t.project : v.startsWith("p:") ? v.slice(2) : undefined, thread: t ? t.id : undefined }; };
const FRAMES = { map: { title: "Map", mount: (host) => MAP.mount(host), api: MAP }, changes: { title: "Changes", mount: (host, o) => createChangesFrame({ host, changes: CHG, ...o }), theme: setDiffTheme } };
for (const [id, e] of Object.entries(FRAMES)) kernel.places.contribute("panel.frame", { id, ...e }, `xo.${id}`);
const STAGE = createStage({ place: panelPlace, files: FILES, openFiles: () => FP.show({ focus: true }), github: { show: () => GH.show(), has: (v) => (lpProject(v) && lpProject(v) !== "workspace" ? GH.has(lpProject(v)) : Promise.resolve(false)) }, viewer: VW, view: () => S.view, go: (v, e) => openFromPanel(v, e), announce, onChange: () => schedule(), frames: () => SHAPE.list("panel").map((s) => s.id.slice("xo:panel/".length)), threads: (v) => panelThreads(v), shell: (on, host, where) => panelShell(on, host, where), owns: (e) => SH.owns(e), at: () => atOf(S.view), places: kernel.places });
const FP = createFilesPage({ stage: STAGE, files: FILES, viewer: VW, view: () => S.view, announce });
const GH = createGhPage({ stage: STAGE, api, view: () => S.view, projectOf: lpProject, announce, work: (p, it) => {
  if (S.view !== `p:${p}`) go(`p:${p}`);
  const what = it.kind === "pr" ? `Review pull request #${it.number}` : `Work on issue #${it.number}`;
  requestAnimationFrame(() => { insertText(`${what}, “${it.title}”: ${it.url}`, MK); announce("The ask is in the message box. Send it to start a thread."); });
} });
kernel.start();
wireHeaderActions(kernel.places, () => atOf(S.view));
// the place beside the panel's name: a thread's project (its title is the conversation's own head), a project
STAGE.names = (v) => {
  const p = v.startsWith("t:") ? world.thread(v.slice(2))?.project : v.startsWith("p:") ? v.slice(2) : null;
  return p && p !== "workspace" ? PROJ(p) : p === "workspace" || v === "ws" ? "Workspace" : "Your projects";
};
REC.panel = STAGE;
const { agentOf, threadMark, rtTag, sendWhileRunning, movable } = createThreadRuntime({ world, SHAPE, isHeld });
const threadMenuHtml = createThreadMenu({ panelThreads, SH, movable, isBusy });
/** The composer's target line in a thread; while its agent works, where your words land. */
const doneToday = () => world.state.threads.filter((t) => t.state === "done" && new Date(t.lastAt).toDateString() === new Date().toDateString());

// ── events: a calm labelled line, never the composer, never a quiet row ────
world.onEvent((e) => {
  if (e.kind === "message") {
    // the coordinator answered something you asked, and you're looking elsewhere: one calm line
    const conv = e.project === "workspace" ? "ws" : "p:" + e.project;
    if (e.answered && S.view !== conv) heraldShow({ kind: "reply", text: e.project === "workspace" ? "The coordinator replied" : `${PROJ(e.project)} coordinator replied`, sub: short1(e.text), open: conv }, 7000);
    if (e.answered) announce(`${e.project === "workspace" ? "The coordinator" : PROJ(e.project) + " coordinator"} replied: ${e.text}`);
    schedule();
    return;
  }
  const t = e.thread ? world.thread(e.thread) : null;
  const pid = e.project;
  if (e.kind === "ask" && t && !waitSince.has(t.id)) waitSince.set(t.id, Date.now());
  if (e.kind === "resumed" && t) waitSince.delete(t.id);
  if (!pid || pid === "workspace") return;
  // F5: threads moved off a closed limit arrive one by one; each says where it went
  if (e.kind === "moved" && t && !IQ.movedHere(t.id)) { heraldShow({ kind: "done", text: `${t.title} continues on ${rtName(e.agent)}`, sub: PROJ(pid), open: e.to ? "t:" + e.to : "t:" + t.id }, 5200); return; }
  if (e.kind === "done" && t) heraldShow({ kind: "done", text: `${t.title} finished`, sub: PROJ(pid), open: "t:" + t.id }, 5200);
  else if (e.kind === "state" && t && t.state === "failed") heraldShow({ kind: "stopped", text: `${t.title} stopped`, sub: PROJ(pid), open: "t:" + t.id }, 5200);
});

const short1 = (text) => { const s = String(text || "").replace(/[*_`#>]+/g, "").replace(/\s+/g, " ").trim(); return s.length > 64 ? s.slice(0, 63).replace(/\s+\S*$/, "") + "…" : s; };

const pings = createDecisionPings({ S, P, PROJ, askShort, heraldShow });

const sideRender = createSideRows({ S, world, CH, REC, D, projects, convThread, isBusy, isHeld, askShort, projectIcon, folded: () => SIDE.folded });

const homeParts = createHomeParts(S, D, Kit);
const { endRender, setHandled } = createHandled({ S, world, homeParts, isBusy, num, PROJ, threadMark, askTitle });


// ── conversations ───────────────────────────────────────────────────────────
/** The chat behind a conversation: "ws" → workspace, "p:x" → x (threads use their project). */
const chatOf = (conv) => (conv === "ws" || conv === "home" ? "workspace" : conv.startsWith("p:") ? conv.slice(2) : convThread(conv)?.project || null);
const convOfChat = (chat) => (chat === "workspace" ? "ws" : "p:" + chat);
const nextCardHtml = createNextCard({ D, Kit, evidenceFor, PROJ, convOfChat });
const { homeRender, nextDecide } = createHomeView({
  S, D, world, Kit, EFFORT, homeParts, nextCardHtml, endRender, greeting, today, num, noun, plural, isBusy, askTitle, PROJ, kernel,
  SV: { homeOrder: (body) => SV.homeOrder(body) }, announce, schedule,
});
/** What a project's, the Workspace's or a plain chat's own conversation asks of you (its host: no thread). */
function convHost(v) {
  const hosts = world.state.hosts || [];
  if (v.startsWith("c:")) return hosts.find((h) => h.id === `session:${v.slice(2)}`) || null;
  const chat = v === "ws" ? world.project("workspace")?.chatId : v.startsWith("p:") ? world.project(v.slice(2))?.chatId : null;
  return chat ? hosts.find((h) => h.id === `chat:${chat}`) || null : null;
}

/** The real timeline (workspace or project) or the thread's own messages, with its root first. */
function messagesOf(conv) {
  const out = [];
  const t = convThread(conv);
  const chat = chatOf(conv);
  const st = world.state;
  const h = chat ? st.hist[chat] : null;
  let rows;
  if (t) {
    const root = (st.timeline[t.project] || []).find((r) => r.id === t.id) || st.found?.[t.project]?.get(t.id);
    rows = [...(root ? [uiMsg(root)] : []), ...t.messages];
  } else rows = (st.timeline[chat] || []).map(uiMsg);
  // optimistic rows whose server copy arrived first (the stream can beat the POST): the bubble stays, once
  const locals = S.local[conv] || [];
  for (const [lid, sid] of echoes(locals, rows, new Set(S.alias.keys()))) {
    S.alias.set(sid, lid);
    const m = locals.find((x) => x.id === lid);
    m.merged = true; m.status = "sent";
  }
  // a thread draws nothing of its own until its first page is in. Its turns and notes are read alongside the
  // page and came sooner: drawn alone they sat under "No messages in this thread yet." for seconds, then the
  // messages landed among them and pushed what you were reading away (1-5k px on a long thread, at 1x)
  if (t && !t.loaded) {
    const err = st.threadHist?.[t.id]?.error;
    out.push({ key: "note", at: -Infinity, who: "note", ...(err ? { text: `Couldn't load this thread: ${err}` } : { load: "Loading the thread" }) });
    out.push(...locals.filter((m) => !m.merged).map((m) => ({ ...m, key: m.id })));
    return out;
  }
  if (!t && h) {
    if (h.error && !rows.length) out.push({ key: "note", at: -Infinity, who: "note", text: `Couldn't load this conversation: ${h.error} Retrying.` });
    else if (h.loading && !rows.length) out.push({ key: "note", at: -Infinity, who: "note", load: "Loading the conversation" });
    else if (rows.length || h.loading) out.push({ key: "hist", at: -Infinity, who: "hist", h });
  }
  // a thread read in pages: the same line at its top (older pages on their way, or its beginning once a
  // thread that needed more than one page has been read to it)
  const th = t ? st.threadHist && st.threadHist[t.id] : null;
  if (th && th.loaded && rows.length && (!th.all || th.paged)) out.push({ key: "hist", at: -Infinity, who: "hist", h: { loading: !!th.older, all: !!th.all, olderError: th.olderError || null, before: th.before } });
  const ids = t ? [] : world.state.threads.filter((x) => x.project === chat).map((x) => x.id);
  const { on, alone } = threadAnchors(rows, ids);
  // the thread's running turn: your messages sent after it started wait for it to end
  const turn = t && t.busy && t.sessionId && st.turns ? st.turns.running(t.sessionId) : null;
  for (const m of rows) {
    const key = S.alias.get(m.id) || m.id;
    const base = { key, sid: m.id, at: m.at, seq: m.seq, text: m.text, sent: S.alias.has(m.id), files: m.files, chatId: m.chatId, reactions: m.reactions };
    if (m.who === "you" && !t && conv !== "ws" && m.fwd) {
      // a forwarded copy of your message: where it began, not just the copy before it (a forward back into the
      // chat you wrote it in is a copy of a copy, and must not read as you saying it again)
      const o = forwardOrigin(m.fwd, (id, cid) => {
        const p = cid && world.act.projectOf ? world.act.projectOf(cid) : null;
        return p ? (st.timeline[p] || []).find((r) => r.id === id) || st.found?.[p]?.get(id) || null : null;
      });
      if (!o.known && world.act.findRows) { const p = o.chatId && world.act.projectOf ? world.act.projectOf(o.chatId) : null; if (p) world.act.findRows(p, [o.id], m.seq); }
      // the same words you wrote earlier in this very chat, while the chain can't be read yet
      const mine = o.known ? (world.act.projectOf?.(o.chatId) === chat ? { id: o.id, text: o.row ? o.row.text : m.text } : null)
        : rows.filter((x) => x.who === "you" && !x.fwd && x.id !== m.id && x.at < m.at && x.text && x.text === m.text).pop();
      if (mine) { out.push({ key, sid: m.id, at: m.at, seq: m.seq, who: "system", back: { id: mine.id, text: String(mine.text ?? m.text), via: m.fwd.via } }); continue; }
      out.push({ ...base, who: "you", fwd: o.known ? { chatId: o.chatId, id: o.id, via: m.fwd.via } : m.fwd, queued: waitsForTurn(m, turn) });
      if (alone.has(m.id)) out.push({ key: `${m.id}:card`, at: m.at, who: "card", thread: m.id });
    } else if (m.who === "you") {
      out.push({ ...base, who: "you", fwd: conv !== "ws" && m.fwd ? m.fwd : null, routed: conv === "ws" ? st.routed[m.id] || null : null, queued: waitsForTurn(m, turn) });
      if (alone.has(m.id)) out.push({ key: `${m.id}:card`, at: m.at, who: "card", thread: m.id });
    } else if (m.who === "system") out.push({ ...base, who: "system", passedOn: m.passedOn, continuedIn: m.continuedIn, continuedFrom: m.continuedFrom });
    else if (t && m.who === "agent" && /^✓\s/.test(m.text)) out.push({ key, at: m.at, who: "event", text: m.text.replace(/^✓\s*/, ""), tone: "ok" });
    else out.push({ ...base, who: m.who === "coord" ? "coord" : "agent", fwd: conv !== "ws" && m.fwd ? m.fwd : null, threads: on.get(m.id) || null });
  }
  if (conv.startsWith("p:")) {
    const pid = conv.slice(2);
    const since = h && !h.all ? rows.reduce((a, m) => (Number.isFinite(m.at) && m.at < a ? m.at : a), Infinity) : -Infinity;
    const inView = (at) => !(at < since);
    for (const x of threadsOf(pid)) {
      if (!inView(x.lastAt)) continue;
      if (x.state === "done") out.push({ key: `${x.id}:done`, at: x.lastAt, who: "event", text: `${x.title} finished`, tone: "ok" });
      if (x.state === "failed") out.push({ key: `${x.id}:failed`, at: x.lastAt, who: "event", text: `${x.title} stopped`, tone: "stop" });
    }
    for (const d of D.decisions().filter((d) => d.project === pid && inView(d.at))) out.push({ key: `dec:${d.id}`, at: d.at, who: "event", text: `${d.verb} · ${d.said || d.label}`, tone: d.choice === "deny" ? "back" : "ok" });
    for (const d of D.notSent().filter((d) => d.project === pid && inView(d.at))) out.push({ key: `dec:${d.id}`, at: d.at, who: "event", text: `Not sent · ${d.said || d.label} · ${d.why}`, tone: "sys" });
  }
  // what its coordinator did to its turn (F6): one row each, in order. An interrupt or a stop also left XO's
  // own note on the thread; that note becomes the row, so nothing is said twice.
  if (t) for (const c of st.controls[t.id] || []) {
    const at = Date.parse(c.at) || 0;
    const note = c.action !== "steer" ? out.find((x) => x.who === "system" && !x.ctl && !x.continuedIn && !x.continuedFrom && !x.passedOn && /interrupt|stop/i.test(x.text || "") && Math.abs((x.at || 0) - at) < 15000) : null;
    if (note) { note.who = "control"; note.ctl = c; continue; }
    out.push({ key: `ctl:${c.seq ?? at}`, at, seq: c.seq, who: "control", ctl: c });
  }
  // a usage limit this thread waits on (F5): the same card as in Needs you, small, at the end
  if (t) for (const it of t.limits || []) out.push({ key: `lim:${it.id}`, at: Date.now(), who: "limit", item: it });
  // a move the thread row knows but whose note isn't in what we hold: its banner anyway (F4)
  if (t && t.movedFrom && !rows.some((m) => m.continuedFrom)) out.push({ key: `mvfrom:${t.id}`, at: t.createdAt - 1, who: "system", text: "", continuedFrom: t.movedFrom.from });
  if (t && t.movedTo && t.movedTo.to && !rows.some((m) => m.continuedIn)) out.push({ key: `mvto:${t.id}`, at: Date.parse(t.movedTo.at) || t.lastAt, who: "system", text: "", continuedIn: t.movedTo.to });
  // your messages relayed into this thread by its coordinator (if1 #7): the relay hop names them, and they
  // stay on the project's timeline (storm doesn't copy them), so they're shown here in place, whatever the
  // hops setting, marked as passed on, linking back to where you wrote them
  if (t && st.hops) {
    const { shown, missing } = relayedInto(t, st.hops.values(), st.timeline[t.project] || [], new Set(rows.map((m) => m.id)), st.found?.[t.project]);
    const who = (r) => (r === "workspace-coordinator" ? "Workspace coordinator" : r === "project-coordinator" ? `${PROJ(t.project)} coordinator` : null);
    for (const m of shown) {
      if (m.who === "you") out.push({ key: `relay:${m.id}`, at: m.hop.at || m.at, seq: m.hop.seq ?? m.seq, who: "you", text: m.text, files: m.files, chatId: m.chatId, wrote: m.at, relay: { project: t.project, id: m.id, fwd: m.fwd, at: m.hop.at || 0 } });
      else out.push({ key: `relay:${m.id}`, at: m.at, seq: m.seq, who: m.who, text: m.text, files: m.files, chatId: m.chatId, ...(who(m.role) ? { name: who(m.role), role: "passed on", coord: true } : {}) });
    }
    if (world.act.findRows) for (const x of missing) world.act.findRows(t.project, x.ids, x.seq);
  }
  // what the coordinators and this thread wrote each other: storm keeps it as hops (their note), never
  // as messages, so it's shown here in place, whatever the hops setting
  const noted = new Set();
  if (t && st.hops) {
    for (const n of hopNotes(t, st.hops.values())) {
      noted.add(n.id);
      if (n.dir === "down") out.push({ key: `hopn:${n.id}`, at: n.at, seq: n.seq, who: "coord", text: n.text, name: n.from === "workspace" ? "Workspace coordinator" : `${PROJ(t.project)} coordinator`, role: n.kind, cause: n.cause });
      else out.push({ key: `hopn:${n.id}`, at: n.at, seq: n.seq, who: "asked", text: n.text, hop: n.id });
    }
    // a steer delivers the coordinator's next note (the hop stored right after it): the line says what happened, the note what it said
    for (const c of out.filter((x) => x.who === "control" && x.ctl.action === "steer" && x.seq != null).sort((a, b) => a.seq - b.seq)) {
      const note = out.filter((x) => x.who === "coord" && !x.lead && x.key.startsWith("hopn:") && x.seq > c.seq && x.at - c.at >= 0 && x.at - c.at < 10000).sort((a, b) => a.seq - b.seq)[0];
      if (note) note.lead = c.key;
    }
  }
  // how messages travelled to and from this thread (11 §16): hidden by default, shown by choice
  if (t && S.showHops && st.hops) {
    for (const hp of st.hops.values()) {
      if (hp.thread_ts !== t.id || noted.has(hp.id)) continue;
      const text = hopLine(hp, PROJ(t.project));
      if (text) out.push({ key: `hop:${hp.id}`, at: Date.parse(hp.at || hp.created_at) || 0, seq: hp.seq ?? null, who: "system", text });
    }
  }
  if (t && t.sessionId && st.turns) {
    const says = rows.filter((m) => m.seq != null && m.id !== t.id).map((m) => ({ seq: m.seq, at: m.at, who: m.who }))
      .concat(out.filter((x) => x.seq != null && /^(hopn|relay|ctl|hop):/.test(x.key)).map((x) => ({ seq: x.seq, at: x.at, who: x.who })));
    // what the agent's messages carry: a turn's shared_files block doesn't draw them a second time
    const carried = rows.filter((m) => m.who !== "you").flatMap((m) => m.files || []);
    // a running turn's still-empty last stretch is "now": after everything held
    const tail = says.reduce((a, m) => (m.seq > a ? m.seq : a), 0) + 0.5;
    for (const tu of st.turns.list((x) => x.session === t.sessionId)) {
      const blocks = st.turns.blocksOf(tu);
      const said = says.some((q) => q.who === "agent" && q.seq >= (tu.seq ?? Infinity) && q.seq <= (tu.lastSeq || Infinity));
      for (const sg of turnSegments(tu, blocks, says)) {
        const turn = segmentTurn(tu, sg);
        const seq = tu.status === "running" && sg.last && sg.k > 0 && !sg.blocks.length ? Math.max(sg.seq, tail) : sg.seq;
        out.push({ key: sg.last ? `turn:${tu.id}` : `turn:${tu.id}#${sg.k}`, at: sg.from ?? (Date.parse(tu.at) || Date.now()), seq, who: "turn", turn, blocks: sg.blocks, hideAnswer: said, carried, working: sg.k > 0 });
      }
    }
  }
  // the Workspace's and a project's own hops, by the same choice: what a coordinator did on its own, and
  // work handed on to another project (its forward and the answer back)
  if (!t && chat && S.showHops && st.hops) {
    const cid = world.act.chatId?.(chat);
    // its own, and a forward into another project that one of its own asks caused
    const mine = (hp) => hp.chat_id === cid || (hp.kind === "forward" && st.hops.get(hp.cause)?.chat_id === cid);
    for (const hp of cid ? st.hops.values() : []) {
      if (hp.thread_ts != null || !mine(hp)) continue;
      const text = hopLine(hp, PROJ(chat), hp.kind === "forward" ? PROJ(world.act.projectOf?.(hp.chat_id) || "") : null);
      if (text) out.push({ key: `hop:${hp.id}`, at: Date.parse(hp.at || hp.created_at) || 0, seq: hp.seq ?? null, who: "system", text });
    }
  }
  // the coordinator's turn for your message failed: say so where you'll look (GitHub #30)
  const fail = !t && chat ? st.failed && st.failed[chat] : null;
  if (fail) out.push({ key: `fail:${fail.id}`, at: fail.at, who: "event", tone: "stop", text: `The coordinator couldn't answer: ${fail.error}` });
  // empty means nobody has said anything yet: XO's own lines here (a new project's "cloned from …", a record
  // line) are no conversation, so they don't stand in for one (the owner, 13 Nov 17:40Z: a cloned project
  // opened on its one "cloned" line, without the starts)
  if (!rows.length && !locals.some((m) => m.who === "you") && !(h && (h.loading || h.error))) {
    // a project's empty chat opens on what its coordinator can start for you (startHtml), after XO's own lines
    out.push(t || conv === "ws" ? { key: "empty", at: -Infinity, who: "note", text: t ? "No messages in this thread yet." : "No messages yet. Ask the coordinator anything below." } : { key: "empty", at: Infinity, who: "start", pid: convProject(conv) });
  }
  out.push(...locals.filter((m) => !m.merged).map((m) => ({ ...m, key: m.id })));
  const floor = t ? pageFloor(th, t.messages) : null;
  const floorAt = floor == null ? null : t.messages.find((m) => m.seq === floor)?.at ?? null;
  const shown = floor == null ? out : out.filter((m) => inPage(m, floor, floorAt));
  const stored = shown.filter((m) => m.seq != null).sort((a, b) => a.seq - b.seq);
  const rest = shown.filter((m) => m.seq == null).sort((a, b) => a.at - b.at);
  const merged = [];
  let i = 0;
  for (const m of stored) {
    while (i < rest.length && rest[i].at < m.at) merged.push(rest[i++]);
    merged.push(m);
  }
  while (i < rest.length) merged.push(rest[i++]);
  return merged;
}

/** A message's words. One that holds a table is the wide kind of bubble: the whole text column, so a
 *  table gets the room it needs (QA #5; a prose bubble stops at 560 px, 88 % of the column). */
function proseHtml(text) {
  const html = renderMarkdown(text);
  return `<div class="prose${html.includes('<div class="md-table') ? " has-table" : ""}">${html}</div>`;
}
function threadCardHtml(tid, needs) {
  const t = world.thread(tid);
  if (!t) return "";
  const c = t.checklist;
  const n = needs.find((x) => x.t.id === t.id && x.admitted);
  const heldN = !n ? needs.find((x) => x.t.id === t.id && x.held) : null;
  const cur = c.items.find((i) => i.state === "doing") || c.items.find((i) => i.state === "todo");
  const segs = c.items.map((i) => `<i class="sg s-${i.state}"></i>`).join("");
  const st = n ? `Needs you · ${EFFORT[n.effort].time}` : isBusy(t) ? `Working${c.total ? ` · ${c.done} of ${c.total}` : ""}` : t.state === "done" ? `Done${c.total ? ` · ${c.total} of ${c.total}` : ""}` : wordOf(t);
  const now = n ? `${ICON.needs}${askTitle(n)}` : isBusy(t) && cur ? `${ICON.doing}${esc(cur.text)}` : isHeld(t) ? esc(heldWords(t.held)) : t.stop ? esc(stopWords(t.stop)) : t.state === "failed" ? esc(String(t.happened || "").replace(/^Stopped:\s*/i, "")) : t.state === "done" ? esc(t.happened || "Finished.") : "";
  // a finished thread offers its real next step: the newest file it made, one click away (no file, no offer)
  const made = !n && t.state === "done" && REC.latestOf ? REC.latestOf(t.id, t.project) : null;
  return `<div class="tcard st-${n ? "needs" : stOf(t)}${made ? " has-next" : ""}">` +
    `<button type="button" class="tc-open" data-go="t:${esc(t.id)}" aria-label="Open thread: ${esc(t.title)}, ${esc(st)}">` +
    `<span class="tc-top">${stateMark(n ? "needs_reply" : glyphOf(t))}<b>${esc(t.title)}</b><span class="tc-st">${esc(st)}</span></span>` +
    `<span class="tc-segs${segs ? "" : " is-empty"}" aria-hidden="true">${segs}</span>` +
    (now ? `<span class="tc-now">${now}</span>` : "") +
    `<span class="tc-foot">${threadMark(t, { withName: true })}${t.branch && SHAPE.on("xo:thread/branch") ? `<code>${esc(t.branch)}</code>` : `<span>${noun("thread")}</span>`}${heldN ? `<span class="tc-cw">a small ask can wait</span>` : ""}<span>${short(t.lastAt) === "now" ? "just now" : short(t.lastAt) + " ago"}</span><span class="tc-go">Open ${ICON.arrow}</span></span></button>` +
    (n ? `<button type="button" class="tc-dec" data-decide="${esc(n.key)}">Decide</button>` : "") +
    (made ? `<button type="button" class="tc-next" data-made-file="${esc(made.key)}" title="${esc(made.path)}">${ICON.doc}<span>Open ${esc(made.title || made.name)}</span></button>` : "") + `</div>`;
}

/** Under your message that waits for the agent's turn to end: what happens to it, and Interrupt. */
function queuedMeta(conv, answered = false) {
  const t = convThread(conv);
  if (!t) return "";
  if (S.stops.has(t.sessionId) || world.act.sessionState(t.sessionId) === "stopping") return `<div class="meta"><i class="spin" aria-hidden="true"></i><span>Stopping its turn · it reads this next</span></div>`;
  // a runtime that steers took it into the running turn: nothing waits, nothing to interrupt (F7)
  if (sendWhileRunning(t) === "steered") return answered ? "" : `<div class="meta"><span>Sent into its current turn</span></div>`;
  const run = running(conv); // the conversation it's drawn in (the main chat, or a thread page in the panel)
  const n = workingRuns(t);
  const title = `Stop the agent's current turn${n ? ` and its ${n} sub-agent${n === 1 ? "" : "s"}` : ""} so it reads this now (Undo for 3 s)`;
  return `<div class="meta"><span>Waiting · the agent reads this when its current turn ends</span>` +
    (run && run.kind === "thread" ? `<button type="button" class="meta-btn" data-interrupt title="${esc(title)}">${ICON.bolt}Interrupt</button>` : "") + `</div>`;
}

function nameOf(conv, who) {
  if (who === "coord") return [conv === "ws" ? "Coordinator" : `${PROJ(convProject(conv))} coordinator`, ""];
  const t = convThread(conv);
  return [t ? `${PROJ(t.project)} agent` : "Agent", (SHAPE.on("xo:thread/branch") && t?.branch) || SHAPE.word("thread")];
}

/** F4: the two ends of a move, linked both ways. The reason is the server's, after its colon. */
function moveBannerHtml(m, here) {
  const reasonOf = (text) => { const i = String(text || "").indexOf(": "); return i > 0 ? text.slice(i + 2).trim() : ""; };
  const link = (ts, fallback) => { const o = world.thread(ts); return o ? `<button type="button" class="rt-go" data-go="t:${esc(ts)}" title="Open “${esc(o.title)}”"><b>${esc(o.title)}</b></button>` : `<b>${esc(fallback)}</b>`; };
  if (m.continuedIn) {
    const to = world.thread(m.continuedIn), mv = (here && here.movedTo) || {};
    const agent = (to && agentOf(to)) || mv.agent;
    const why = mv.reason || reasonOf(m.text);
    const frozen = !!(here && here.frozen);
    return `<div class="ev mv-ban"><span class="ev-ic">${ICON.runtime}</span><span class="ev-t">Continued in ${link(m.continuedIn, "a new thread")}${agent ? ` on ${esc(rtName(agent))}` : ""}${why ? `: ${esc(why)}` : ""}</span>` +
      (frozen ? `<button type="button" class="ev-undo" data-unfreeze="${esc(here.id)}" title="Its agent carries on here; the new thread keeps going too">Pick this thread back up</button>` : "") + `<time>${clock(m.at)}</time></div>`;
  }
  const from = world.thread(m.continuedFrom);
  const fromAgent = from ? agentOf(from) : null;
  return `<div class="ev mv-ban"><span class="ev-ic">${ICON.runtime}</span><span class="ev-t">Continued from ${link(m.continuedFrom, "an earlier thread")}${fromAgent ? ` (${esc(rtName(fromAgent))})` : ""}${reasonOf(m.text) ? `: ${esc(reasonOf(m.text))}` : ""}</span><time>${clock(m.at)}</time></div>`;
}
const HS_THEM = (n) => `<div class="hs-them" aria-hidden="true"><i class="hs-av"></i><div class="hs-b"><i class="hs-bar hs-name"></i>${"<i class=\"hs-bar\"></i>".repeat(n)}</div></div>`;
const HIST_SKEL = `<div class="hist-skel" role="status"><span class="sr-only">Loading earlier messages</span>${HS_THEM(2)}` +
  `<div class="hs-you" aria-hidden="true"><i class="hs-bub"><i class="hs-bar"></i></i></div>${HS_THEM(1)}</div>`;
/** Has anyone answered after your message? A message from the coordinator or an agent, or a finished turn that
    said something (a running turn, or one that only used tools, hasn't answered yet). Then its receipt is done. */
const answeredAfter = (list, m) => {
  const i = list.indexOf(m);
  return i >= 0 && list.slice(i + 1).some((x) => x.who === "coord" || x.who === "agent" ||
    (x.who === "turn" && x.turn && x.turn.status !== "running" && Array.from(x.blocks || []).some((b) => b && (b.type === "answer" || b.type === "text") && String(b.text || "").trim())));
};
/** The thread a hop handed your message to, by the hop's own message ids; null when no hop names it. */
function passedTo(m) {
  if (!world.state.hops) return null;
  // the message as the server knows it: a row carries its server id (sid); a bubble you sent here keeps its
  // local id (id, key), and S.alias maps the server's id to it once the row is back
  const ids = new Set([m.sid, m.id, m.key].filter(Boolean));
  for (const [sid, lid] of S.alias) if (ids.has(lid)) ids.add(sid);
  if (!ids.size) return null;
  for (const h of world.state.hops.values()) {
    if ((h.kind === "relay" || h.kind === "brief") && h.to_role === "thread" && h.thread_ts && (h.message_ids || []).some((x) => ids.has(x))) return world.thread(h.thread_ts)?.title || "a thread";
  }
  return null;
}
const STARTS = [
  { ic: "plus", label: "Make something new", say: () => `Start a ${SHAPE.word("thread")} to make ` },
  { ic: "edit", label: "Fix or change something", say: () => "Fix " },
  { ic: "search", label: "Explain how this project works", say: () => "Read through this project and explain how it works." },
  { ic: "clock", label: "Do something on a schedule", say: () => "Every weekday at 9:00, " },
];
function startHtml(pid) {
  return `<div class="m-start"><h2 class="st-h">What should get done in ${esc(PROJ(pid))}?</h2><ul class="st-list">${STARTS.map((o, i) =>
    `<li><button type="button" class="st-o" data-start="${i}"><span class="st-ic" aria-hidden="true">${ICON[o.ic]}</span>${esc(o.label)}</button></li>`).join("")}</ul></div>`;
}
function startDraft(i) {
  const o = STARTS[i];
  if (!o || say.value.trim()) return;
  say.value = o.say();
  growSay(); saveDraft(); updateComposer(); say.focus();
  say.setSelectionRange(say.value.length, say.value.length);
}

function msgItems(conv, needs) {
  drawing = conv;
  try { return msgItemsOf(conv, needs); } finally { drawing = null; }
}
function msgItemsOf(conv, needs) {
  if (CH.isChats(conv)) return CH.items(conv);
  if (conv.startsWith("t:") && !convThread(conv)) {
    // a link to a thread that isn't here (removed, or from before a reset): said plainly, never an empty page
    const known = projects().length > 0;
    return [{ key: "gone", html: known
      ? `<div class="calm"><div class="calm-mark">${ICON.thread}</div><h2>This thread isn't here.</h2><p>It may have been removed, or the link is older than this Space. Everything else is where you left it.</p><div class="calm-act"><button type="button" class="btn" data-go="home">Go to Home</button></div></div>`
      : `<div class="calm"><div class="calm-mark">${ICON.thread}</div><h2>Looking for this thread…</h2></div>` }];
  }
  const list = messagesOf(conv);
  const items = [];
  let day = "", prev = null, above = null;
  // who spoke last: a thread names a speaker only when it changes (its agent's turn counts as the agent); a
  // project's or the Workspace's chat names no one
  const named = !!convThread(conv);
  let spoke = null;
  const lastYou = [...list].reverse().find((m) => m.who === "you");
  // your newest message the agent hasn't read yet: Interrupt stops the turn so it reads it next
  const lastQueued = [...list].reverse().find((m) => m.queued);
  // a changed file's chip carries its +/− counts, and reads as chosen while the panel shows its diff
  // the chosen file: the one beside the chat when a file is open there (the middle), else the panel's
  const chosen = STAGE.chosen(conv);
  const changed = (target) => { const c = CHG.forTarget(conv, target); return c ? { additions: c.file.additions, deletions: c.file.deletions, binary: c.file.binary, on: c.path === chosen } : null; };
  for (const m of list) {
    const d = Number.isFinite(m.at) ? dayOf(m.at) : day;
    if (d !== day) { items.push({ key: "day|" + d, html: `<div class="day" role="separator"><span>${esc(d)}</span></div>` }); day = d; prev = null; above = null; spoke = null; }
    const cont = prev && prev.who === m.who && prev.name === m.name && m.at - prev.at < 5 * 60000 && (prev.fwd?.chatId || null) === (m.fwd?.chatId || null) && (m.who === "you" || m.who === "coord" || m.who === "agent");
    let html = "";
    if (m.who === "you") {
      spoke = "you";
      let meta = "";
      if (m.status === "sending") meta = `<div class="meta is-sending"><i class="spin" aria-hidden="true"></i>Sending</div>`;
      else if (m.status === "failed") meta = `<div class="meta is-err"><span${m.err ? ` title="${esc(m.err.text)}"` : ""}>${m.err ? esc(m.err.title) : "Not sent"}</span><button type="button" class="meta-btn" data-retry="${esc(m.id)}">${ICON.retry}Retry</button><button type="button" class="meta-btn" data-edit="${esc(m.id)}">${ICON.edit}Edit</button></div>`;
      else if (m === lastQueued) meta = queuedMeta(conv, answeredAfter(list, m));
      else if (m === lastYou && (m.status === "sent" || m.sent) && !answeredAfter(list, m)) {
        // a receipt that follows the message only as far as the record proves: received by XO, then handed to a
        // thread (a relay or brief hop that names this message); it goes once an answer is on screen
        const to = passedTo(m);
        meta = `<div class="meta"><time>${clock(m.at)}</time><span class="sent">${to ? `Passed to <b>${esc(to)}</b>` : "Received by XO"} ${ICON.check}</span></div>`;
      }
      let route = "";
      if (m.waiting) route = `<div class="route-row"><i class="dash" aria-hidden="true"></i>Sent to <b>${esc(m.target === "workspace" ? "the coordinator" : PROJ(m.target))}</b> · waiting for a thread</div>`;
      else if (m.relay) {
        // passed on into this thread: say from where, and go back there (to the message itself)
        const r = m.relay, P = PROJ(r.project);
        const when = r.at ? ` at ${clock(r.at)}` : "";
        route = r.fwd
          ? `<div class="route-row">${ICON.arrow}<span>You, in the <button type="button" class="rt-go" data-go="ws" data-go-msg="${esc(r.fwd.id)}" title="Where you wrote it"><b>Workspace</b></button> · passed on${when} by ${esc(P)}'s coordinator</span></div>`
          : `<div class="route-row">${ICON.arrow}<span>You, in <button type="button" class="rt-go" data-go="p:${esc(r.project)}" data-go-msg="${esc(r.id)}" title="Where you wrote it"><b>${esc(P)}'s chat</b></button> · passed on${when} by the coordinator</span></div>`;
      }
      else if (m.fwd) {
        // work one project handed another: "from sys via the Workspace", back to where you wrote it
        const src = fwdSource(m.fwd);
        route = src
          ? `<div class="route-row">${ICON.arrow}<span>From <button type="button" class="rt-go" data-go="p:${esc(src)}" data-go-msg="${esc(m.fwd.id)}" title="Where you wrote it"><b>${esc(PROJ(src))}</b></button> via the Workspace</span></div>`
          : `<div class="route-row">${ICON.arrow}<span>Forwarded by the <button type="button" class="rt-go" data-go="ws" data-go-msg="${esc(m.fwd.id)}" title="Where you wrote it"><b>Workspace</b></button></span></div>`;
      }
      else if (m.routed && m.routed.length) route = `<div class="route-row">${ICON.arrow}<span>Routed to ${[...new Set(m.routed.map((r) => r.chat))].map((c) => `<button type="button" class="rt-go" data-go="p:${esc(c)}"><b>${esc(PROJ(c))}</b></button>`).join(", ")}</span></div>`;
      // your pictures sit above your words, right-aligned (js/media.js); other files as cards
      const files = m.files && m.files.length ? mediaHtml(m.files.map((f) => fromAttachment(f, { chat: m.chatId, by: "You", at: m.at })), { side: "you" }) : "";
      html = `<div class="m m-you${cont ? " cont" : ""}${m.relay ? " is-relay" : ""}${m.status === "failed" ? " is-failed" : ""}${m.status === "sending" ? " is-pending" : ""}">${files}${m.text ? `<div class="bubble" title="${esc(clock(m.wrote ?? m.at))}">${youText(m.text)}</div>` : ""}${reactionsHtml(m.reactions)}${meta}${route}</div>`;
    } else if (m.who === "coord" || m.who === "agent") {
      // a copy from another chat is that chat's speaker, named for it, and closed by a ruled line saying so
      const word = m.who === "coord" ? "coordinator" : "agent", src = m.fwd ? fwdSource(m.fwd) : null;
      const [name, role] = m.name ? [m.name, m.role || ""] : src ? [`${PROJ(src)} ${word}`, ""] : nameOf(conv, m.who);
      const copy = !m.fwd ? "" : `<div class="route-row is-copy">${ICON.arrow}<span>Copied from ${src
        ? `<button type="button" class="rt-go" data-go="p:${esc(src)}" data-go-msg="${esc(m.fwd.id)}" title="Where it was written"><b>${esc(PROJ(src))}</b></button>'s ${word}<span class="via"> · via the Workspace</span>`
        : `the <button type="button" class="rt-go" data-go="ws" data-go-msg="${esc(m.fwd.id)}" title="Where it was written"><b>Workspace</b></button>`}</span></div>`;
      const av = m.who === "coord" ? `<div class="av">${XO}</div>` : `<div class="av av-t">${ICON.thread}</div>`;
      // the coordinator's violet (.m-coord) sets it apart only where it steps into a thread, beside the thread's own
      // agent, as bubbles always did; in its own chat it is the one speaking and stays neutral (the owner, 19 Nov 14:46Z)
      const tid = m.thread || m.threadId;
      const iq = m.iq ? `<span class="m-iq" title="${m.iq.src === "pinned" ? "Pinned for this conversation" : `Chosen by the ${esc(m.iq.src)}`}">${esc(m.iq.name)} ${m.iq.pips} · ${esc(m.iq.src)}</span>` : "";
      // what an agent shares on its message shows under its words, on its text column
      const media = m.files && m.files.length ? mediaHtml(m.files.map((f) => fromAttachment(f, { chat: m.chatId, by: name, at: m.at })), { side: "them" }) : "";
      // words right under the line that introduces them (the question they answer, the steer that delivered them) are one exchange: that line already says who
      const under = !!(above && ((m.cause && above.who === "asked" && above.hop === m.cause) || (m.lead && above.key === m.lead)));
      const anon = !named || spoke === name || under;
      spoke = name;
      if (under) items[items.length - 1].html = items[items.length - 1].html.replace(/^<div class="ev /, '<div class="ev is-lead ');
      html = `<div class="m m-them${(m.who === "coord" || m.coord) && convThread(conv) ? " m-coord" : ""}${cont ? " cont" : ""}${anon ? " m-anon" : ""}${under ? " m-under" : ""}">${cont ? `<div class="av av-gap"></div>` : av}<div class="mb">` +
        (cont ? "" : `<div class="mh"><b>${esc(name)}</b>${role ? `<span class="role">${esc(role)}</span>` : ""}<time>${clock(m.at)}</time>${iq}</div>`) +
        `${m.text ? proseHtml(m.text) : ""}${media}${reactionsHtml(m.reactions)}${copy}${tid ? threadCardHtml(tid, needs) : ""}${(m.threads || []).map((x) => threadCardHtml(x, needs)).join("")}</div></div>`;
    } else if (m.who === "turn") {
      const inner = turnHtml(m.turn, m.blocks, { open: S.tbOpen, hideAnswer: m.hideAnswer, carried: m.carried, route: (p) => fileRoute(p, conv), by: nameOf(conv, "agent")[0], working: m.working, changed });
      if (!inner) { prev = m; continue; }
      // is-folded: running with nothing pressed open and no step waiting on you (the working bubble shows)
      const live = m.turn.status === "running", unfolded = inner.includes('aria-expanded="true"') || /class="[^"]*\bis-waiting\b/.test(inner);
      // has-said: while it works it has already said something (words, files) that shows above its bubble
      const said = live && !unfolded && /class="turn[^"]*\bis-said\b/.test(inner);
      spoke = nameOf(conv, "agent")[0];
      html = `<div class="m m-them m-turn${live ? " is-live" : ""}${live && !unfolded ? " is-folded" : ""}${said ? " has-said" : ""}">${turnAv(m.turn, m.blocks)}<div class="mb">${inner}</div></div>`;
    } else if (m.who === "card") {
      html = `<div class="m m-them m-card"><div class="av av-gap"></div><div class="mb">${threadCardHtml(m.thread, needs)}</div></div>`;
    } else if (m.who === "system" && m.back) {
      // a copy of your own earlier message in this chat, handed back by a forward: a quote of it, never a second bubble
      const b = m.back, q = b.text.replace(/\s+/g, " ").trim(), via = (b.via || []).find((v) => v !== "workspace" && v !== "project" && world.project(v));
      html = `<div class="ev ev-sys ev-back"><span class="ev-ic">${ICON.arrow}</span><span class="ev-t">Your earlier message <button type="button" class="rt-go" data-go="p:${esc(convProject(conv))}" data-go-msg="${esc(b.id)}" title="Where you wrote it">“${esc(q.length > 40 ? q.slice(0, 39) + "…" : q)}”</button> came back${via ? ` via ${esc(PROJ(via))}` : ""}</span><time>${clock(m.at)}</time></div>`;
    } else if (m.who === "system" && m.passedOn) {
      // XO's line: this project's work went on to another project, through the Workspace (always shown)
      const p = m.passedOn;
      html = `<div class="ev ev-sys ev-pass"><span class="ev-ic">${ICON.arrow}</span><span class="ev-t">Passed to <button type="button" class="rt-go" data-go="p:${esc(p.project)}"${p.to ? ` data-go-msg="${esc(p.to)}"` : ""} title="Open ${esc(PROJ(p.project))}'s chat"><b>${esc(PROJ(p.project))}</b></button> through the Workspace</span><time>${clock(m.at)}</time></div>`;
    } else if (m.who === "control") {
      const c = m.ctl;
      const who = c.by === "workspace-coordinator" ? "The workspace coordinator" : "The coordinator";
      const text = c.action === "steer" ? `${who} added to the running turn` : c.action === "interrupt" ? `${who} interrupted the turn` : `${who} stopped the thread${c.reason ? `: ${c.reason}` : ""}`;
      html = `<div class="ev ev-sys ev-ctl is-${esc(c.action)}"${c.reason && c.action !== "stop" ? ` title="${esc(c.reason)}"` : ""}><span class="ev-ic">${c.action === "steer" ? ICON.arrow : c.action === "interrupt" ? ICON.pause : ICON.close}</span><span class="ev-t">${esc(text)}</span><time>${clock(m.at)}</time></div>`;
    } else if (m.who === "limit") {
      const it = m.item, L = it.limit;
      const opts = (it.options || []).map((o) => `<button type="button" class="${o.decision === "move" ? "btn btn-pri" : "btn"}" data-limit="${esc(it.id)}" data-limit-d="${esc(o.decision)}"${S.limitBusy === it.id ? " disabled" : ""}>${esc(o.label)}</button>`).join("");
      html = `<div class="lim-ban" role="group" aria-labelledby="lim-h-${esc(it.id)}"><p class="lim-h" id="lim-h-${esc(it.id)}">${ICON.clock}<span>${esc(it.title)}${L.resetsAt && untilWords(L.resetsAt) ? ` <em>${esc(untilWords(L.resetsAt))}</em>` : ""}</span></p>` +
        (it.why ? `<p class="lim-why">${esc(it.why)}</p>` : "") + (S.limitErr && S.limitErr.id === it.id ? `<p class="rt-ferr" role="alert">${esc(S.limitErr.text)}</p>` : "") + `<div class="lim-acts">${opts}</div></div>`;
    } else if (m.who === "system" && (m.continuedIn || m.continuedFrom)) {
      html = moveBannerHtml(m, convThread(conv));
    } else if (m.who === "asked") {
      // the thread's own message to its coordinator: one quiet line, the whole text on a press
      const open = !!S.tbOpen[m.key];
      html = `<div class="ev ev-sys ev-asked${open ? " is-open" : ""}"><span class="ev-ic">${ICON.arrow}</span><button type="button" class="ev-t" data-tb="${esc(m.key)}" aria-expanded="${open}" title="${open ? "Fold" : "Show all of it"}">Asked the coordinator: ${esc(m.text)}</button><time>${clock(m.at)}</time></div>`;
    } else if (m.who === "system") {
      html = `<div class="ev ev-sys" title="${esc(m.text)}"><span class="ev-ic">${ICON.router}</span><span class="ev-t">${esc(m.text)}</span><time>${clock(m.at)}</time></div>`;
    } else if (m.who === "note") {
      html = m.load ? `<div class="m-load" role="status"><i class="spin is-load" aria-hidden="true"></i><span class="sr-only">${esc(m.load)}</span></div>` : `<p class="m-note">${esc(m.text)}</p>`;
    } else if (m.who === "start") {
      html = startHtml(m.pid);
    } else if (m.who === "hist") {
      const h = m.h;
      // older messages on their way: the shapes of messages where they will land, never a spinner
      html = h.loading ? HIST_SKEL
        : `<div class="day hist" role="separator">${h.all ? `<span>${h.capped ? "Showing the latest 1,000 messages" : "Beginning of the conversation"}</span>` : h.olderError ? `<span>Couldn't load earlier messages</span><button type="button" class="hist-more" data-older>Try again</button>` : `<button type="button" class="hist-more" data-older>Earlier messages</button>`}</div>`;
    } else if (m.who === "event") {
      html = `<div class="ev ev-${m.tone || "ok"}"><span class="ev-ic">${m.tone === "back" ? ICON.rewind : m.tone === "stop" ? ICON.close : m.tone === "sys" ? ICON.pause : ICON.check}</span><span class="ev-t">${esc(m.text)}</span><time>${clock(m.at)}</time></div>`;
    } else if (m.who === "rec") {
      const canUndo = m.undo && Date.now() < m.until;
      html = `<div class="ev ev-rec${m.refused ? " is-refused" : ""}"><span class="ev-ic">${m.refused ? ICON.close : ICON.router}</span><span class="ev-t">${esc(m.text)}</span>${canUndo ? `<button type="button" class="ev-undo" data-rec-undo="${esc(m.id)}">Undo</button>` : ""}<time>${clock(m.at)}</time></div>`;
    }
    items.push({ key: m.key, html });
    prev = above = m;
  }
  return items;
}

// ── headers: Workspace, project (title + one sentence + the Now shelf), thread (+ checklist) ──

/** The title bar's count line, set as type: each figure a shade brighter than its word, in
 *  tabular figures so a count that changes never shifts the line, and a quiet dot between; a narrow
 *  line breaks only at a dot, never inside "1 resolved". */
const counted = (n, word) => (n ? `<span class="pj-c"><span class="pj-k">${n}</span> ${word}</span>` : "");
const countLine = (bits) => bits.filter(Boolean).join(`<span class="pj-d" aria-hidden="true"> · </span>`);

/** A chat whose own coordinator asks: "Needs you" leads its count line, and opens the card above the composer. */
function hostNeedHtml(v, needs) {
  const h = convHost(v);
  const n = h ? needs.find((x) => x.t.id === h.id && !x.later && (x.admitted || x.held)) : null;
  if (!n) return "";
  const k = h.asks.length;
  const who = h.asker ? "Coordinator" : h.title;
  return `<button type="button" class="pj-need" data-dock-open="${esc(n.key)}" title="Open the decision, above the composer">` +
    `${stateMark("needs_approval")}<span class="pj-nt">${esc(who)} needs you</span>${k > 1 ? ` <span class="pj-k">${k}</span>` : ""}</button>`;
}


function conversationHeaderHtml(v, t, needs) {
  let who;
  if (v === "ws") {
    const P0 = homeParts(needs);
    // hub #28: a normal chat's header, like a project's: the counts in one line, what needs you one click away
    const asking = new Set(needs.map((n) => n.t.id));
    const working = world.state.threads.filter(isBusy).length;
    // held back by a gate (the usage limit…): "waiting", the word its badge and the Waiting filter use; neither working nor idle
    const waiting = world.state.threads.filter((x) => isHeld(x) && !asking.has(x.id)).length;
    const idle = world.state.threads.filter((x) => x.state === "working" && !isBusy(x) && !isHeld(x) && !asking.has(x.id)).length;
    const done = doneToday().length;
    const parts = [counted(working, "working"), counted(waiting, "waiting"), counted(P0.held.length, "can wait"), counted(idle, "idle"), counted(done, "finished today")].filter(Boolean);
    const need = hostNeedHtml(v, needs);
    const line = countLine([...(parts.length ? parts : ["All quiet"]), projects().length && `across ${counted(projects().length, projects().length === 1 ? "project" : "projects")}`]);
    // the counts go to Home; what the Workspace's own coordinator asks opens here, so the two are separate buttons
    who = `<span class="tw-ic tw-xo" aria-hidden="true">${XO}</span><span class="tw-t"><h1 id="conv-title">Workspace</h1>${need ? `<span class="pj-s has-need">${countLine([need, `<button type="button" class="pj-home" data-go="home" title="What needs you is on Home">${line}</button>`])}</span>` : `<button type="button" class="pj-s pj-home" data-go="home" title="What needs you is on Home">${line}</button>`}</span>`;
  } else if (v.startsWith("p:")) {
    const pid = v.slice(2);
    // the same count and words as the panel's Threads (threadCounts): every thread, Done folded there
    const by = threadCounts(pid, needs);
    const need = hostNeedHtml(v, needs);
    // the header says the project has threads (the owner, 19 Nov 14:20Z picked it beside Deploy): Threads and how
    // many, what's at work, what needs you; one control among the header's actions, apart from the title
    who = `<button type="button" class="pj-pick" data-pj-icon="${esc(pid)}" aria-haspopup="dialog" aria-expanded="${PICK.pid === pid}" title="Change ${esc(PROJ(pid))}'s icon" aria-label="Change ${esc(PROJ(pid))}'s icon"><span class="tw-ic" aria-hidden="true">${projectIcon(pid)}</span></button><span class="tw-t is-one"><h1 id="conv-title"${S.desc[pid] ? ` title="${esc(S.desc[pid])}"` : ""}>${esc(PROJ(pid))}</h1>${need}</span>`;
    S.hdrCtl = threadsCtl(by.all, by);
  } else if (t) {
    const ed = S.tEdit && S.tEdit.tid === t.id ? S.tEdit.field : null;
    // the field shows what was typed (kept through a refusal), and says it's waiting while it saves
    const edVal = ed ? S.tEdit.value : "", edBusy = ed && S.tEdit.busy ? ' aria-busy="true" readonly' : "";
    const title = ed === "title"
      ? threadTitleInput(edVal, edBusy)
      : `<h1 class="tw-h" id="conv-title">${esc(t.title)}</h1>`;
    const label = ed === "label"
      ? threadLabelInput(edVal, edBusy)
      : t.label ? `<span class="tw-label" title="Label">${esc(t.label)}</span>` : "";
    const resolved = t.state === "resolved";
    const acts = world.act.storm ? `<span class="tw-acts"><button type="button" class="tw-act" data-key="tw-resolve" data-resolve="${esc(t.id)}" data-to="${resolved ? "open" : "resolve"}"${busyAttrs(`resolve:${t.id}`)} title="${resolved ? "Reopen it: its agent can pick it up again" : "Mark it resolved: nothing more is owed"}">${resolved ? ICON.retry : ICON.check}<span>${resolved ? "Reopen" : "Resolve"}</span></button>` +
      `<button type="button" class="tw-act tw-more" data-tmenu="${esc(t.id)}" aria-haspopup="menu" aria-expanded="${S.tMenu === t.id && S.tMenuIn !== "page"}" title="Everything this thread can do" aria-label="Thread actions">${ICON.more}</button>` +
      (S.tMenu === t.id && S.tMenuIn !== "page" ? threadMenuHtml(t) : "") + `</span>` : "";
    // a shell in its worktree is in the menu (and the shells dock); the header keeps Resolve and the panel
    const ext = headerActionsHtml(kernel.places, atOf(v)), allActs = acts ? acts.replace(/<\/span>$/, `${ext}${LP.button(v, LW.isOpen)}${STAGE.button(v)}</span>`) : `<span class="tw-acts">${ext}${LP.button(v, LW.isOpen)}${STAGE.button(v)}</span>`;
    who = `${title}${label}<span class="badge st-${stOf(t)}">${stateMark(glyphOf(t))}${isHeld(t) ? heldBadge(t.held) : wordOf(t)}</span>${rtTag(t)}${allActs}`;
    // a field being edited is never replaced under the person's fingers (a frame may change the badge)
    if (ed && $("#tw-edit")) who = null;
  } else who = `<span class="tw-t"><h1 id="conv-title">Thread</h1></span>`;
  return who;
}


/** The checklist bar: shows the step in progress; a finished step flashes its tick, then moves on. */
function checklistRender(needs, th = $("#thead"), view = S.view, listId = "ck-list") {
  const t = convThread(view);
  if (!t) { th.hidden = true; th._h = ""; return; }
  const c = t.checklist;
  // no steps, no checklist: a thread without a plan has nothing to disclose and no step to count, so the head holds
  // only its runs (none: it hides). It painted a 0-of-0 toggle that opened onto nothing and said "All 0 steps done"
  // (the create-project/Launchpad grader on 70375ad, C045). The bar comes with the agent's first step.
  if (!c.total) {
    const all = runsStrip(t);
    if (th._h !== all) { redraw(th, all); th._h = all; }
    th.hidden = !all;
    return;
  }
  th.hidden = false;
  const open = !!S.ckOpen[t.id];
  const seen = S.ckSeen[t.id];
  if (seen != null && c.done > seen) {
    const doneStep = c.items[c.done - 1];
    S.ckFresh = { tid: t.id, text: doneStep ? doneStep.text : "Step done", until: Date.now() + 1500 };
    setTimeout(schedule, 1560);
  }
  S.ckSeen[t.id] = c.done;
  const fresh = S.ckFresh && S.ckFresh.tid === t.id && S.ckFresh.until > Date.now() ? S.ckFresh : null;
  const n = needs.find((x) => x.t.id === t.id);
  const cur = c.items.find((i) => i.state === "doing") || c.items.find((i) => i.state === "todo");
  let mode = "working", nowHtml;
  if (fresh) { mode = "fresh"; nowHtml = `<span class="ck-m is-ok">${ICON.check}</span><span>${esc(fresh.text)}</span>`; }
  else if (n && WAITING(t.state)) { mode = "needs"; nowHtml = `<span class="ck-m is-amber">${ICON.needs}</span><span>Paused on you</span>`; }
  else if (t.stop) { mode = "stopped"; nowHtml = `<span class="ck-m">${ICON.stop}</span><span>${esc(stopWords(t.stop))}</span>`; }
  else if (t.state === "failed") { mode = "failed"; nowHtml = `<span class="ck-m is-red">${ICON.stop}</span><span>Stopped at “${esc(cur ? cur.text : "a step")}”</span>`; }
  else if (c.done >= c.total) { mode = "done"; nowHtml = `<span class="ck-m is-ok">${ICON.check}</span><span>All ${c.total} steps done</span>`; }
  else if (t.state === "resolved") { mode = "done"; nowHtml = `<span class="ck-m">${ICON.stop}</span><span>Resolved at ${c.done} of ${c.total}</span>`; }
  else nowHtml = `<span class="ck-m is-blue">${ICON.doing}</span><span>${esc(cur ? cur.text : "Working")}</span>`;
  const segs = c.items.map((i, k) => `<i class="sg s-${i.state}${fresh && k === c.done - 1 ? " is-pop" : ""}"></i>`).join("");
  const list = c.items.map((i) => `<li class="ck ck-${i.state}"><span class="ck-m" aria-hidden="true">${stepMark(i.state)}</span><span>${esc(i.text)}</span><span class="sr-only">, ${i.state === "doing" ? "in progress" : i.state}</span></li>`).join("");
  const html = `<div class="ckbar m-${mode}${open ? " is-open" : ""}">` +
    `<div class="ck-row"><button type="button" class="ck-tog" data-ck aria-expanded="${open}" aria-controls="${listId}" title="Checklist">` +
    `<span class="ck-segs" aria-hidden="true">${segs}</span><span class="ck-n">${c.done} of ${c.total}</span>` +
    `<span class="ck-now" data-mode="${mode}">${nowHtml}</span>${t.branch && SHAPE.on("xo:thread/branch") ? `<code class="ck-br">${ICON.branch}${esc(t.branch)}</code>` : ""}<span class="ck-chev">${ICON.chevron}</span></button></div>` +
    `<div class="ck-b"><ol class="ck-list" id="${listId}" aria-label="Checklist">${list}</ol></div></div>`;
  // in place: the toggle you pressed is the same element afterwards (it keeps focus), and so is a run's row
  const all = html + runsStrip(t);
  if (th._h !== all) { redraw(th, all); th._h = all; }
}

const { runsStrip, workingRuns } = createRunsStrip({ world, SHAPE, schedule });
// Sub-agents: a page in the right panel, over the thread page it was opened from
const runsCard = document.createElement("div");
Object.assign(runsCard, { id: "runs-card", className: "runs-pg", tabIndex: -1 });
runsCard.setAttribute("role", "region");
runsCard.setAttribute("aria-label", "Sub-agents");
const RS = { cmdsOpen: true, cmdsAll: false, said: null, gen: 0, opening: 0, open: false, session: null, title: "", view: "list", tree: [], counts: null, runId: null, run: null, anc: null, items: [], cursor: null, children: [], loading: false, error: null, gone: null, pollT: null, returnTo: null };
const pendingStops = [];
const { stopsHerald, stopRun, interruptRun } = createConversationStops({ S, world, Kit, PROJ, announce, schedule, chatOf, pendingStops, heraldShow, heraldNext, inUse: (selector) => inUse(selector), running, workingRuns });
const stopsOut = new Set();
const { runsRender, runsLand, closeRuns, runsGone } = createRunsPanel({ RS, S, world, STAGE, runsCard, pendingStops, stopsOut, placeRegion: () => placeRegion(), threadScroller: () => TP.C?.scroller });
/** ‹ and Esc: from a run to the list, its row in focus; from the list, back to the thread. */
function runsEscape() {
  if (RS.view !== "run") { closeRuns(); return; }
  const id = RS.runId;
  RS.gen++; RS.view = "list"; RS.runId = null; clearTimeout(RS.pollT); RS.keepScroll = false;
  runsRender(); STAGE.repaint();
  runsLand(`[data-run="${CSS.escape(id)}"]`)?.focus({ preventScroll: true });
}
const runsTitle = () => (RS.view === "run" ? (RS.run && /^(background_command|monitor)$/.test(RS.run.kind) ? "Command" : "Sub-agent") : "Sub-agents");
const { readRunsList, openRun } = createRunsReads({ RS, world, STAGE, runsRender });
STAGE.page("runs", {
  over: true,
  title: runsTitle,
  backTo: () => (RS.view === "run" ? "Sub-agents" : RS.panelWas || STAGE.pageShown?.name !== "runs" ? "" : "the thread"),
  mount: (box) => box.append(runsCard),
  onShow: (_k, { focus } = {}) => { runsRender(); if (focus) runsCard.focus({ preventScroll: true }); },
  close: () => runsGone(),
  up: () => { runsEscape(); return true; },
  escape: () => { runsEscape(); return true; },
});
const openRuns = createRunsOpener(RS, {
  STAGE, readRunsList, openRun, runsRender, runsLand,
  headFor: (el) => (convAt(el) === MAIN ? $("#thead") : $("#tpthead")),
});
const stopRunsUndo = createRunsStop(RS, { pendingStops, stopsOut, stopsHerald, runsRender, announce, heraldShow, readRunsList, commitMs: Kit.COMMIT_MS });
runsCard.addEventListener("click", (e) => {
  if (e.target.closest("[data-runs-cmds]")) { if (RS.view === "run") RS.runCmds = !RS.runCmds; else RS.cmdsOpen = !RS.cmdsOpen; RS.keepScroll = true; runsRender(); return; }
  if (e.target.closest("[data-runs-more]")) { RS.cmdsAll = true; RS.keepScroll = true; runsRender(); runsCard.querySelector(".rn-cmds li:nth-child(9) button")?.focus({ preventScroll: true }); return; }
  const tb = e.target.closest("[data-tb]");
  if (tb) { S.tbOpen[tb.dataset.tb] = !S.tbOpen[tb.dataset.tb]; RS.keepScroll = true; runsRender(); return; }
  const st = e.target.closest("[data-run-stop]");
  if (st) { const r = world.state.runs.get(st.dataset.runStop) || { title: "this sub-agent" }; stopRunsUndo(r.title, () => world.act.stopRun(st.dataset.runStop), `run:${st.dataset.runStop}`); return; }
  if (e.target.closest("[data-runs-stop]")) { const sid = RS.session; stopRunsUndo("every sub-agent of this thread", () => world.act.stopRuns(sid), `all:${sid}`); return; }
  // the sheet's own Undo for a stop still waiting: it keeps working; focus goes back to the Stop it undid
  const un = e.target.closest("[data-runs-undo]");
  if (un) {
    const job = pendingStops.find((j) => j.key === un.dataset.runsUndo && !j.cancelled && !j.sent);
    if (job) { job.cancelled = true; pendingStops.splice(pendingStops.indexOf(job), 1); stopsHerald(); announce(`Not stopped. ${job.what} keeps working.`); }
    const back = job && job.key.startsWith("run:") ? `[data-run-stop="${CSS.escape(job.key.slice(4))}"]` : "[data-runs-stop]";
    runsRender();
    runsLand(back)?.focus({ preventScroll: true });
    return;
  }
  if (e.target.closest("[data-runs-retry]")) { const sid = RS.session, my = ++RS.opening; RS.listState = "loading"; runsRender(); readRunsList(sid, my).then((landed) => { if (!landed) return; runsRender(); runsLand()?.focus({ preventScroll: true }); }); return; }
  const op = e.target.closest("[data-run]");
  if (op) openRun(op.dataset.run);
});

// ── the thread's own decision: docked above the composer (Today's card, #20) ──
const tdock = $("#tdock");
function createDock({ el: tdock, view, region, TD = { key: null, item: null, busy: false, undone: null, gen: 0 } }) {
  const placeRegion = region;
function dockSwap(fill, to = null, opts = null) {
  const had = tdock.contains(document.activeElement);
  const run = () => {
    fill();
    if (had && !tdock.contains(document.activeElement)) (to && usable(to) ? to : placeRegion()).focus({ preventScroll: true });
  };
  if (opts) morph(tdock, run, opts); else run();
}
/** Another conversation in this dock: what it showed goes with the state that drew it, and work still running for it stops. */
function reset() {
  Object.assign(TD, { key: null, item: null, busy: false, undone: null, gen: TD.gen + 1 });
  tdock._ch = "";
  dockRO.disconnect();
  dockSwap(() => tdock.replaceChildren());
}
  const keepBottom = () => {}; // pinned at the latest, follow.js keeps the view there as the card changes
const GONE_FRESH = 5000; // a withdrawal older than this was not what just emptied the dock
const DOCK_Q_ROOM = 8; // under the question's last line: the body's own bottom padding and a little air
function fitDock(frame) {
  const body = frame && frame.querySelector(".c-body");
  if (!body || !frame.isConnected) return;
  const h = body.querySelector(".c-h");
  if (frame.classList.contains("is-one")) frame.classList.remove("is-one");
  const one = !!h && h.getBoundingClientRect().bottom - body.getBoundingClientRect().top + DOCK_Q_ROOM > body.clientHeight + 0.5;
  frame.classList.toggle("is-one", one);
  // one scroll: the answers can start below the card's edge, so a pill on that edge says they're there
  let more = body.querySelector(".dock-more");
  if (one && !more) {
    more = document.createElement("button");
    more.type = "button";
    more.className = "dock-more";
    more.dataset.dockMore = "";
    more.innerHTML = `<span class="dm-p">Answers${ICON.chevron}</span>`;
    body.appendChild(more);
  } else if (!one && more) more.remove();
  dockEdges(frame);
}
function dockEdges(frame) {
  const sc = frame.classList.contains("is-one") ? frame.querySelector(".card-in") : frame.querySelector(".c-body");
  if (!sc) return;
  const more = sc.scrollHeight - sc.clientHeight > 1;
  sc.classList.toggle("fade-t", more && sc.scrollTop > 1);
  // in one scroll the "Answers" pill's own band is the bottom edge
  sc.classList.toggle("fade-b", more && !sc.matches(".card-in") && sc.scrollTop < sc.scrollHeight - sc.clientHeight - 1);
  // the answers in view: the "Answers" pill has said its piece and fades away
  const act = frame.querySelector(".c-act");
  if (act) frame.classList.toggle("ans-in", act.getBoundingClientRect().top < sc.getBoundingClientRect().bottom - 40);
  // the other scroller of the two never keeps a fade from the other mode
  const other = sc.matches(".c-body") ? frame.querySelector(".card-in") : frame.querySelector(".c-body");
  other?.classList.remove("fade-t", "fade-b");
}
const dockRO = new ResizeObserver(() => { const f = tdock.querySelector(".card.is-dock"); if (f) fitDock(f); });
tdock.addEventListener("scroll", () => { const f = tdock.querySelector(".card.is-dock"); if (f) dockEdges(f); }, { capture: true, passive: true });
function dockRender(needs) {
  // a chat: its "send now" question first, else its own open decision (the chat's host), as a thread docks one
  const hc = CH.isChats(view()) ? CH.confirmHtml(view()) : "";
  if (hc) { if (tdock._ch !== hc) { dockSwap(() => { tdock.innerHTML = hc; }); tdock._ch = hc; TD.key = null; } return; }
  if (tdock._ch) { tdock._ch = ""; dockSwap(() => { tdock.innerHTML = ""; }); TD.key = null; }
  if (view() === "chats") { if (TD.key) { TD.key = null; dockSwap(() => { tdock.innerHTML = ""; }); } return; }
  const t = convThread(view()) || convHost(view());
  const n = t && !D.isOpen() ? needs.find((x) => x.t.id === t.id && !x.later && (x.admitted || x.held)) : null;
  // Folded: the person chose to read the thread first. The ask waits as one slim line, and the
  // conversation isn't dimmed. A new ask on this thread docks open again.
  const folded = !!(n && S.dockFold[n.key]);
  const key = n ? n.key + (folded ? "|fold" : "") : null;
  if (TD.busy || key === TD.key) return;
  const prev = TD.key, gone = !n && prev ? world.state.gone.get(TD.item) : null;
  TD.key = key;
  TD.item = n && n.ask.item ? n.ask.item.id : null;
  if (!n) {
    if (!prev) { dockSwap(() => { tdock.innerHTML = ""; }); return; }
    if (gone && Date.now() - gone.at < GONE_FRESH) { goneRender(gone); return; }
    dockSwap(() => { tdock.innerHTML = ""; }, null, { duration: 300 });
    return;
  }
  const head = (() => { const tp = document.createElement("template"); tp.innerHTML = D.cardHtml(n, "dock").trim(); return tp.content.querySelector(".c-h")?.textContent.trim() || askShort(n); })();
  if (folded) {
    const E = EFFORT[n.effort];
    const bar = document.createElement("button");
    bar.type = "button";
    bar.className = `dock-fold r-${n.risk}`;
    bar.dataset.unfold = n.key;
    bar.title = "Open the decision";
    bar.innerHTML = `${stateMark(n.group === "stopped" ? "failed" : "needs_reply")}<span class="df-t">${esc(head)}</span><span class="df-e">${esc(E.label)} ${esc(E.time)}</span><span class="df-go">Open ${ICON.chevron}</span>`;
    dockSwap(() => { tdock.innerHTML = ""; tdock.appendChild(bar); }, bar, { duration: 300 });
    return;
  }
  const frame = document.createElement("article");
  frame.className = `card is-dock r-${n.risk} e-${n.effort}`;
  frame.tabIndex = -1;
  frame.setAttribute("aria-roledescription", "decision");
  frame.innerHTML = `<div class="stamp stamp-allow" aria-hidden="true">${ICON.stampAllow}</div><div class="stamp stamp-back" aria-hidden="true">${ICON.stampBack}</div>`;
  const tpl = document.createElement("template");
  tpl.innerHTML = D.cardHtml(n, "dock").trim();
  const inner = tpl.content.firstElementChild;
  frame.appendChild(inner);
  frame.setAttribute("aria-labelledby", inner.querySelector(".c-h").id);
  const what = t.host ? "chat" : "thread";
  // it sits in the card's own top row, on the effort label's line (hub #27), not floating over it
  (inner.querySelector(".c-top") || frame).insertAdjacentHTML("beforeend", `<button type="button" class="dock-hide" data-fold="${esc(n.key)}" title="Fold it away and read the ${what} first">${ICON.chevron}<span>Read the ${what} first</span></button>`);
  dockSwap(() => { tdock.innerHTML = ""; tdock.appendChild(frame); fitDock(frame); }, frame, { duration: prev ? 300 : 360, fade: frame });
  dockRO.disconnect();
  for (const el of [frame, frame.querySelector(".c-body"), frame.querySelector(".c-act")]) if (el) dockRO.observe(el);
  D.wireCard(frame, inner, n, {
    surface: "dock",
    onStep: keepBottom,
    after: async (how) => {
      TD.busy = true;
      const gen = TD.gen;
      if (!RM.matches && how !== "later") { frame.classList.add(`st-${how}`); await wait(380); if (TD.gen !== gen) return; }
      if (how !== "later") {
        // one calm line in place of the card, then it folds away
        const e = D.decisions()[0];
        const verb = e && e.verb === "Answered" ? `Answered “${e.said}”` : e ? e.verb : "Done";
        // the control pressed (Allow, an option, Send) goes with the card: focus goes to this line's Undo, at once
        const had = frame.contains(document.activeElement);
        morph(frame, () => {
          frame.className = "card is-dock r-done"; frame.innerHTML = `<p class="tp-done${how === "back" ? " is-back" : ""}" role="status"><span class="tp-done-ic">${how === "back" ? ICON.rewind : ICON.check}</span><span title="${esc(verb)}."><b>${esc(verb)}.</b> ${how === "back" ? "It's taking another route." : "It's back at work."}</span><button type="button" class="tp-done-u" data-dock-undo>Undo</button></p>`;
          if (had && !frame.contains(document.activeElement)) frame.querySelector("[data-dock-undo]").focus({ preventScroll: true });
        }, { duration: 300 });
        // the only Undo for this decision now: it stays for the whole 3 s window, in real time (hold, not wait:
        // reduced motion cuts the stamp's animation, never the time to Undo). Undone, the line ends there and then:
        // the card is back at once, and focus with it if it was on the Undo
        let undone = false;
        await new Promise((end) => { TD.undone = { key: n.key, end: () => { undone = true; end(); } }; hold(RM.matches ? 3000 : 2700).then(end); });
        if (TD.gen !== gen) return;
        TD.undone = null;
        if (undone) { TD.busy = false; TD.key = null; dockRender(D.needItems()); schedule(); return; }
      }
      TD.busy = false;
      TD.key = "__settling";
      dockSwap(() => { tdock.innerHTML = ""; }, null, { duration: 320 });
      TD.key = null;
      schedule();
    },
  });
}
/** The item withdrawn or expired under the dock: one line says so for 3 s, in Space's words, then the dock clears. */
async function goneRender(g) {
  const L = goneLine(g);
  const line = document.createElement("article");
  line.className = "card is-dock r-done";
  line.innerHTML = `<p class="tp-done is-gone" role="status"><span class="tp-done-ic">${ICON.clock}</span><span title="${esc(`${L.head}. ${L.text}`)}"><b>${esc(L.head)}.</b> ${esc(L.text)}</span></p>`;
  TD.busy = true;
  dockSwap(() => { tdock.innerHTML = ""; tdock.appendChild(line); }, null, { duration: 300 });
  const gen = TD.gen;
  await hold(3000);
  if (TD.gen !== gen) return;
  TD.busy = false;
  TD.key = "__settling";
  dockSwap(() => { tdock.innerHTML = ""; }, null, { duration: 320 });
  TD.key = null;
  schedule();
}
tdock.addEventListener("click", (e) => {
  if (e.target.closest("[data-dock-more]")) { tdock.querySelector(".card.is-dock .c-act")?.scrollIntoView({ block: "end", behavior: RM.matches ? "auto" : "smooth" }); return; }
  const f = e.target.closest("[data-fold]");
  if (f) { S.dockFold[f.dataset.fold] = true; dockRender(D.needItems()); placeRegion().focus({ preventScroll: true }); return; }
  const u = e.target.closest("[data-unfold]");
  // the card takes focus in the step that draws it, not a frame later: the line pressed is gone by then (S240)
  if (u) { delete S.dockFold[u.dataset.unfold]; dockRender(D.needItems()); tdock.querySelector(".card")?.focus({ preventScroll: true }); return; }
  if (e.target.closest("[data-dock-undo]")) D.undo();
});
tdock.addEventListener("keydown", (e) => {
  const card = tdock.querySelector(".card");
  if (!card) return;
  D.cardKeys(e, card, {});
});
  dockGestures(tdock);
  return { render: dockRender, reset, TD, el: tdock };
}
const MDOCK = createDock({ el: tdock, view: () => S.view, region: () => placeRegion(), TD: { key: null, item: null, busy: false, undone: null, gen: 0 } });
const TD = MDOCK.TD;
const dockRender = (needs) => MDOCK.render(needs);

// ── typing ──────────────────────────────────────────────────────────────────
/** An ask this project's coordinator sent to the Workspace that isn't answered yet. xo-space publishes the hop
    when the call happens ("sent"), marks it "delivered" when the Workspace's turn takes it and "answered" when
    the answer is made. Only an ask waits for a reply (a relay or a forward doesn't), and only for 20 minutes:
    an ask nobody answers mustn't hold the line for ever. */
function openAsk(project) {
  const chatId = world.project(project)?.chatId;
  if (!chatId || !world.state.hops) return null;
  let best = null, at = 0;
  for (const h of world.state.hops.values()) {
    if (h.chat_id !== chatId || h.kind !== "ask" || h.from_role !== "project-coordinator" || !(h.state === "sent" || h.state === "delivered")) continue;
    const t = Date.parse(h.created_at || h.at || "") || 0;
    if (t && Date.now() - t < 20 * 60e3 && t > at) { best = h; at = t; }
  }
  return best;
}
const sendingTo = (chat) => (S.local[convOfChat(chat)] || []).find((m) => m.status === "sending" && m.target === chat) || null;
let TYPING = null;
function typingRender(C = MAIN) { return (TYPING ||= createTyping({ world, CH, PROJ, convThread, chatOf, isBusy, heldWords, openAsk, sendingTo, schedule: () => schedule(), tick: () => tickElapsed() })).render(C); }
function toastLine(text) { announce(text); heraldShow({ kind: "done", text }, 1600); }
// only a clock whose words changed is written (a rewrite is a mutation every layer reacts to)
setInterval(tickElapsed, 1000);

// ── the dock line: one calm labelled line (no glow on the composer, ever) ───
// the herald's lines (core/services/notices.js): made on first use (S is the app's state), so a line asked for while the app is
// still starting has it
function HER() { return S._her || (S._her = createHerald({ state: S, schedule: () => schedule() })); }
regionRings(); // the keyboard's ring over a file's or a change's region (js/ring.js)
keepFocusInView(); // focus a script hands on is never left out of sight (js/focusview.js)
function heraldShow(h, ms) { return HER().show(h, ms); }
/** A message's own notice, set in place (on screen, or still waiting): see core/services/notices.js */
function heraldFor(mid, make, ms) { return HER().forMsg(mid, make, ms); }
function heraldNext() { return HER().next(); }
/** A subject's notice that's no longer true goes, on screen or waiting (core/services/notices.js drop). */
function heraldDrop(mid) { return HER().drop(mid); }
/** The notices' line of the conversation in use (the panel's thread page has its own); the other one is empty. */
const heraldBox = () => (composerNow() === MK ? $("#herald") : $("#tpherald"));
function heraldRender(needs) {
  const box = heraldBox();
  for (const o of [$("#herald"), $("#tpherald")]) if (o && o !== box && o.firstChild) { if (o.contains(document.activeElement)) heraldBack(o._line)?.focus({ preventScroll: true }); patch(o, ""); o._line = null; o._h = null; }
  const h = S.herald && S.herald.until > Date.now() ? S.herald : null;
  let html;
  if (h) {
    const ic = h.kind === "stopped" ? `<span class="hr-ic k-stopped">${ICON.close}</span>` : h.kind === "sent" ? `<i class="dash" aria-hidden="true"></i>` : h.kind === "ping" ? `<span class="hr-ic k-ping"><i class="hr-dot"></i></span>` : h.kind === "calm" || h.kind === "halt" ? `<span class="hr-ic k-calm">${h.kind === "halt" ? STOP_ICON : ICON.pause}</span>` : h.kind === "rec" ? `<span class="hr-ic k-calm">${ICON.router}</span>` : `<span class="hr-ic k-ok">${ICON.check}</span>`;
    const inner = `${ic}<span class="hr-t">${esc(h.text)}</span>${h.sub ? `<span class="hr-s">${esc(h.sub)}</span>` : ""}${h.open ? `<span class="hr-go">Open ${ICON.arrow}</span>` : h.decide ? `<span class="hr-go">Look ${ICON.arrow}</span>` : ""}`;
    html = h.open ? `<button type="button" class="hr hr-ev k-${h.kind}" data-go="${esc(h.open)}" data-hn="${h.n}">${inner}</button>`
      : h.decide ? `<button type="button" class="hr hr-ev k-${h.kind}" data-decide="${esc(h.decide)}" data-hn="${h.n}">${inner}</button>`
      : h.undo ? `<div class="hr hr-ev has-undo k-${h.kind}" data-hn="${h.n}">${inner}<button type="button" class="hr-undo" data-herald-undo>${esc(h.undoLabel || "Undo")}</button></div>`
      : `<div class="hr hr-ev k-${h.kind}" data-hn="${h.n}">${inner}</div>`;
  } else if (connLine(world.state, box === $("#herald") ? connDest() : { thread: true })) {
    // an honest, persistent line when XO can't be reached, can't run, or waits on a limit (P0-8); routing Off only
    // for where the composer's draft goes, the send gate's own destination: never beside a thread's reply
    const c = connLine(world.state, box === $("#herald") ? connDest() : { thread: true });
    html = `<div class="hr hr-conn k-${c.kind}" role="status"><span class="hr-ic ${c.kind === "down" ? "k-stopped" : "k-calm"}">${c.kind === "down" ? ICON.retry : ICON.pause}</span><span class="hr-t">${esc(c.text)}</span><span class="hr-s">${esc(c.sub)}</span></div>`;
  } else if (S.view === "home" || convThread(S.view)) html = "";
  else {
    // Only when something is worth your time. The quiet state ("Nothing needs you")
    // are already said by the sidebar's Home row and by Home, so no line sits here for them.
    html = ""; // what needs you is said once: the sidebar's Home row, then Home
  }
  const was = box._h;
  // the line with the control you're on goes (its Undo's window ended): focus goes on first, to what it acted on,
  // else the message box, never the page (Astra RUN-5)
  const fa = document.activeElement;
  if (fa && fa !== box && box.contains(fa) && !(h && fa.closest(`[data-hn="${h.n}"]`))) heraldBack(box._line)?.focus({ preventScroll: true });
  if (patch(box, html) && was != null && html) box.firstElementChild?.classList.add("is-in");
  box._line = h;
  heraldRoom();
}
function heraldRoom() {
  for (const [box, dock, host] of [[$("#herald"), $("#dock"), $("#app")], [$("#tpherald"), $("#tpdock"), TP.box]]) {
    if (!box) continue;
    const line = box.firstElementChild;
    const shown = line && line.getClientRects().length > 0;
    const px = shown ? Math.max(0, Math.round(dock.getBoundingClientRect().top - box.getBoundingClientRect().top)) : 0;
    const v = px ? `${px + 8}px` : "0px";
    if (host.style.getPropertyValue("--herald-room") !== v) host.style.setProperty("--herald-room", v);
  }
}
/** Where focus goes when a notice's line goes from under it: the control the notice acts on (h.back: selectors,
 *  e.g. the thread's Resolve, or Interrupt), else the message box, else the place's own region. */
function heraldBack(h) { return [...((h && h.back) || []).map((sel) => (typeof sel === "function" ? sel() : $(sel))), composerNow().say].find(usable) || placeRegion(); }
/** A notice's control in the conversation in use: its Send, or one in its own page. */
const inUse = (sel) => () => { const K = composerNow(); return sel === "#send" ? K.send : K.main ? $(sel) : TP.box.querySelector(sel); };

// ── intelligence: the record line and the chip ─────────────────────────────
const { recordLine, undoRecord } = createRecordLines({ S, announce, schedule, heraldShow, heraldNext, placeRegion: () => placeRegion() });
function chipRender(fade = false, K = MK) {
  const chip = K.iq;
  if (!chip) return;
  // a chat's agent, model and thinking are its own (js/chats.js), not the router's: a new chat's to choose, an open chat's fixed
  const s = sessionOf(K.view);
  const chat = CH.isChats(K.view) && K === MK, fixed = chat && K.view !== "chats";
  chip.hidden = chat ? !CH.chipHtml(K.view) : CH.isChats(K.view) || !IQ.kindOf(s);
  if (chip.hidden) return;
  const html = chat ? CH.chipHtml(K.view) : IQ.chipHtml(s, PHONE.matches);
  const title = chat ? CH.chipTitle(K.view) : IQ.chipTitle(s);
  chip.title = title;
  chip.setAttribute("aria-label", `Intelligence: ${title.replace(/ \([^)]*\)$/, "")}`);
  chip.setAttribute("aria-controls", chat ? "cs-pop" : "iq-pop");
  fixChip(chip, fixed);
  chip.classList.toggle("is-pinned", !chat && IQ.current(s).pinned);
  if (chip._h === html) return;
  const swap = () => { redraw(chip, html); chip._h = html; }; // in place: the chip's insides stay the nodes a press is on
  if (fade && chip._h && !RM.matches) {
    chip.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 80, fill: "forwards" }).finished.then(() => { swap(); chip.getAnimations().forEach((a) => a.cancel()); chip.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 80 }); });
  } else swap();
}

// ── the composer: send, or Stop while something runs ───────────────────────
const say = $("#say"), atList = $("#at-list");
const MK = { main: true, get view() { return S.view; }, say, send: $("#send"), form: $("#composer"), target: $("#target"), label: $("#say-label"), get conv() { return MAIN; },
  tray: $("#att-tray"), attach: $("#attach"), input: $("#att-input"), note: $("#att-note"), iq: $("#iq"), at: atList };
const { saveDraft, loadDraft } = createDrafts({ S, store, MK, updateComposer });
/** A thread page's composer, wired: Enter sends (Shift+Enter a new line), Esc leaves the field, Send or Stop. */
function wireComposer(K) {
  K.say.addEventListener("input", () => { K.at._sel = 0; updateComposer(K); saveDraft(K); });
  K.say.addEventListener("click", () => updateComposer(K));
  K.say.addEventListener("keydown", (e) => {
    if (e.isComposing || e.keyCode === 229) { e.stopPropagation(); return; }
    if (atKeys(e, K)) return;
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(K); }
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); K.say.blur(); }
  });
  K.form.addEventListener("submit", (e) => { e.preventDefault(); if (K.send.dataset.mode === "stop") stopRun(K.view); else send(K); });
  wireAt(K);
  K.target.addEventListener("click", () => aimAt(K));
}

// ── files on the unsent message (hub #30): the paperclip, a drop or a paste adds them; each uploads
// at once to the chat this conversation writes to, as a chip with its progress, Retry and Remove.
// Send waits for every upload and stays off while one has failed. A long paste becomes a file.
const attInput = $("#att-input");
let trayRaf = 0;
const tray = createTray({ upload: uploadAttachment, onChange: () => { if (!trayRaf) trayRaf = requestAnimationFrame(() => { trayRaf = 0; trayRender(); sendRender(); }); } });
/** Storm conversations take files; a plain chat (Chats) has no route for them. */
const canAttach = (v) => v !== "chats" && !CH.isChats(v);
/** The chat id a file added here uploads to: the Workspace, the project, or the thread's project. */
const attachChat = (v) => { const p = chatOf(v); return p && world.act.chatId ? world.act.chatId(p) : null; };
const filesHere = (view = S.view) => (canAttach(view) ? tray.status(view) : { count: 0, busy: false, failed: false });
// An image chip shows the picture itself, from the bytes the browser already holds: no request.
const thumbs = new WeakMap(); // blob → object URL, freed when the chip leaves the composer
const thumbOf = (c) => { let u = thumbs.get(c.blob); if (!u) { u = URL.createObjectURL(c.blob); thumbs.set(c.blob, u); } return u; };
const dropThumb = (c) => { const u = c && thumbs.get(c.blob); if (u) { URL.revokeObjectURL(u); thumbs.delete(c.blob); } };
const { liveBlock, blockFor, refuse, connDest, deliverLive, send, retry, putBack, editFailed } = createDelivery({
  S, world, MK, say, CH, STAGE, PROJ, chatOf, convOfChat, convThread, convProject, composerAt: (node) => composerAt(node),
  filesHere, tray, dropThumb, saveDraft, updateComposer, growSay, announce, heraldShow, heraldFor, schedule, render: () => render(), go,
});
const { targetLineRender, syncPlaceholder } = createComposerTarget({ MK, world, CH, PHONE, PROJ, convThread, convProject, liveBlock, isBusy, sendWhileRunning, noun });
function chipHtml(c) {
  const img = c.type ? kindOf(c.type) === "image" : /^image\//.test(c.blob?.type || "");
  const thumb = img && c.blob && c.state !== "failed";
  // once uploaded it opens in the viewer, like a sent message's file
  const ic = thumb ? `<img src="${esc(thumbOf(c))}" alt="" decoding="async">` : img ? ICON.image : ICON.doc;
  const state = c.state === "failed" ? `<span class="att-err">${esc(uploadErrorText(c.err))}</span>`
    : c.state === "uploading" ? `<span class="att-pct">Uploading</span>` : "";
  const sub = [c.paste ? esc(c.name) : esc(fmtSize(c.bytes ?? c.size)), state].filter(Boolean).join(" · ");
  const btn = (a, label, icon, extra = "") => `<button type="button" class="att-b" data-a="${a}" aria-label="${esc(label)}" title="${esc(label)}"${extra}>${icon}</button>`;
  return `<li class="att st-${c.state}${c.paste ? " is-paste" : ""}" data-lid="${esc(c.lid)}"${c.err ? ` title="${esc(c.err.message || "")}"` : ""}>` +
    (thumb && c.id ? `<button type="button" class="att-ic is-img" data-a="view" aria-label="Preview ${esc(c.name)}" title="Preview">${ic}</button>` : `<span class="att-ic${thumb ? " is-img" : ""}">${ic}</span>`) +
    `<span class="att-t"><span class="att-n">${esc(c.paste ? pasteLabel(c.paste) : c.name)}</span><span class="att-m">${sub}</span></span>` +
    (c.paste ? btn("view", "Preview the pasted text", ICON.eye) + `<button type="button" class="att-tx" data-a="inline" title="Put it back in the message as text">As text</button>` : "") +
    (c.state === "failed" && !FINAL.has(c.err?.code) ? btn("retry", `Retry ${c.name}`, ICON.retry) : "") +
    btn("x", `Remove ${c.paste ? "the pasted text" : c.name}`, ICON.close) +
    `<i class="att-bar" aria-hidden="true"></i></li>`;
}
function trayRender(K = MK) {
  const on = canAttach(K.view);
  K.attach.hidden = !on;
  const list = on ? tray.list(K.view) : [];
  K.tray.hidden = !list.length;
  K.note.hidden = !list.length;
  K.form.classList.toggle("has-files", !!list.length);
  const html = list.map(chipHtml).join("");
  // in place (js/redraw.js): a chip whose upload finishes or fails is the same chip, its Remove the same button,
  // so a focused Remove keeps focus (Astra H28)
  if (K.tray._h !== html) { redraw(K.tray, html); K.tray._h = html; }
  // progress moves without redrawing the chips (a focused Remove stays focused)
  for (const c of list) {
    const el = K.tray.querySelector(`[data-lid="${CSS.escape(c.lid)}"]`);
    if (!el) continue;
    const p = c.state === "uploading" ? Math.min(1, (c.sent || 0) / Math.max(1, c.size)) : c.state === "done" ? 1 : 0;
    el.style.setProperty("--p", String(p));
    const pct = el.querySelector(".att-pct");
    if (pct) pct.textContent = c.sent ? `${Math.floor(p * 100)}%` : "Uploading";
  }
}
function addFiles(files, K = MK) {
  const list = [...(files || [])];
  if (!list.length) return;
  if (!canAttach(K.view)) { announce("Files can't be attached in this conversation."); return; }
  const chat = attachChat(K.view);
  if (!chat) { heraldShow({ kind: "stopped", text: "Files can't be attached yet", sub: "still connecting to XO" }, 4600); return; }
  const refused = tray.add(K.view, chat, list);
  const took = list.length - refused.length;
  if (refused.length) {
    heraldShow({ kind: "stopped", text: refused.length === 1 ? `${refused[0].name} wasn't attached` : `${refused.length} files weren't attached`, sub: refused[0].why }, 6000);
    announce(`${refused.map((r) => `${r.name}: ${r.why}`).join(" ")}`);
  }
  if (took) announce(`${took === 1 ? "1 file" : `${took} files`} uploading.`);
  updateComposer(K);
  K.say.focus({ preventScroll: true });
}
function insertText(text, K = MK) {
  K.say.focus({ preventScroll: true });
  K.say.setRangeText(text, K.say.selectionStart, K.say.selectionEnd, "end");
  updateComposer(K); saveDraft(K);
}
$("#attach").innerHTML = ICON.clip;
$("#attach").addEventListener("click", () => attInput.click());
attInput.addEventListener("change", () => { addFiles(attInput.files); attInput.value = ""; });
function wireTray(K) {
K.tray.addEventListener("click", (e) => {
  const b = e.target.closest("[data-a]");
  const li = b && b.closest("[data-lid]");
  if (!li) return;
  const lid = li.dataset.lid, c = tray.list(K.view).find((x) => x.lid === lid);
  if (!c) return;
  if (b.dataset.a === "x") {
    // just drop its id: the server sweeps a file no message names. Focus goes on first, to the next chip's Remove
    // (or the composer), so it never sits on a chip that's going
    const next = li.nextElementSibling?.querySelector("[data-a=x]") || li.previousElementSibling?.querySelector("[data-a=x]");
    if (li.contains(document.activeElement)) (next || K.say).focus({ preventScroll: true });
    dropThumb(tray.remove(K.view, lid));
    announce(`${c.paste ? "The pasted text" : c.name} removed.`);
    trayRender(K);
  } else if (b.dataset.a === "retry") {
    // Retry goes as the upload starts again: focus moves first to the same chip's Remove, which stays (H28)
    if (b === document.activeElement) li.querySelector("[data-a=x]")?.focus({ preventScroll: true });
    tray.retry(K.view, lid);
    trayRender(K);
  }
  else if (b.dataset.a === "view") VW.open(c.paste != null ? { name: c.name, bytes: c.size, local: c.paste } : { name: c.name, type: c.type, bytes: c.bytes ?? c.size, att: { chat: c.chat, id: c.id } }, b);
  else if (b.dataset.a === "inline") { tray.remove(K.view, lid); insertText(c.paste, K); announce("The pasted text is back in the message."); }
});
K.say.addEventListener("paste", (e) => {
  const cd = e.clipboardData;
  if (!cd || !canAttach(K.view)) return;
  const files = [...(cd.files || [])];
  if (files.length) { e.preventDefault(); addFiles(files, K); return; }
  const text = cd.getData("text/plain");
  if (!text || !isLargePaste(text)) return;
  const chat = attachChat(K.view);
  if (!chat) return; // not connected yet: it goes in as text
  e.preventDefault();
  if (!tray.addPaste(K.view, chat, text)) { insertText(text, K); announce(`A message takes at most ${MAX_FILES} files, so the paste went in as text.`); return; }
  announce("The long paste was added as a file. As text puts it back in the message.");
  updateComposer(K);
});
}
wireTray(MK);
// a drop anywhere on the page adds the files to the message being written
{
  const veil = $("#drop-veil");
  $("#drop-ic").innerHTML = ICON.clip;
  let depth = 0;
  const hasFiles = (e) => [...(e.dataTransfer?.types || [])].includes("Files");
  const hide = () => { depth = 0; veil.hidden = true; };
  // only where the message being written can take it: on screen and in reach, under no open layer (Settings,
  // a sheet, a dialog, the phone's drawer make it inert): never into a composer that's hidden (Astra H29)
  const takes = (K) => canAttach(K.view) && K.say.getClientRects().length > 0 && !K.say.closest("[inert]") && !document.querySelector(".sheet:not([hidden]), dialog[open]");
  addEventListener("dragenter", (e) => { if (!hasFiles(e)) return; e.preventDefault(); if (takes(composerAt(e.target))) { depth++; veil.hidden = false; } });
  addEventListener("dragover", (e) => { if (!hasFiles(e)) return; e.preventDefault(); e.dataTransfer.dropEffect = veil.hidden ? "none" : "copy"; });
  addEventListener("dragleave", (e) => { if (hasFiles(e) && --depth <= 0) hide(); });
  addEventListener("drop", (e) => { if (!hasFiles(e)) return; e.preventDefault(); const on = !veil.hidden, K = composerAt(e.target); hide(); if (on && takes(K)) addFiles(e.dataTransfer.files, K); });
  addEventListener("dragend", hide);
}
function growSay(K = MK) {
  K.say.style.height = "auto";
  const h = K.say.scrollHeight;
  K.say.style.height = Math.min(h, 200) + "px";
  K.say.classList.toggle("is-capped", h > 200);
}
/** What would Stop stop here? The coordinator replying, or this thread's agent working. */
// (P1: each conversation's own: view defaults to the main chat's, a thread page in the panel passes its own)
function running(view = S.view) {
  // a thread whose session works, or the coordinator of this chat while it works
  // nothing more to stop where a Stop waits out its Undo or is on its way, or the session is stopping
  const live = (run) => (run && !S.stops.has(run.session) && world.act.sessionState(run.session) !== "stopping" ? run : null);
  const t = convThread(view);
  if (t) return t.busy && t.sessionId ? live({ kind: "thread", t, session: t.sessionId }) : null;
  if (view.startsWith("c:")) return CH.busy(view) ? live({ kind: "chat", session: view.slice(2) }) : null;
  if (view === "chats") return null;
  const chat = chatOf(view);
  const sid = chat && world.act.coordinatorBusy ? world.act.coordinatorBusy(chat) : null;
  return sid ? live({ kind: "coord", conv: view, session: sid }) : null;
}
function sendRender(K = MK) {
  const btn = K.send;
  const files = filesHere(K.view);
  const empty = !K.say.value.replace(/(^|\s)@[\w.-]+/, "").trim() && !files.count;
  const run = empty ? running(K.view) : null;
  const mode = run ? "stop" : "send";
  if (btn.dataset.mode !== mode) {
    btn.dataset.mode = mode;
    redraw(btn, run ? STOP_ICON : ICON.send); // the icon changes in place: a press on it still clicks
    btn.classList.toggle("is-stop", !!run);
  }
  btn.disabled = !run && (empty || !!liveBlock(K.view, K.say.value) || files.busy || files.failed);
  const wait = files.busy ? "Waiting for the files to upload" : files.failed ? "A file didn't upload: retry or remove it" : "";
  btn.setAttribute("aria-label", run ? (run.kind === "coord" ? "Stop the reply" : "Stop this run") : wait ? `Send · ${wait}` : "Send");
  btn.title = run ? (run.kind === "coord" ? "Stop the coordinator" : "Stop the agent (it keeps what's done)") : wait || "Send (Enter)";
}
/** A chip that only says (an open chat's model or mode): no popup to promise, nothing to press. */
function fixChip(el, on) {
  el.classList.toggle("is-fixed", on);
  if (on) { el.setAttribute("aria-disabled", "true"); el.removeAttribute("aria-haspopup"); }
  else { el.removeAttribute("aria-disabled"); el.setAttribute("aria-haspopup", "dialog"); }
}
/** A chat's line above the composer and its Send now toggle, which follow the chat's own state. */
function chatTargetRender() {
  sendNowRender();
  const perm = $("#cs-perm"), ph = CH.isChats(S.view) && !liveBlock() ? CH.permHtml(S.view) : "";
  perm.hidden = !ph;
  perm.title = CH.permTitle(S.view);
  fixChip(perm, S.view !== "chats");
  if (perm._h !== ph) { perm.innerHTML = ph; perm._h = ph; }
  if (!CH.isChats(S.view)) { $("#target").hidden = false; return false; }
  // an ended chat says so in its own words; "paused" would promise it comes back
  const html = CH.blocked(S.view) ? CH.targetHtml(S.view) : liveBlock() ? `<span class="tg-warn">${ICON.pause}</span><span>Sending is paused · ${esc(liveBlock())}</span>` : CH.targetHtml(S.view);
  if ($("#target")._h !== html) { $("#target").innerHTML = html; $("#target")._h = html; }
  $("#target").hidden = !html;
  $("#target").title = S.view === "chats" ? "The folder a new chat works in" : "";
  return true;
}
function updateComposer(K = MK) {
  if (!K.main) {
    trayRender(K); chipRender(false, K);
    targetLineRender(K); syncPlaceholder(K);
    K.form.classList.toggle("has-text", !!K.say.value);
    sendRender(K); growSay(K);
    if (document.activeElement === K.say) atRender(K); else atClose(K);
    return;
  }
  trayRender();
  lrefRender();
  if (chatTargetRender()) {
    syncPlaceholder();
    $("#composer").classList.toggle("has-text", !!say.value);
    sendRender(); growSay(); atClose();
    return;
  }
  targetLineRender();
  // the line above the composer follows where the draft goes (an @ typed in a thread, or taken away): drawn again
  // with the next render when that changes, so it says what the gate does
  { const dk = JSON.stringify(connDest()); if (dk !== updateComposer.dk) { updateComposer.dk = dk; schedule(); } }
  syncPlaceholder();
  $("#composer").classList.toggle("has-text", !!say.value);
  sendRender();
  growSay();
  atRender(MK);
}
/** A composer's @ list: the projects matching the @word at its caret. */
function atRender(K) {
  const at = K.at, pre = K.main ? "at" : "tat", before = K.say.value.slice(0, K.say.selectionStart);
  const m = before.match(/(^|\s)@([\w.-]*)$/);
  // no @ at the caret, or the list was shut here with Escape (until the text or the caret moves): closed
  if (!m || at._shut === before) { atClose(K); return; }
  at._shut = null;
  const q = m[2].toLowerCase();
  const opts = projects().filter((p) => p.id.toLowerCase().includes(q) || p.name.toLowerCase().includes(q));
  if (!opts.length) { atClose(K); return; }
  at._sel = Math.min(at._sel || 0, opts.length - 1);
  at.innerHTML = opts.map((p, i) => {
    const w = world.state.threads.filter((x) => x.project === p.id && isBusy(x)).length;
    return `<li role="option" id="${pre}-${i}" data-pid="${esc(p.id)}" aria-selected="${i === at._sel}"><span class="at-ic" aria-hidden="true">${projectIcon(p.id)}</span>@${esc(p.id)}<span class="at-s">${w ? `${w} working` : "quiet"}</span></li>`;
  }).join("");
  if (at.hidden) at.style.setProperty("--at-room", `${Math.round(K.form.getBoundingClientRect().top)}px`);
  at.hidden = false;
  const li = at.children[at._sel];
  // the keyboard's row stays in view inside the list's own scroll (never scrollIntoView: it would move the chat too)
  if (li.offsetTop < at.scrollTop) at.scrollTop = li.offsetTop;
  else if (li.offsetTop + li.offsetHeight > at.scrollTop + at.clientHeight) at.scrollTop = li.offsetTop + li.offsetHeight - at.clientHeight;
  K.say.setAttribute("aria-expanded", "true");
  K.say.setAttribute("aria-activedescendant", `${pre}-${at._sel}`);
}
/** The composer's placeholder follows the view, and a resolved thread says a reply reopens it. */
/** The @ list closed, and the field's accessible state with it (no longer expanded, no active option): one
 *  operation, so what's seen and what's announced always agree (Astra H24). */
function atClose(K = MK) {
  K.at.hidden = true;
  if (K.say.getAttribute("aria-expanded") !== "false") K.say.setAttribute("aria-expanded", "false");
  K.say.removeAttribute("aria-activedescendant");
}
/**
 * The recipient chosen from the @ list: the whole @token at the caret (the part after it too) becomes @pid, one
 * space after it, and the draft is saved at once: who it goes to is part of the draft, so a reload keeps it
 * (Astra H27: it fell back to the Workspace).
 */
function pickAt(pid, K = MK) {
  const f = K.say, pos = f.selectionStart;
  const before = f.value.slice(0, pos).replace(/(^|\s)@([\w.-]*)$/, `$1@${pid}`);
  const after = f.value.slice(pos).replace(/^[\w.-]*/, "");
  f.value = before + (/^\s/.test(after) ? "" : " ") + after;
  f.setSelectionRange(before.length + 1, before.length + 1);
  K.at._sel = 0; K.at._shut = null;
  saveDraft(K);
  updateComposer(K); f.focus();
}
say.addEventListener("input", () => { atList._sel = 0; updateComposer(); saveDraft(); });
say.addEventListener("click", () => updateComposer());
say.addEventListener("keydown", (e) => {
  // an IME composing (its Enter commits the words, its arrows walk its candidates, its Escape cancels them) owns
  // every key: neither the @ list, nor Send, nor the page's own keys take them (Astra H25: a composing Enter chose
  // a recipient; a composing Escape would have left the thread)
  if (e.isComposing || e.keyCode === 229) { e.stopPropagation(); return; }
  if (atKeys(e, MK)) return;
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); say.blur(); }
});
/** The open @ list owns the arrows, Enter and Tab (they choose, never send; Shift+Enter is still a new line) and Escape. */
function atKeys(e, K) {
  const at = K.at;
  if (at.hidden) return false;
  const n = at.children.length;
  if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); at._sel = (at._sel + (e.key === "ArrowDown" ? 1 : n - 1)) % n; updateComposer(K); return true; }
  if ((e.key === "Enter" && !e.shiftKey) || e.key === "Tab") { e.preventDefault(); pickAt(at.children[at._sel].dataset.pid, K); return true; }
  if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); atShut(K); return true; }
  return false;
}
/** Escape on an open @ list: it stays shut there until the text or the caret moves. */
function atShut(K) { K.at._shut = K.say.value.slice(0, K.say.selectionStart); atClose(K); }
function wireAt(K) {
  const at = K.at;
  at.addEventListener("mousedown", (e) => { const li = e.target.closest("li"); if (li) { e.preventDefault(); pickAt(li.dataset.pid, K); } });
  // the row under a moving mouse is the active one, as the arrows make it (Jump's model): one row looks active, Enter
  // picks it and the arrows go on from it (Astra C058 on 517af1c: hover painted a second row; Enter took the first)
  at.addEventListener("pointermove", (e) => {
    if (e.pointerType && e.pointerType !== "mouse" && e.pointerType !== "pen") return;
    const li = e.target.closest("li[role=option]"), i = li ? [...at.children].indexOf(li) : -1;
    if (i < 0 || i === at._sel) return;
    at.querySelector('[aria-selected="true"]')?.setAttribute("aria-selected", "false");
    at._sel = i; li.setAttribute("aria-selected", "true");
    K.say.setAttribute("aria-activedescendant", li.id);
  });
}
wireAt(MK);
// On Home an empty composer shrinks when it loses focus, which drops the dock (and the herald just above it)
// 45 px under the pointer, so the click lands on nothing. Keep its shape from the press until the click.
{
  const comp = $("#composer");
  let timer = 0;
  const release = (ms) => { clearTimeout(timer); timer = setTimeout(() => comp.classList.remove("held"), ms); };
  document.addEventListener("pointerdown", (e) => {
    if (!comp.contains(document.activeElement) || comp.contains(e.target)) return;
    clearTimeout(timer);
    comp.classList.add("held");
  }, true);
  // a touch's click can come a moment after the finger lifts, so wait for it (or give up shortly after)
  document.addEventListener("pointerup", () => { if (comp.classList.contains("held")) release(600); }, true);
  document.addEventListener("pointercancel", () => { if (comp.classList.contains("held")) release(0); }, true);
  document.addEventListener("click", () => { if (comp.classList.contains("held")) release(0); }, true);
}
$("#composer").addEventListener("submit", (e) => { e.preventDefault(); if ($("#send").dataset.mode === "stop") stopRun(); else send(); });
$("#target").addEventListener("click", () => {
  if (S.view === "chats") { CH.toggleSetup($("#target"), "cwd"); updateComposer(); return; }
  if (S.view.startsWith("c:")) { say.focus(); return; }
  aimAt(MK);
});
/** The target line pressed: the chooser opens on the recipient the draft already names, wherever it is, with every
 *  project listed and that one active (Astra H26); with none, on a new @ at the start. The draft is saved as it reads. */
function aimAt(K) {
  const f = K.say, tok = /(^|\s)@([\w.-]*)/.exec(f.value);
  let at = 1;
  if (tok) {
    at = tok.index + tok[1].length + 1;
    K.at._sel = Math.max(0, projects().findIndex((p) => p.id.toLowerCase() === tok[2].toLowerCase()));
  } else { f.value = "@" + (f.value ? " " + f.value : ""); K.at._sel = 0; saveDraft(K); }
  K.at._shut = null;
  f.focus(); f.setSelectionRange(at, at); updateComposer(K);
}
/** "Send now": its own toggle, shown in a chat whose turn is running where the agent can be interrupted. */
function sendNowRender() {
  const b = $("#send-now");
  const st = CH.isChats(S.view) && !liveBlock() ? CH.nowState(S.view) : null;
  b.hidden = !st;
  if (st) { b.setAttribute("aria-pressed", String(st.on)); b.classList.toggle("is-on", st.on); }
}
$("#cs-perm").addEventListener("click", () => { if (S.view !== "chats") return; CH.toggleSetup($("#cs-perm"), "mode"); updateComposer(); });
$("#send-now").addEventListener("click", () => { CH.toggleNow(S.view); updateComposer(); say.focus(); });
$("#iq").addEventListener("click", () => {
  if (S.view === "chats") { CH.toggleSetup($("#iq"), "model"); updateComposer(); return; }
  if (CH.isChats(S.view)) return;
  toggleIq(sessionOf(S.view), $("#iq"));
});
// one picker for every composer: its chip opens it and closes it, in the main chat or a thread in the panel
function toggleIq(sid, chip) { if (IQ.isOpen) IQ.close(); else IQ.open(sid, chip); }




// ── The Thread page (P2): a thread in the panel beside the coordinator's chat ────────────────────────────────
// The panel page renders the thread's facts and replies.
// conversation (createConv + createFollow + msgx), typing line and composer (wireComposer). It opens from the
// panel's Threads beside a chat; ⌘/Ctrl-click, or Open full width, gives today's full page.
const TP = { box: null, C: null, K: null, tid: null, follow: null, viewSubs: new Set() };
const tpView = () => (TP.tid ? "t:" + TP.tid : "");
function tpMount(box) {
  TP.box = box;
  box.classList.add("tp");
  box.innerHTML = `<header class="tp-head" id="tphead"></header><div class="thead tp-thead" id="tpthead" hidden></div>` +
    `<div class="scroller tp-scroller" id="tscroller" tabindex="-1" data-own-scroll><div class="column" id="tcolumn">` +
    `<div class="msgs" id="tmsgs" role="log" aria-live="off" aria-label="The thread's messages"></div><div class="typing-slot" id="ttyping"></div></div></div>` +
    `<div class="dock tp-dock" id="tpdock"><div class="herald" id="tpherald" aria-live="polite"></div><div class="tdock" id="tptdock"></div><div class="cbar"><form class="composer" id="tpcomposer" autocomplete="off">` +
    `<label class="sr-only" for="tsay" id="tsay-label">Reply</label><ul class="att-tray" id="tatt-tray" aria-label="Files on this reply" hidden></ul>` +
    `<div class="composer-field"><textarea id="tsay" rows="1" placeholder="Reply to the agent…" aria-autocomplete="list" aria-controls="tat-list" aria-expanded="false" spellcheck="true"></textarea><ul id="tat-list" class="at-list" role="listbox" aria-label="Projects" hidden></ul></div>` +
    `<div class="composer-row"><button type="button" class="attach" id="tattach" aria-label="Add files" title="Add files: text, images or PDFs, up to 25 MB each">${ICON.clip}</button><input type="file" id="tatt-input" multiple hidden tabindex="-1" accept="${esc($("#att-input").accept)}">` +
    `<button type="button" class="target" id="ttarget" title="Aim at a project (@)"></button><button type="button" class="iq" id="tiq" aria-haspopup="dialog" aria-expanded="false"></button><button type="submit" class="send" id="tsend" aria-label="Send" title="Send (Enter)" disabled></button></div>` +
    `<p class="att-note" id="tatt-note" hidden>Files are kept in the project's <code>.xo/</code> folder. Unlike chat text, they aren't scrubbed for secrets.</p></form></div></div>`;
  const els = { scroller: $("#tscroller"), column: $("#tcolumn"), msgs: $("#tmsgs"), dock: $("#tpdock") };
  TP.follow = createFollow(els);
  TP.follow.init();
  TP.C = createConv({ view: tpView, msgs: els.msgs, scroller: els.scroller, column: els.column, typing: $("#ttyping"), follow: TP.follow });
  TP.K = { main: false, get view() { return tpView(); }, say: $("#tsay"), send: $("#tsend"), form: $("#tpcomposer"), target: $("#ttarget"), label: $("#tsay-label"), conv: TP.C,
    tray: $("#tatt-tray"), attach: $("#tattach"), input: $("#tatt-input"), note: $("#tatt-note"), iq: $("#tiq"), at: $("#tat-list") };
  wireComposer(TP.K);
  wireTray(TP.K);
  TP.dock = createDock({ el: $("#tptdock"), view: tpView, region: () => TP.C.scroller });
  // its ⋯ lives in the panel's head
  const acts = document.createElement("span");
  acts.className = "tp-acts"; acts.id = "tpacts"; acts.dataset.for = "thread";
  STAGE.slot.append(acts);
  menuKeys(acts, { close: () => closeThreadMenu() });
  // its files: the paperclip; a drop on the page is the app's one drop, into this composer
  TP.K.attach.addEventListener("click", () => TP.K.input.click());
  TP.K.input.addEventListener("change", () => { addFiles(TP.K.input.files, TP.K); TP.K.input.value = ""; });
  // its model and effort: the thread's own session, the chat's picker
  TP.K.iq.addEventListener("click", () => toggleIq(sessionOf(tpView()), TP.K.iq));
  TP.deco = decorateConversation({ conv: box, msgs: els.msgs, scroller: els.scroller, typing: $("#ttyping"), composer: TP.K.form, say: TP.K.say, send: TP.K.send, atList: TP.K.at,
    dock: els.dock, tdock: $("#tptdock"), herald: $("#tpherald"), host: box, project: () => convProject(tpView()), follow: TP.follow, isThread: () => true, view: tpView, onView: (fn) => TP.viewSubs.add(fn) });
  // the composer's height is the conversation's room at its foot (as #app's --dock-h is the main chat's)
  TP.dockRO = watchDock(els.dock, box);
  conversationGestures({ scroller: els.scroller, msgs: els.msgs, say: TP.K.say, toast: (text) => toastLine(text) });
  els.scroller.addEventListener("scroll", () => { if (!TP.scrollRaf) TP.scrollRaf = requestAnimationFrame(() => { TP.scrollRaf = 0; loadAhead(TP.C); }); }, { passive: true });
}
function tpShow(key, { focus = false } = {}) {
  if (TP.tid !== key) {
    returnPill(null);
    if (TP.tid && TP.K) saveDraft(TP.K);
    TP.tid = key;
    TP.C.rendered = null; TP.C.filled = null;
    TP.C.msgs.replaceChildren(); $("#tpthead").hidden = true;
    TP.dock.reset();
    world.act.watchSideThread?.(key);
    loadDraft(TP.K);
    TP.viewSubs.forEach((fn) => fn());
    // drawn after the first frame, so the slide starts at the press
    const t = convThread(tpView());
    if (t) tpHead(t);
    TP.wait = true;
    requestAnimationFrame(() => setTimeout(() => {
      TP.wait = false;
      if (TP.tid === key && STAGE.pageShown?.name === "thread") drawThreadPage(D.needItems());
      if (focus && TP.tid === key) TP.K.say.focus({ preventScroll: true });
    }, 0));
    return;
  }
  drawThreadPage(D.needItems());
  if (focus) requestAnimationFrame(() => TP.K.say.focus({ preventScroll: true }));
}
// the page closes: its draft is kept, its parts stay built
function tpClose() {
  if (TP.K && TP.tid) saveDraft(TP.K);
  if (S.tMenuIn === "page") { S.tMenu = null; S.tMenuIn = null; }
  world.act.watchSideThread?.(null);
  TP.tid = null;
}
STAGE.page("thread", {
  title: (key) => world.thread(key)?.title || "Thread",
  mount: (box) => tpMount(box),
  onShow: (key, o) => tpShow(key, o),
  // a reply being written is kept (its draft), so closing never loses it: nothing to ask
  close: () => tpClose(),
  // Esc in its composer leaves the field first (the draft stays); the next Esc goes back to the sections
  escape: () => { if (S.tMenu && S.tMenuIn === "page") { closeThreadMenu(); return true; }
    if (TP.K && document.activeElement === TP.K.say && !TP.K.at.hidden) { atShut(TP.K); return true; }
    if (TP.K && document.activeElement === TP.K.say) { TP.K.say.blur(); TP.C.scroller.focus({ preventScroll: true }); return true; } return false; },
});
// its facts under the panel's head, its ⋯ in it
function tpHead(t) {
  const head = $("#tphead"), acts = $("#tpacts");
  const open = S.tMenu === t.id && S.tMenuIn === "page";
  const html = `<button type="button" class="stg-btn tp-main" data-tp-main="${esc(t.id)}" title="Open in main chat" aria-label="Open in main chat">${ICON.toMain}</button><span class="badge st-${stOf(t)}">${stateMark(glyphOf(t))}${isHeld(t) ? heldBadge(t.held) : wordOf(t)}</span>` +
    `${rtTag(t)}${t.branch ? `<code class="tp-br" title="${esc(t.branch)}">${ICON.branch}${esc(t.branch)}</code>` : ""}`;
  const menu = `<span class="tp-menu-w"><button type="button" class="stg-ic tw-more" data-tmenu="${esc(t.id)}" data-tmenu-in="page" aria-haspopup="menu" aria-expanded="${open}" title="Everything this thread can do" aria-label="Thread actions">${ICON.more}</button>${open ? threadMenuHtml(t, "page") : ""}</span>`;
  if (head._h !== html + menu) { redraw(head, html); redraw(acts, menu); head._h = html + menu; }
}
function drawThreadPage(needs) {
  const t = convThread(tpView());
  if (!t) { STAGE.closePage("thread"); return; } // a thread that's gone (deleted, resolved away) leaves the panel
  tpHead(t);
  checklistRender(needs, $("#tpthead"), tpView(), "tck-list");
  drawConv(TP.C, needs);
  TP.dock.render(needs); // the chat's own dock, over its own element: its card, fold, Undo
  if (document.activeElement !== TP.K.say) updateComposer(TP.K); else { sendRender(TP.K); targetLineRender(TP.K); }
}
// the thread moves from the panel into the main chat: its frame snaps across while the panel steps back without its copy
function toMain(id) {
  closeThreadMenu({ focus: false });
  STAGE.closePage("thread"); go("t:" + id, { panel: true });
}
document.addEventListener("click", (e) => { const b = e.target.closest?.("[data-tp-main]"); if (b) toMain(b.dataset.tpMain); });
const openFromPanel = createPanelThreadOpener({ S, world, STAGE, TP, go, showMsg });

// ── render ──────────────────────────────────────────────────────────────────
const scroller = $("#scroller"), msgsEl = $("#msgs");
function createConv({ view, msgs, scroller: sc, column, typing, follow, main = false }) {
  return { get view() { return typeof view === "function" ? view() : view; }, msgs, scroller: sc, column, typing, follow, main, rendered: null, filled: null };
}
const MAIN = createConv({ view: () => S.view, msgs: msgsEl, scroller, column: $("#column"), typing: $("#typing"), main: true,
  follow: { toLatest, toTop, unpin, isPinned, fromTop, toRow, fromLatest } });
const { readingPlace, holdPlace, foldsBefore, workMotion } = createReadingLayout({ S, MAIN });
// the oldest message on screen; day lines don't count, since older messages of the same day land below theirs
// Where the view is has one owner, modules/conversation/follow.js (QA #9): pinned at the latest, or reading where you are.
// Here: opening a conversation goes to the latest; a redraw while you read puts what you read back where it
// stood (holdPlace). The browser's scroll anchoring usually has, so nothing is written; it can't when the
// row you're reading is itself redrawn (a thread's first fill redraws most of them), or has none (Safari).

/** Where you carry on when the control you were on goes and nothing more particular is named: the place's own
 *  region (Home, Artifacts, else the conversation). */
const placeRegion = () => pageEl(S.view) || scroller;
/** Earlier messages load before you reach them (hub #28). Within about a screen of the top, the next
 *  page is fetched, and it lands above what you're reading without moving it; a first page too short to
 *  scroll keeps loading until it fills the view or the conversation begins. A thread pages the same way. */
function loadAhead(C = MAIN) {
  const v = C.view;
  if (C.rendered !== v || v === "home" || CH.isChats(v)) return;
  if (C.follow.fromTop() > Math.max(600, C.scroller.clientHeight)) return;
  const t = convThread(v);
  if (t) { if (world.act.loadOlderThread && canPageOlder(world.state.threadHist?.[t.id])) world.act.loadOlderThread(t.id); return; }
  const c = chatOf(v); const h = c && world.state.hist[c];
  if (h && h.loaded && !h.all && !h.loading && !h.olderError) world.act.loadOlder(c);
}
/** "Earlier messages" (or "Try again"), pressed: the conversation's next older page. */
function loadOlderNow(C = MAIN) {
  const from = document.activeElement?.closest?.("[data-older]") ? C.view : null;
  if (from) C.scroller.focus({ preventScroll: true });
  let read = null;
  const t = convThread(C.view);
  if (t) { const th = world.state.threadHist?.[t.id]; if (th && th.olderError) th.olderError = null; if (world.act.loadOlderThread) read = world.act.loadOlderThread(t.id); }
  else { const c = chatOf(C.view); if (c) read = world.act.loadOlder(c); }
  if (from) Promise.resolve(read).finally(() => {
    if (C.view !== from || document.activeElement !== C.scroller) return;
    render();
    C.msgs.querySelector("[data-older]")?.focus({ preventScroll: true });
  });
}

/** One conversation's drawing: its messages (reconciled in place), pictures, the place you read held, the work's
 *  folds gliding, its thread's root found, its typing line; opening it lands at the latest. */
function drawConv(C, needs) {
  const v = C.view;
  const opening = C.rendered !== v;
  let quiet = opening;
  // the first real fill of a conversation lands quietly (no arrivals), and where you are
  const ready = liveReady(v);
  if (!opening && ready && C.filled !== v) quiet = true;
  C.filled = ready ? v : null;
  if (C.main) S.filled = C.filled;
  CHG.sync(v); // what this place changed: read on opening, and after each edit an agent finishes
  const items = msgItems(v, needs);
  // the work folds about to be redrawn, measured before anything changes (workMotion glides them)
  const folds = quiet ? null : foldsBefore(C, items);
  const place = !opening && !C.follow.isPinned() ? readingPlace(C) : null;
  reconcile(C.msgs, items, { quiet, fallback: () => (C.main ? $("#say") : C.scroller) });
  hydrateMedia(C.msgs); // new pictures load and fade in; redrawn ones keep their pixels
  if (place) { holdPlace(C, place); queueMicrotask(() => holdPlace(C, place)); } // after msgx's decoration too
  if (folds) workMotion(C, folds);
  ensureRoot(v);
  typingRender(C);
  // opening a conversation lands at the latest (the owner, 5 Nov). After that, follow.js keeps you there
  // while you are (its first real fill included); if you scrolled up while it loaded, you stay where you
  // went (QA R2: the fill used to count as opening it again and threw you back to the latest)
  if (opening) { C.rendered = v; if (v === "chats") C.follow.toTop(); else C.follow.toLatest(false); }
}

// what scrolling asks of the page (an older page near the top, the header's edge): once a frame, not once an event
let scrollRaf = 0;
scroller.addEventListener("scroll", () => {
  if (scrollRaf) return;
  scrollRaf = requestAnimationFrame(() => { scrollRaf = 0; loadAhead(); $("#top").classList.toggle("is-scrolled", fromTop() > 120); });
}, { passive: true });
// the dock's height, for the space under the conversation (pinned at the latest, follow.js keeps you there).
// What's docked over the composer is one stack (index.html #dock), and the notices' line sits on its top: whether
// anything is docked there is measured, not inferred from what's in the dock (the bar's top below the dock's top: a
// chip shown only on a phone, a decision hidden while a panel covers it, one gliding in or out), in the observer's
// step, before the frame is painted, so the line never lies on a docked control for a frame (css/app.css .herald)
function watchDock(dock, host) {
  const bar = dock.querySelector(".cbar");
  const ro = new ResizeObserver(() => {
    host.style.setProperty("--dock-h", `${dock.offsetHeight}px`);
    const on = bar.getBoundingClientRect().top - dock.getBoundingClientRect().top > 0.5;
    if (dock.classList.contains("is-stacked") !== on) dock.classList.toggle("is-stacked", on);
    heraldRoom(); // the line stands higher over what's docked (is-stacked)
  });
  ro.observe(dock);
  return ro;
}
watchDock($("#dock"), $("#app"));
/** Chats starts with its composer: the dock leads its scroller there, under the greeting, and sits at the foot elsewhere. */
function dockAtTop(top) {
  const dock = $("#dock"), sc = $("#scroller");
  if (top === (dock.parentElement === sc)) return;
  const had = dock.contains(document.activeElement) ? document.activeElement : null;
  if (top) $("#cs-sub").after(dock); else $("#drop-veil").after(dock);
  $("#cs-hi").hidden = $("#cs-sub").hidden = !top;
  if (!top) sc.style.removeProperty("--cs-lead");
  dock.classList.toggle("is-top", top);
  had?.focus({ preventScroll: true });
}
initFollow();

// ── navigation: back always returns exactly where you were ─────────────────
function saveScroll() {
  if (pageEl(S.view)) S.scroll[S.view] = pageEl(S.view).scrollTop;
  // a conversation always opens at the latest (the owner, 5 Nov), so its place isn't kept
}
const returnPill = createReturnPill({ msgsEl, scroller, toRow });
const { go: navigate, back } = createNavigation({ S, VW, STAGE, IQ, PHONE, REC, TD, tdock, say, scroller, closeSettings, setDrawer: (open) => setDrawer(open), saveScroll, saveDraft, follow, pageEl, loadDraft, render: () => render(), returnPill, convThread });
function go(v, options) { return navigate(v, options); }
/** Has this conversation's real content arrived (timeline or thread detail)? */
function liveReady(v) {
  const t = convThread(v);
  if (t) return t.loaded;
  const h = world.state.hist[chatOf(v)];
  return !!h && !(h.loading && !(world.state.timeline[chatOf(v)] || []).length);
}
/** Stream the open conversation (the Workspace on Home); poll an open thread's detail. */
function follow() {
  const v = S.view, t = convThread(v);
  if (CH.isChats(v)) { world.act.watch([]); world.act.watchThread(null); world.act.watchSession?.(v.startsWith("c:") ? v.slice(2) : null); CH.open(v); return; }
  world.act.watchSession?.(null);
  // a thread's hops are always read: a message relayed into it shows in place (if1 #7); their lines stay by choice
  if (t && world.act.loadHops) world.act.loadHops(t.id);
  // a chat's hops are read on opening it too: the coordinator's "Waiting for … to reply" needs its open asks
  // (the hop lines themselves still show only by choice)
  if (!t) loadChatHops(v);
  world.act.watch(v === "home" || v === "ws" ? ["workspace"] : v.startsWith("p:") ? [v.slice(2)] : t ? [t.project] : []);
  world.act.watchThread(t ? t.id : null);
}
/** "Show hops" on the Workspace or a project: read that chat's own hops once. */
function loadChatHops(v) {
  const chat = v === "ws" || v === "home" ? "workspace" : v.startsWith("p:") ? v.slice(2) : null;
  if (chat && world.act.loadChatHops) world.act.loadChatHops(chat);
}
/** An open thread's root request lives on the project timeline; page back until it's there. */
/** An open thread's root request (on the project's timeline): looked up by id once the thread has been read
 *  back to its beginning, just below its first message. It used to page the project's own conversation back
 *  (up to 6 pages), which grew that conversation for nothing. */
function ensureRoot(view = S.view) {
  const t = convThread(view);
  if (!t || !world.act.findRows) return;
  const th = world.state.threadHist?.[t.id];
  if (!th || !th.loaded || !th.all) return;
  if ((world.state.timeline[t.project] || []).some((r) => r.id === t.id) || world.state.found?.[t.project]?.has(t.id)) return;
  const first = t.messages.find((m) => m.seq != null);
  world.act.findRows(t.project, [t.id], first ? first.seq : null);
}
$("#top-back").addEventListener("click", back);

/** Open a decision: in a thread, its own card; elsewhere the panel. */
function decideKey(key, opts) {
  const t = convThread(S.view);
  const n = D.needItems().find((x) => x.key === key);
  if (t && n && n.t.id === t.id && !D.isOpen() && !opts) {
    // asked to open this thread's own decision: it opens, folded or not (Astra S150: its notice left it folded)
    delete S.dockFold[key];
    if (n.later) S.later.delete(key);
    if (n.held) D.bringIn(key);
    schedule();
    requestAnimationFrame(() => requestAnimationFrame(() => tdock.querySelector(".card")?.focus({ preventScroll: true })));
    return;
  }
  D.open(key, opts);
}

/** After going to a conversation, bring one message into view and mark it for a moment (if it's loaded). */
function showMsg(id, C = MAIN) {
  let tries = 0;
  const look = () => {
    const el = C.msgs.querySelector(`[data-k="${CSS.escape(S.alias.get(id) || id)}"]`);
    if (!el) { if (++tries < 20) setTimeout(look, 100); return; }
    C.follow.toRow(el, true); // through follow.js: following stops, then the row is centred (never scrollIntoView)
    el.classList.remove("is-flash"); void el.offsetWidth; el.classList.add("is-flash");
    setTimeout(() => el.classList.remove("is-flash"), 1800);
  };
  setTimeout(look, 120); // after the conversation has drawn and restored its scroll
}

// ── files on messages (hub #30): the shared-file card, opening in the same viewer ──
/** The project a forwarded copy came from, when it wasn't the Workspace's own message (else null). */
function fwdSource(fwd) {
  const p = fwd.chatId && world.act.projectOf ? world.act.projectOf(fwd.chatId) : null;
  if (p) return p === "workspace" ? null : p;
  const v = fwd.via || [];
  return v.length > 1 && v[0] !== "workspace" && v[0] !== "project" && world.project(v[0]) ? v[0] : null;
}
/** The emoji agents put on a message, one chip per emoji with its count; hover names who. */
function reactionsHtml(reactions) {
  const groups = reactionGroups(reactions);
  if (!groups.length) return "";
  return `<div class="m-reacts" aria-label="Reactions">${groups.map((g) => {
    const who = g.by.map(reactorName).join(", ") || "An agent";
    return `<span class="m-react" title="${esc(`${who} reacted ${g.emoji}`)}">${esc(g.emoji)}${g.count > 1 ? `<span class="m-react-n">${g.count}</span>` : ""}</span>`;
  }).join("")}</div>`;
}
function reactorName(sessionId) {
  const s = (world.state.sessions || {})[sessionId];
  if (!s) return "An agent";
  if (s.role === "workspace-coordinator") return "The Workspace coordinator";
  const p = s.chat_id && world.act.projectOf ? world.act.projectOf(s.chat_id) : null;
  if (s.role === "project-coordinator") return p && p !== "workspace" ? `The ${PROJ(p)} coordinator` : "The coordinator";
  return p && p !== "workspace" ? `A ${PROJ(p)} agent` : "An agent";
}
const openMedia = createMediaOpener({ msgsEl, LB, VW });

let drawing = null;

// ── "Ask about these lines" (Files, js/viewer.js): to the file's own thread, else its project's coordinator ──
/** Your words; a question about lines leads with them as an in-app capsule that opens Files there. */
function youText(text) {
  const r = lineRef(text);
  if (!r) {
    // a question about a whole file: its capsule, then your words
    const f = fileRef(text);
    if (!f) return esc(text);
    return `<a href="#${esc(f.path)}" class="lk lk-in lk-file" data-ref="${esc(f.path)}" title="${esc(f.path)}"><span class="lk-ic">${fileIcon(f.path.split("/").pop())}</span><span class="lk-t">${esc(f.path.split("/").pop())}</span></a>\n${esc(f.rest)}`;
  }
  const name = r.path.split("/").pop(), lines = r.a === r.b ? `${r.a}` : `${r.a}–${r.b}`;
  return `<a href="#${esc(r.path)}" class="lk lk-in lk-file" data-ref="${esc(r.path)}" data-ref-a="${r.a}" data-ref-b="${r.b}" title="${esc(`${r.path}, ${r.a === r.b ? "line" : "lines"} ${lines}`)}"><span class="lk-ic">${fileIcon(name)}</span><span class="lk-t">${esc(name)} · ${lines}</span></a>\n${esc(r.rest)}`;
}
/** Where a question about a project file goes: {conv, thread, chat, name, path (in its place)}, or null. */
function askPlace(f) {
  if (!f || !f.project || !f.rel) return null;
  const fs = fileScope(f, { threads: world.state.threads, project: PROJ });
  const path = fs && localIn(fs, f);
  if (path == null) return null;
  const thread = fs.tid ? world.thread(fs.tid) : null;
  return thread ? { conv: `t:${thread.id}`, thread, chat: thread.project, name: thread.title || "this thread", path } : { conv: convOfChat(f.project), thread: null, chat: f.project, name: PROJ(f.project), path };
}
/**
 * Send "path:a-b" and the question, as your message there. The agent reads the path and lines first;
 * your bubble shows them as a capsule that opens Files at those lines (timeline.js lineRef).
 */
function askAboutLines(f, a, b, text) {
  const at = askPlace(f);
  return !!at && sendAbout(f, `${at.path}:${a}${b > a ? `-${b}` : ""}\n\n${text}`);
}
/** Beside the chat (Layout A, the owner's D4): asking about lines puts them in this conversation's own composer
 *  as a capsule, and the composer has focus. The file's place must be this conversation; else false (the
 *  file's own composer asks, as before). */
function composeAbout(f, a, b) {
  // the chat is always beside the panel's file now: the lines go into its composer
  const at = askPlace(f);
  if (!at || at.conv !== S.view || CH.isChats(S.view)) return false;
  S.lref[S.view] = { path: at.path, a, b, name: f.name || at.path.split("/").pop() };
  lrefRender();
  say.focus({ preventScroll: true });
  announce(`Lines ${a}${b > a ? ` to ${b}` : ""} of ${S.lref[S.view].name} are in your message. Write your question.`);
  return true;
}
/** Ask about this (Astra's I7): the whole file, as a capsule in the composer of the conversation it belongs to (that
    conversation opens if it isn't this one); the line above the field already names who receives it. Nothing is
    sent until you write and send; × takes it out. */
function askAboutFile(f) {
  const at = askPlace(f);
  if (!at) { announce("This file isn't in a project XO can ask about."); return false; }
  const ref = { path: at.path, a: null, b: null, name: f.name || at.path.split("/").pop() };
  if (at.conv !== S.view) { VW.close({ restore: false }); go(at.conv); }
  S.lref[at.conv] = ref;
  lrefRender();
  say.focus({ preventScroll: true });
  announce(`${ref.name} is in your message to ${at.name}. Write your question.`);
  return true;
}
/** The capsule above the composer's field: the file and its lines (opens them), and × to take it out. */
function lrefRender() {
  const r = S.lref[S.view], el = $("#cref");
  const lines = r && r.a ? ` · ${r.a}${r.b > r.a ? `–${r.b}` : ""}` : "";
  const html = r ? `<a href="#${esc(r.path)}" class="lk lk-in lk-file" data-ref="${esc(r.path)}"${r.a ? ` data-ref-a="${r.a}" data-ref-b="${r.b}"` : ""} title="${esc(r.a ? `${r.path}, ${r.a === r.b ? "line" : "lines"} ${r.a}${r.b > r.a ? `–${r.b}` : ""}` : r.path)}"><span class="lk-ic">${fileIcon(r.name)}</span><span class="lk-t">${esc(r.name)}${lines}</span></a>` +
    `<button type="button" class="cref-x" data-lref-x aria-label="${r.a ? `Take ${r.a === r.b ? "the line" : "the lines"} out of this message` : `Take ${esc(r.name || r.path.split("/").pop())} out of this message`}" title="${r.a ? (r.a === r.b ? "Take it out" : "Take them out") : "Take the file out"}">${ICON.close}</button>` : "";
  el.hidden = !r;
  if (el._h !== html) { redraw(el, html); el._h = html; }
}
/** A message about a project file, as yours, in its thread (or its project's chat). True when it went. */
function sendAbout(f, text) {
  const at = askPlace(f);
  if (!at) return false;
  // the file's own place decides (its thread, or its project's chat), never the chat or draft on screen
  const block = blockFor(at.thread ? { thread: true } : { pid: at.chat });
  if (block) { refuse(block); return false; }
  const m = { id: `l${++S.n}_${Date.now().toString(36)}`, conv: at.conv, at: Date.now(), who: "you", text, status: "sending", target: at.thread ? null : at.chat, to: at.name, cid: `ui_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}` };
  (S.local[at.conv] = S.local[at.conv] || []).push(m);
  sound.play("send");
  heraldShow(noticeFor(m, "out"), 9000);
  if (at.thread) STAGE.resumeFollow(at.conv);
  deliverLive(m, at.thread);
  schedule();
  return true;
}

// ── a thread's own header: resolve and reopen with Undo (R1), rename, label ──
const resolveThread = createThreadResolve({ world, schedule, announce, heraldFor, heraldShow, heraldDrop });
const { closeThreadMenu, startThreadEdit, endThreadEdit, saveThreadField, unfreeze } = createThreadEditing({ S, world, render: () => render(), schedule, announce, heraldShow, composerAt: (el) => composerAt(el) });
menuKeys($("#top"), { close: () => closeThreadMenu() });
// "Coordinator needs you" in a chat's header: the card above the composer, unfolded and in focus
$("#top").addEventListener("click", (e) => {
  const b = e.target.closest("[data-dock-open]");
  if (!b) return;
  delete S.dockFold[b.dataset.dockOpen];
  dockRender(D.needItems());
  requestAnimationFrame(() => tdock.querySelector(".card")?.focus({ preventScroll: true }));
});
$("#top").addEventListener("keydown", (e) => {
  const inp = e.target.closest?.("[data-tedit]");
  if (inp) {
    // an IME composing owns Enter and Escape (they commit or cancel its words): not the rename's, nor the page's
    if (e.isComposing || e.keyCode === 229) { e.stopPropagation(); return; }
    if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); if (S.tEdit) saveThreadField(S.tEdit.tid, inp.dataset.tedit, inp.value); }
    else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); if (S.tEdit && !S.tEdit.busy) endThreadEdit(S.tEdit); }
    return;
  }
  // the menu's own keys (↓ ↑ Home End, Escape, Tab) are menuKeys'; this is Escape with focus on ⋯ itself
  if (e.key === "Escape" && S.tMenu) { e.preventDefault(); e.stopPropagation(); closeThreadMenu(); }
});
$("#msgs").addEventListener("input", (e) => { if (e.target.matches?.("[data-chl-q]")) CH.search(e.target.value); });
$("#msgs").addEventListener("click", (e) => {
  const b = e.target.closest?.("[data-chl-all]");
  if (!b) return;
  const all = b.dataset.chlAll === "1";
  // the greeting keeps its place: the list grows under it instead of the page recentring
  const sc = $("#scroller");
  if (all) sc.style.setProperty("--cs-lead", getComputedStyle($("#cs-hi")).marginTop); else sc.style.removeProperty("--cs-lead");
  CH.showAll(all);
  requestAnimationFrame(() => requestAnimationFrame(() => {
    const top = $("#msgs .chl-top");
    if (!top) return;
    (all && !matchMedia("(max-width: 760px)").matches ? top.querySelector("[data-chl-q]") : top.querySelector("[data-chl-all]"))?.focus({ preventScroll: true });
  }));
});
$("#top").addEventListener("input", (e) => { if (e.target.closest?.("[data-tedit]") && S.tEdit) S.tEdit.value = e.target.value; });
// leaving the field saves it, unless it's what was just refused (Enter retries that; leaving keeps it, as typed)
$("#top").addEventListener("focusout", (e) => {
  const inp = e.target.closest?.("[data-tedit]");
  if (inp && S.tEdit) setTimeout(() => { const ed = S.tEdit; if (ed && !ed.busy && inp.isConnected && document.activeElement !== inp && inp.value !== ed.failed) saveThreadField(ed.tid, inp.dataset.tedit, inp.value); }, 0);
});

// ── clicks ──────────────────────────────────────────────────────────────────
/** The conversation a control is in (P1 step 8): the panel's thread page, else the main chat. */
const convAt = (el) => (TP.box && el && TP.box.contains(el) ? TP.C : MAIN);
const { fileRoute, openSharedFile, openLineRef } = createConversationFiles({ currentView: () => drawing || S.view, convThread, convAt, CHG, VW });
const composerAt = (el) => (TP.box && el && TP.box.contains(el) ? TP.K : MK);
/** The conversation in use: the panel's thread page while focus is in it or it covers the chat, else the main chat. */
function composerNow() {
  if (!TP.K || STAGE.pageShown?.name !== "thread") return MK;
  if (document.body.classList.contains("stage-full") || PHONE.matches) return TP.K;
  const a = document.activeElement;
  // focus dropped with the control it was on (a pressed Interrupt redrawn away): the one you were in
  if (!a || a === document.body) return S.kNow || MK;
  return TP.box.contains(a) ? TP.K : MK;
}
const composers = () => (TP.K ? [MK, TP.K] : [MK]);
// the notices' line follows you between the chat and the panel's thread page
document.addEventListener("focusin", () => { const K = composerNow(); if (K !== S.kNow) { S.kNow = K; schedule(); } });
const rowIn = (el) => el.closest("#msgs > [data-k]")?.dataset.k || null;
document.addEventListener("click", (e) => {
  const t = e.target;
  if (t.closest("#iq-pop")) return;
  const g = t.closest("[data-go]");
  // (the panel's own links are the panel's: it opens a thread as its page beside a chat, else goes as the panel)
  if (g && !t.closest("#all") && !t.closest("#stage")) { e.preventDefault(); go(g.dataset.go, { row: rowIn(g) }); if (g.dataset.goMsg) showMsg(g.dataset.goMsg); return; }
  const tl = t.closest("a[data-thread]");
  if (tl) { e.preventDefault(); if (world.thread(tl.dataset.thread)) { if (t.closest("#stage")) openFromPanel("t:" + tl.dataset.thread, e); else go("t:" + tl.dataset.thread, { row: rowIn(tl) }); } else heraldShow({ kind: "calm", text: "That thread isn't loaded", sub: "it may be in another project" }, 3200); return; }
  if (t.closest("[data-older]")) { loadOlderNow(convAt(t)); return; }
  const so = t.closest("[data-start]");
  if (so) { startDraft(+so.dataset.start); return; }
  const d = t.closest("[data-decide]");
  if (d) { decideKey(d.dataset.decide); return; }
  if (t.closest("[data-next]")) { openNext(); return; }
  if (t.closest("[data-create]")) { CREATE.open(); return; }
  if (t.closest("[data-all-threads]")) { openAll(); return; }
  const sw = t.closest("[data-switch]");
  if (sw) { if (allEl.hidden) openAll(sw); else closeAll(); return; }
  const sh = t.closest("[data-shell]");
  if (sh) { openShell(sh.dataset.shell); return; }
  if (t.closest("[data-open-all]")) { D.open(homeParts().next?.key); return; }
  if (t.closest("[data-glances]")) { D.open(null, { only: "glance" }); return; }
  const l = t.closest("[data-later]");
  // Later, Bring back, Bring in change what's next: focus goes to the next move as Home redraws (Astra S029/S035/S036)
  if (l) { S.homeFocusNext = true; D.laterNow(l.dataset.later); S.pin = null; return; }
  if (t.closest("[data-bring]")) { S.homeFocusNext = true; S.later.clear(); announce("Brought back. They're in today's list again."); schedule(); return; }
  if (t.closest("[data-handled]")) { setHandled(!S.handledOpen); return; }
  const bi = t.closest("[data-bring-in]");
  if (bi) { S.homeFocusNext = true; D.bringIn(bi.dataset.bringIn); return; }
  const ru = t.closest("[data-rec-undo]");
  if (ru) { undoRecord(ru.dataset.recUndo); return; }
  // a notice's Undo or Retry: its line goes once it's used, so focus goes first to the control it acts on (Resolve,
  // Interrupt, Stop), else the message box, and lands there again after the draw that follows, where that control
  // may be drawn anew (Astra: Undo and Retry left focus on BODY)
  if (t.closest("[data-herald-undo]")) {
    const h = S.herald, u = h?.undo;
    // a notice whose Undo names its own destination (Launchpad's) is left to it (lpshell LP21/LP36)
    if (!h?.ownFocus) { heraldBack(h)?.focus({ preventScroll: true }); const K = composerNow(); S.focusNext = [...((h && h.back) || []), () => K.say]; }
    if (typeof u === "function") { if (h.undoUntil && Date.now() > h.undoUntil) return; h.until = 0; u(); heraldNext(); } else if (u) undoRecord(u); // past its deadline an Undo undoes nothing: it does nothing
    return;
  }
  // Chats: "send now" would stop background tasks; a failed prompt
  // both leave with the question or the failed line they're on: the composer is where you are next
  const chc = t.closest("[data-chc]");
  if (chc) { const had = chc.contains(document.activeElement); CH.resolveConfirm(S.view, chc.dataset.chc); if (had) say.focus({ preventScroll: true }); return; }
  const chr = t.closest("[data-chat-retry]");
  if (chr) {
    // a Chat's Retry passes the same gate as its composer (an ended chat, XO out of reach, a limit)
    const block = liveBlock();
    if (block) { refuse(block, "the message stays, to retry"); return; }
    const had = chr.contains(document.activeElement); CH.retry(chr.dataset.chatRetry); if (had) say.focus({ preventScroll: true }); return;
  }
  const che = t.closest("[data-chat-edit]");
  if (che) { const text = CH.edit(che.dataset.chatEdit); if (text != null) putBack(text); return; }
  if (e.target.closest("[data-chat-stop]")) { stopRun(convAt(t).view); return; }
  // sub-agents: the strip under the checklist, the log, a sub-agent's row in a turn
  const rc = t.closest("[data-run-call]");
  if (rc) { const th = convThread(convAt(rc).view); const r = [...(world.state.runs?.values() || [])].find((x) => x.spawn === rc.dataset.runCall); openRuns(th, r ? r.id : null); return; }
  const ro = t.closest(".thead [data-run]");
  if (ro) { openRuns(convThread(convAt(ro).view), ro.dataset.run); return; }
  if (t.closest(".thead [data-runs]")) { openRuns(convThread(convAt(t).view)); return; }
  // storm blocks: open or fold a block or a row (thinking steps, an activity group, a command's output)
  const tb = t.closest("[data-tb]");
  if (tb) {
    const k = tb.dataset.tb; S.tbOpen[k] = !S.tbOpen[k];
    // you opened this to read it where it is: it unfolds downward and the view stays (even at the latest;
    // pressing the agent's working bubble instead goes back to following, msgx.js)
    const tc = convAt(tb);
    if (tb.closest(".msgs")) tc.follow.unpin();
    // the redraw replaces this line: its fold glides (workMotion, in the conversation it's in), and focus comes back to it
    S.tbToggled = { k, open: S.tbOpen[k], focus: tb === document.activeElement || tb.contains(document.activeElement), in: tc.msgs };
    schedule(); return;
  }
  // a thread's own header: resolve or reopen (R1), rename, label
  const rs = t.closest("[data-resolve]");
  if (rs) { resolveThread(rs.dataset.resolve, rs.dataset.to === "resolve"); return; }
  const tm = t.closest("[data-tmenu]");
  if (tm) {
    const where = tm.dataset.tmenuIn || "main", again = S.tMenu === tm.dataset.tmenu && S.tMenuIn === where;
    S.tMenu = again ? null : tm.dataset.tmenu; S.tMenuIn = again ? null : where;
    $("#top-who")._h = null; if ($("#tphead")) $("#tphead")._h = "";
    render(); // drawn now, in the click: the menu is there under the pointer at once (it was a frame or two late)
    if (S.tMenu) focusOpened(tm.parentElement.querySelector(".tw-menu"), e);
    return;
  }
  const tf = t.closest("[data-tfield]");
  // the thread's ⋯: previous / next thread, copy its branch's name
  const tg = t.closest("[data-tgo]");
  if (tg) { if (tg.getAttribute("aria-disabled") !== "true" && tg.dataset.tgo) { const page = S.tMenuIn === "page"; closeThreadMenu({ focus: false }); if (page && tg.dataset.tgo.startsWith("t:")) STAGE.show("thread", tg.dataset.tgo.slice(2), { focus: true }); else go(tg.dataset.tgo); } return; }
  const tsd = t.closest("[data-tside]");
  if (tsd) { const th = world.thread(tsd.dataset.tside); closeThreadMenu({ focus: false }); if (th) { go("p:" + th.project); STAGE.show("thread", th.id, { focus: true }); } return; }
  // from the page, what its own page's header does in place (rename, label, delete, another runtime): there, started
  const fromPage = S.tMenuIn === "page" && (t.closest("[data-tfield]:not([data-tfield=clear-label])") || t.closest("[data-tdel]") || t.closest("[data-tmove]"));
  if (fromPage) {
    const tid = S.tMenu;
    STAGE.closePage("thread"); S.tMenu = null; S.tMenuIn = null;
    go("t:" + tid); // drawn in this step: what the item leads to starts here too, never a frame later
    if (fromPage.dataset.tdel) { S.tDel = tid; $("#top-who")._h = null; render(); $("[data-tdel-no]")?.focus({ preventScroll: true }); }
    else if (fromPage.dataset.tfield) startThreadEdit(tid, fromPage.dataset.tfield);
    else { const sid = sessionOf(S.view), ch = IQ.runtimeChoice(sid), to = ch.list.find((o) => o.id !== ch.on && o.usable); if (to) IQ.open(sid, $("#iq"), { rt: to.id }); }
    return;
  }
  const tc = t.closest("[data-tcopy]");
  if (tc) { const b = tc.dataset.tcopy; closeThreadMenu(); navigator.clipboard?.writeText(b).then(() => heraldShow({ kind: "done", text: "Branch name copied", sub: b }, 2400), () => heraldShow({ kind: "stopped", text: "Couldn't copy the branch name", sub: b }, 4200)); return; }
  const td = t.closest("[data-tdel]");
  if (td) { const tid = td.dataset.tdel; S.tMenu = null; S.tDel = tid; $("#top-who")._h = null; render(); requestAnimationFrame(() => $("[data-tdel-no]")?.focus({ preventScroll: true })); return; }
  if (t.closest("[data-tdel-no]")) { const tid = S.tDel; S.tDel = null; $("#top-who")._h = null; render(); $(`[data-tmenu="${CSS.escape(tid || "")}"]`)?.focus({ preventScroll: true }); return; }
  const tdy = t.closest("[data-tdel-yes]");
  if (tdy) { deleteThread(tdy.dataset.tdelYes); return; }
  const lb = t.closest("[data-limit]");
  if (lb) { decideLimit(lb.dataset.limit, lb.dataset.limitD); return; }
  const tmv = t.closest("[data-tmove]");
  if (tmv) {
    // the thread menu's way to another runtime: the composer's picker, looking at the first one that can take it. The
    // picker opens first, in this step, and takes focus; only then does the menu go. Never a menu closed, then what it
    // opens a frame later: focus was on the page between (the create-project grader on 8aa58d3, S012). (The picker
    // closes on a pointerdown outside it, which this click has already had.)
    const sid = sessionOf(S.view), ch = IQ.runtimeChoice(sid), to = ch.list.find((o) => o.id !== ch.on && o.usable);
    if (to) IQ.open(sid, $("#iq"), { rt: to.id });
    if (to) { S.tMenu = null; $("#top-who")._h = null; schedule(); } else closeThreadMenu();
    return;
  }
  const unf = t.closest("[data-unfreeze]");
  if (unf) { unfreeze(unf.dataset.unfreeze, unf); return; }
  // Rename and the label open their field (focus goes there); Remove the label is done from ⋯ (focus back on it)
  if (tf) { const tid = S.tMenu; if (tf.dataset.tfield === "clear-label") { closeThreadMenu(); saveThreadField(tid, "label", ""); } else { S.tMenu = null; startThreadEdit(tid, tf.dataset.tfield); } return; }
  if (S.tMenu && !t.closest(".tw-menu")) closeThreadMenu({ focus: false });
  if (t.closest("[data-ck]")) { const tc = convAt(t), th = convThread(tc.view); if (th) { S.ckOpen[th.id] = !S.ckOpen[th.id]; if (tc === MAIN) checklistRender(D.needItems()); else checklistRender(D.needItems(), $("#tpthead"), tc.view, "tck-list"); } return; }
  const o = t.closest("[data-nx-opt]");
  if (o) { const n = homeParts().next; if (n) { o.classList.add("pressed"); nextDecide({ option: n.ask.options[+o.dataset.nxOpt] }); } return; }
  if (t.closest("[data-nx-allow]")) { nextDecide("allow"); return; }
  if (t.closest("[data-nx-back]")) { const card = $("#hm-next .next"); morph(card, () => { card.classList.add("noting"); card.querySelector(".nx-note").hidden = false; }, { duration: 280, fade: card.querySelector(".nx-note") }); card.querySelector("#nx-note-in").focus({ preventScroll: true }); return; }
  if (t.closest("[data-nx-send]")) { nextDecide("deny", $("#nx-note-in").value); return; }
  if (t.closest("[data-nx-cancel]")) { const card = $("#hm-next .next"); morph(card, () => { card.classList.remove("noting"); card.querySelector(".nx-note").hidden = true; }, { duration: 260 }); card.focus({ preventScroll: true }); return; }
  const r = t.closest("[data-retry]");
  if (r) { retry(r.dataset.retry); return; }
  // Interrupt goes as its turn stops: focus lands on its Undo (3 s), drawn in the same step (Astra RUN-5)
  if (t.closest("[data-interrupt]")) { S.focusNext = [() => heraldBox()?.querySelector("[data-herald-undo]")]; interruptRun(convAt(t).view); return; }
  const ed = t.closest("[data-edit]");
  if (ed) { editFailed(ed.dataset.edit, composerAt(ed)); return; }
  const mx = t.closest("[data-mx]");
  if (mx) { openMedia(mx, e); return; }
  if (t.closest("[data-lref-x]")) { delete S.lref[S.view]; lrefRender(); say.focus(); return; }
  const lr = t.closest("[data-ref]");
  if (lr) { e.preventDefault(); openLineRef(lr); return; }
  // a changed file's chip: its diff in the panel's Changes; anything else (a link to a file), Files
  const cf = t.closest(".tb-cf[data-file]");
  // opening it is reading here, as opening a work fold is: the view unpins on this row, so the panel making
  // room (the conversation narrows and re-wraps) moves nothing you're reading
  if (cf) {
    const cv = convAt(cf), c = CHG.forTarget(cv.view, cf.dataset.file);
    if (c) {
      cv.follow.unpin(cf); // the row you clicked in stays where it is while the panel takes its room (follow.js)
      const s = CHG.scope(cv.view);
      const inFiles = () => VW.open({ path: c.path, name: c.path.split("/").pop(), project: s.project, rel: s.worktree ? `.xo/worktrees/${s.worktree}/${c.path}` : c.path, show: "changes" }, cf);
      // ⌘/Ctrl-click: its diff in the panel's Files page, as the file (the same place a file opens)
      if (s && (e.metaKey || e.ctrlKey)) { inFiles(); return; }
      // its diff in the panel's Changes: focus goes to its row there, in the draw that shows it (the chip you
      // pressed is redrawn as chosen, and on a phone the panel covers it) (Files/Map grader on S224)
      if (STAGE.showChange(c.path)) { S.focusNext = [`#stage [data-cx="${CSS.escape(c.path)}"]`, "#stage .cx-pd"]; schedule(); return; }
      // a shape without the panel's Changes (Make content): its diff in Files instead
      if (s) { inFiles(); return; }
    }
  }
  const fb = t.closest("[data-file]");
  if (fb) { e.preventDefault(); openSharedFile(fb); return; }
  const cp = t.closest("[data-copy]");
  // "Copied" only once it's on the clipboard; refused, said so, and focus stays on the button
  // each Copy owns its answer: only the newest on this button says "Copied" and only its own timer puts "Copy" back;
  // an older one answering late says nothing; a refusal clears the check (Astra C052: an older reset wiped a newer
  // acknowledgement)
  if (cp) {
    const my = (cp._copyN = (cp._copyN || 0) + 1);
    copyText(cp.closest(".md-code")?.querySelector("code")?.textContent || "").then((ok) => {
      if (cp._copyN !== my) return;
      clearTimeout(cp._copyT);
      // what's said is this Copy's too: a newer one answering within the live region's 40 ms keeps it unsaid
      const mine = () => cp._copyN === my;
      if (!ok) { cp.textContent = "Copy"; announce(COPY_REFUSED, mine); return; }
      cp.textContent = "Copied"; announce("Copied the code.", mine);
      cp._copyT = setTimeout(() => { if (cp._copyN === my) cp.textContent = "Copy"; }, 1400);
    });
  }
});
$("#home").addEventListener("keydown", (e) => {
  if (e.target.id === "nx-note-in") {
    if (e.isComposing || e.keyCode === 229) return; // a word being composed owns its keys: Enter and Escape too
    // Enter while a word is still being composed (an IME) finishes the word; it never sends (Astra DEC-HOME-IME)
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing && e.keyCode !== 229) { e.preventDefault(); e.stopPropagation(); nextDecide("deny", e.target.value); }
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); $("[data-nx-cancel]").click(); }
    return;
  }
  // on the focused Home card: 1–9 answer, A allows a routine glance, D sends back, E details
  const card = e.target.closest?.(".next");
  if (!card || e.target !== card || e.metaKey || e.ctrlKey || e.altKey) return;
  // a key held down repeats: a repeat never decides anything, here as on a decision card (Astra DEC-HOME-REPEAT)
  if (e.repeat) { e.preventDefault(); e.stopPropagation(); return; }
  const n = homeParts().next;
  if (!n || n.key !== card.dataset.key) return;
  if (/^[1-9]$/.test(e.key) && Array.isArray(n.ask.options) && !Kit.isBinary(n.ask) && n.effort === "glance") { const o = n.ask.options[+e.key - 1]; if (o != null) { e.preventDefault(); e.stopPropagation(); nextDecide({ option: o }); } }
  else if (K.is(e, "allow") && Kit.isBinary(n.ask) && n.effort === "glance") { e.preventDefault(); e.stopPropagation(); nextDecide("allow"); }
  else if (K.is(e, "back") && n.effort === "glance") { e.preventDefault(); e.stopPropagation(); card.querySelector("[data-nx-back]")?.click(); }
  else if (K.is(e, "details") || e.key === "Enter") { e.preventDefault(); e.stopPropagation(); decideKey(n.key); }
});
const openNext = createOpenNext({ homeParts, heraldShow, decideKey });

// ── All threads: searchable, filtered; finished ones fold into one line ────
const allEl = $("#all");
let allReturn = null;
const allRender = createAllThreads({ S, world, D, SHAPE, PROJ, convProject, threadState, threadMark, glyphOf, rtTag, STATE_WORDS });
radioKeys($("#all-f"));
const tdelRender = createThreadDeleteView(S);
const topRender = createTopHeader({ S, convThread, isBusy, CH, STAGE, checklistRender, PROJ, conversationHeaderHtml, kernel, atOf, LP, LW, tdelRender, REC });
const deleteThread = createThreadDelete({ S, world, render: () => render(), go, announce, heraldShow, PROJ });
const { panelShell, openShell } = createShellPanel({ S, STAGE, SH, world, heraldShow });
/** All threads: from the project's title it drops down under it (the thread switcher); elsewhere a sheet. */
function openAll(anchor = null) {
  if (!convProject(S.view) || convProject(S.view) === "workspace") return;
  allReturn = document.activeElement;
  const drop = !!anchor && !PHONE.matches;
  allEl.classList.toggle("is-drop", drop);
  if (drop) {
    // under its button, its right edge on the button's
    const r = anchor.getBoundingClientRect();
    const w = Math.min(480, innerWidth - 32);
    allEl.style.setProperty("--dx", `${Math.max(16, Math.round(r.right - w))}px`);
    allEl.style.setProperty("--dy", `${Math.round(r.bottom + 8)}px`);
    allEl.style.setProperty("--dw", `${w}px`);
  }
  S.allFilter = "all"; S.allDone = false;
  $("#all-q").value = "";
  allRender();
  allEl.hidden = false;
  $("#all-q").focus();
  schedule();
}
/** All closes back to what opened it; if that control has gone meanwhile (the +N, once everything fits), to the
 *  switcher that's shown now, never the page. */
function closeAll() {
  if (allEl.hidden) return;
  allEl.hidden = true; syncInert();
  const shown = (el) => el && el.isConnected && el.getClientRects().length > 0;
  const back = shown(allReturn) ? allReturn : [...document.querySelectorAll("[data-switch]")].find(shown);
  back?.focus({ preventScroll: true });
  schedule();
}
$("#all-q").addEventListener("input", allRender);
// The switcher's keys, in one place so a key takes one step (Astra H31: ↓ from the search moved two): from the
// search, ↓ goes to the first thread and Enter opens it; on the list, ↓ ↑ walk it and ↑ from the first is the
// search again. An IME composing in the search owns its keys (H32: its Enter opened a thread).
allEl.addEventListener("keydown", (e) => {
  if (e.isComposing || e.keyCode === 229) { e.stopPropagation(); return; } // the IME's keys, not the switcher's or the page's
  if (e.altKey || e.ctrlKey || e.metaKey) return;
  const inSearch = e.target === $("#all-q");
  // the same keys as the panel's filter: / goes to the search, Esc in it clears it before it closes anything
  if (e.key === "/" && !inSearch && !e.target.closest?.("input, textarea, [contenteditable]")) { e.preventDefault(); e.stopPropagation(); $("#all-q").focus(); $("#all-q").select(); return; }
  if (e.key === "Escape" && inSearch && $("#all-q").value) { e.preventDefault(); e.stopPropagation(); $("#all-q").value = ""; allRender(); return; }
  if (e.key !== "ArrowDown" && e.key !== "ArrowUp" && !(inSearch && e.key === "Enter")) return;
  const rows = [...allEl.querySelectorAll(".all-list [data-go]")].filter((b) => b.offsetParent);
  if (inSearch) {
    if (!rows.length || e.key === "ArrowUp") return;
    e.preventDefault();
    if (e.key === "ArrowDown") rows[0].focus();
    else { allEl.hidden = true; go(rows[0].dataset.go); }
    return;
  }
  const i = rows.indexOf(document.activeElement);
  if (i < 0) return;
  e.preventDefault();
  if (e.key === "ArrowUp" && i === 0) { $("#all-q").focus(); return; }
  rows[Math.min(rows.length - 1, Math.max(0, i + (e.key === "ArrowDown" ? 1 : -1)))].focus();
});
allEl.addEventListener("click", (e) => {
  if (e.target === allEl || e.target.closest("[data-close]")) { closeAll(); return; }
  const f = e.target.closest("[data-af]");
  if (f) { S.allFilter = f.dataset.af; allRender(); return; }
  if (e.target.closest("[data-all-done]")) {
    const box = $(".ar-done");
    S.allDone = !S.allDone;
    box.querySelector(".ar-fold").setAttribute("aria-expanded", String(S.allDone));
    expand(box, box.querySelector(".ar-db"), S.allDone);
    return;
  }
  const g = e.target.closest("[data-go]");
  if (g) { allEl.hidden = true; go(g.dataset.go); }
});

// ── phone drawer ────────────────────────────────────────────────────────────
const setDrawer = createDrawer({ phone: PHONE, syncInert });

// ── Create XO Project (modules/create-project/create.js): start empty or clone a repository ─────
const CREATE = initCreate({
  world, S, go, heraldShow, announce, setDrawer,
  // On a phone the sidebar button that opened it is inside the closed drawer: return to the menu.
  onPhoneClose: () => { if (PHONE.matches) setTimeout(() => $("#pb-menu").focus({ preventScroll: true }), RM.matches ? 0 : 170); },
});
$("#side-add").addEventListener("click", CREATE.open);

// ── jump (⌘K) ───────────────────────────────────────────────────────────────
const jump = $("#jump");
const jumpPlaces = createJumpItems({ D, projects, threadsOf, projectIcon, glyphOf, wordOf });
function jumpActions() {
  const light = document.documentElement.dataset.theme === "light";
  return [
    { name: "New project…", sub: "Action", icon: ICON.plus, run: () => CREATE.open() },
    { name: "Settings", sub: "Action", icon: ICON.sliders, run: () => openSettings() },
    { name: "Keyboard shortcuts", sub: "Action", icon: ICON.sliders, run: () => openKeys() },
    { name: light ? "Dark mode" : "Light mode", sub: "Action", icon: light ? ICON.moon : ICON.sun, run: () => $("#theme").click() },
    ...(IQ.kindOf(sessionOf(S.view)) ? [{ name: "Intelligence: model and thinking", sub: "Action", icon: ICON.sliders, run: () => IQ.open(sessionOf(S.view), $("#iq")) }] : []),
    ...(!pageEl(S.view) ? [{ name: "Threads, Changes and Map", sub: "Action", icon: ICON.sliders, run: () => STAGE.toggle() }] : []),
  ];
}
// Focus an opening overlay now, and again once a native modal still closing (Create's 160 ms) lets go of it.
function focusOverlay(target) {
  target.focus({ preventScroll: true });
  const modal = [...document.querySelectorAll("dialog[open]")].find((d) => d.matches(":modal"));
  if (modal) modal.addEventListener("close", () => { if (target.isConnected && !target.closest("[hidden]")) target.focus({ preventScroll: true }); }, { once: true });
}
const JUMP = createJump({ host: jump, field: $("#jump-q"), list: $("#jump-list"), places: jumpPlaces, actions: jumpActions, more: (q) => REC.jumpItems(q), go: (v) => go(v), announce, focusIn: focusOverlay, onHidden: () => syncInert() });

function syncInert() {
  // only what this set inert is released here: Files keeps its own inert parts (a railed or folded chat)
  const hold = (el, on) => { if (on && !el.inert) { el.inert = true; el.dataset.layerInert = ""; } else if (!on && "layerInert" in el.dataset) { el.inert = false; delete el.dataset.layerInert; } };
  hold($("#app"), [jump, keys, allEl, QO.el].some((el) => !el.hidden));
  const settings = !setEl.hidden;
  for (const el of $("#main").children) if (el !== setEl && !el.classList.contains("toast-wrap")) hold(el, settings);
  // a phone: the sidebar is a drawer; closed, it is off screen and out of reach; open, it covers the main area
  const drawer = $("#app").classList.contains("drawer");
  hold($("#side"), PHONE.matches && !drawer);
  hold($("#main"), PHONE.matches && drawer);
}
queueMicrotask(() => { PHONE.addEventListener("change", syncInert); const mo = new MutationObserver(syncInert); for (const el of [jump, keys, allEl, setEl]) mo.observe(el, { attributes: true, attributeFilter: ["hidden"] }); syncInert(); });
/** The layer that holds the keyboard, the page behind it inert (syncInert): a sheet; on a phone, Settings (it covers
 *  the whole screen there), else the open drawer (the sidebar, over the main area). Null when the page itself does. */
function keyLayer() {
  return [keys, allEl, jump].find((el) => !el.hidden) || (PHONE.matches && !setEl.hidden ? setEl : null)
    || (PHONE.matches && $("#app").classList.contains("drawer") ? $("#side") : null);
}
// Tab and Shift+Tab go round the open layer: past its last control is its first, never the page behind it (inert,
// so Tab fell to BODY: the create-project/Launchpad grader on c055e74, the phone's drawer past Settings).
// It listens as the event bubbles, after the control the keys are in: a control that takes Tab for itself (Edit as
// JSON indents with it) claims it with preventDefault, and the layer only turns round a Tab nobody claimed.
addEventListener("keydown", (e) => {
  if (e.key !== "Tab" || e.defaultPrevented) return;
  const top = keyLayer();
  if (!top) return;
  // what Tab itself would visit: anything in the tab order (a summary, a field, a link, a roving group's one stop),
  // drawn and usable; the browser moves between them, and this only turns it round at the sheet's two ends
  const f = [...top.querySelectorAll("*")].filter((x) => x.tabIndex >= 0 && !x.disabled && !x.closest("[inert]") && x.getClientRects().length > 0);
  if (!f.length) return;
  const a = document.activeElement, inside = top.contains(a);
  const after = inside && f.some((x) => x !== a && a.compareDocumentPosition(x) & Node.DOCUMENT_POSITION_FOLLOWING);
  const before = inside && f.some((x) => x !== a && x.compareDocumentPosition(a) & Node.DOCUMENT_POSITION_FOLLOWING);
  if (e.shiftKey ? !before : !after) { e.preventDefault(); (e.shiftKey ? f[f.length - 1] : f[0]).focus(); }
});

// ── keys sheet ──────────────────────────────────────────────────────────────
const keys = $("#keys");
const soundRender = wireSound({ sound, announce });
const deviceSaid = createDeviceNotice(announce);
const webpicsRender = wireWebPictures(SHAPE, WEBPICS, deviceSaid);
const { lookSync } = wireAppearance({ THEME, applyTheme, deviceSaid });
// Settings › Appearance › Chat bubbles: this device's choice (localStorage cv-bubbles, read before the first paint in
// index.html). Off (the default), the conversation reads as a document; on, in bubbles (modules/conversation/msgx.css keys off
// <html data-msgx="bubbles"> and data-msgx-tails). Nothing is redrawn: the same rows take the other look.
wireChatBubbles(deviceSaid);
const hopsRender = wireMessageHops(S, SHAPE, deviceSaid);
keys.addEventListener("click", (e) => { if (e.target === keys || e.target.closest("[data-close]")) closeKeys(); });
let keysReturn = null;
function openKeys() { keysSheetRender(); keysReturn = document.activeElement; keys.hidden = false; focusOverlay(keys.querySelector("[data-close]")); }
function closeKeys() { keys.hidden = true; syncInert(); keysReturn?.focus?.({ preventScroll: true }); }

// ── settings: a page over the main area; closing it returns exactly where you were ──
const setEl = $("#settings");
const SETS = createSettings({ world, announce, PROJ, onChange: () => schedule() });
const RTSET = createRuntimeSettings({ world, announce, PROJ });
const ACCTS = createAccounts({ announce });
// Settings › Shape and the page's own reading of the shape (density, work, rail)
const SV = createShapeView({ shape: SHAPE, announce, notice: (n) => heraldShow({ kind: "stopped", text: n.text, sub: n.sub, force: true }) });
const shapeApply = createShapeApply({ S, SV, SHAPE, setWorkMode, hopsRender, webpicsRender, convThread, world, loadChatHops, SH, STAGE, schedule });
SHAPE.onChange(() => shapeApply());
shapeApply({ boot: true });
/** F5: wait for the limit, or move every waiting thread, from the card on a thread (the same item as in Needs you). */
async function decideLimit(id, decision) {
  S.limitBusy = id; S.limitErr = null; schedule();
  try {
    await world.act.decideItem(id, { decision });
    announce(decision === "move" ? "Moving the waiting threads. Each one says where it went." : "They wait for the limit to open.");
  } catch (err) { S.limitErr = { id, text: err.gone ? "It was already decided, or the limit opened." : err.message }; }
  S.limitBusy = null; schedule();
}
const SECTIONS = createSettingsSections({ places: kernel.places, nav: setEl.querySelector(".set-nav"), pages: setEl.querySelector(".set-page").parentElement, at: () => ({ project: S.view.startsWith("p:") ? S.view.slice(2) : convThread(S.view)?.project }), pick: (id) => SETF.setPage(id), isOpen: () => !setEl.hidden, onTabs: () => SV.apply() });
const SETF = createSettingsFrame({
  el: setEl, side: $("#set-side"), phoneButton: $("#set-phone"), closeButton: $("#set-x"), phone: PHONE, focusIn: focusOverlay, fallback: () => say,
  onPage: (id) => { SETS.open(id); if (id === "runtimes") RTSET.open(); if (id === "accounts") ACCTS.open(); if (id === "shape") SV.open(); SECTIONS.show(id); },
  // a phone's drawer hands the keyboard back to its menu first, so closing Settings returns it there
  beforeOpen: () => { setDrawer(false); if (D.isOpen()) D.close(); IQ.close({ restore: false }); SECTIONS.resume(); },
  beforeClose: () => { if (S.recording) { S.recording = null; KP.render(); } SECTIONS.hide(); },
  onHidden: () => syncInert(),
});
function openSettings() { SETF.open(); }
function closeSettings(o) { SETF.close(o); }

// ── shortcuts: one list (keys.js) drives the handlers, the tooltips, the sheet and this page ──
const KP = createKeysPage({ box: $("#set-keys-list"), state: S, announce, resetIcon: ICON.retry });
K.onChange(() => { KP.render(); if (!keys.hidden) keysSheetRender(); schedule(); });
KP.render();

wireThemeToggle(applyTheme, lookSync, announce);

// ── the sidebar: folds to its rail; More holds every further place ─────────────
const render = createShellRenderer({
  world, D, S, PAGE_OF, MAIN, pings, dockAtTop, convThread, sideRender, homeRender, REC, LPP,
  topRender, wsHeadRender, drawConv, say, msgsEl, placeRegion, loadAhead, TP, STAGE, drawThreadPage,
  dockRender, heraldRender, chatTargetRender, targetLineRender, syncPlaceholder, sendRender, chipRender,
  MAP, VW, LW, FP, titleFor: Kit.titleFor, isBusy,
});

const SIDE = createSide({ shape: SHAPE, keys: K, announce, render, toggleJump: () => (jump.hidden ? JUMP.open() : JUMP.close()) });

// the Map's toggle, in every conversation's header
document.addEventListener("click", (e) => { if (e.target.closest?.("[data-stage-toggle]")) STAGE.toggle(); else if (e.target.closest?.("[data-stage-open]")) STAGE.threads(); else { const b = e.target.closest?.("[data-lp-open]"); if (b) { if (LW.isOpen) LW.close(); else LW.open(S.view, b); } } });

// ── global keys ─────────────────────────────────────────────────────────────
const GLOBAL = {
  shells: () => SH.toggle(),
  jump: () => (jump.hidden ? JUMP.open() : JUMP.close()),
  intel: () => { const K = composerNow(); toggleIq(sessionOf(K.view), K.iq); },
  write: () => composerNow().say.focus(),
  keys: () => openKeys(),
  map: () => STAGE.toggle(),
  sideFold: () => SIDE.fold(!SIDE.folded),
};
addEventListener("keydown", (e) => {
  if (S.recording) return; // Settings › Keyboard is listening for a new key
  // a key that's part of a word being composed (an IME: its Escape cancels the word, its arrows move in the
  // candidates) is the field's, never a page key (Conversation's finding: a composing Escape reached it)
  if (e.isComposing || e.keyCode === 229) return;
  // inside a shell every key is the shell's (Esc for vim, Ctrl+K for bash), but the shells' own toggle
  if (SH.owns(e)) { if (K.hasMod("shells") && K.is(e, "shells")) { e.preventDefault(); GLOBAL.shells(); } return; }
  const g = K.globalFor(e), taken = e.defaultPrevented && K.typing(e);
  if (g && K.hasMod(g) && !taken && runGlobal(g)) { e.preventDefault(); return; }
  if (!jump.hidden || IQ.isOpen) { if (e.key === "Escape") { e.preventDefault(); LAYERS.escape(); } return; }
  if (CREATE.isOpen()) return;
  if (e.key === "Escape") {
    // the layer on top goes first: a sheet, then Settings (it covers the main area), then what it covers
    if (LAYERS.escape()) return;
    if (S.view.startsWith("t:")) back();
    else if (S.view.startsWith("c:")) go("chats");
    return;
  }
  if (K.typing(e) || e.metaKey || e.ctrlKey || e.altKey) return; // typing, even in Pierre's editor (a shadow root)
  if (!keys.hidden || !allEl.hidden) return;
  // Only keys that can't be hit by accident: no single letters (a stray keystroke must never
  // navigate or open something). Decision keys live on a focused decision card only.
  const s = K.globalFor(e, { typing: false });
  if (s && !K.hasMod(s) && runGlobal(s)) e.preventDefault();
});
/** Run a key that works anywhere; false when it has nothing to do here (the tree's fold away from Files: the key
 *  stays the browser's). */
function runGlobal(id) {
  // ⌘B: the panel's file browser folds to its rail (or opens), while Files shows
  if (id === "treeFold") return FP.toggleTree();
  // ⌘P, ⌘⇧F: only where the view has files (a project, a thread); elsewhere the browser keeps its keys
  if (id === "quickOpen") return QO.isOpen ? (QO.close(), true) : QO.open("files");
  if (id === "findInFiles") return QO.isOpen ? (QO.close(), true) : QO.open("text");
  if (!GLOBAL[id]) return false;
  GLOBAL[id]();
  return true;
}

// ── the phone's own Back (Android's back gesture, Safari's edge swipe) ──────
// One history entry of the app's own while there's somewhere to go back to: Back closes the top-most open layer, then goes to a thread's parent, then the places you came through; with nothing left the browser leaves.
const LAYERS = stackLayers(kernel.layers, [
  { id: "create", open: () => CREATE.isOpen(), close: () => { CREATE.close(); } },
  { id: "jump", open: () => !jump.hidden, close: () => { JUMP.close(); } },
  { id: "intel", open: () => IQ.isOpen, close: () => { IQ.close(); } },
  { id: "quickopen", open: () => QO.isOpen, close: () => { QO.close(); } },
  { id: "runs", open: () => RS.open, close: () => { runsEscape(); } },
  { id: "keys", open: () => !keys.hidden, close: () => { closeKeys(); } },
  { id: "all", open: () => !allEl.hidden, close: () => { closeAll(); } },
  { id: "lightbox", open: () => LB.isOpen, close: () => { LB.close(); }, overlay: false },
  { id: "settings", open: () => !setEl.hidden, close: () => { closeSettings(); } },
  { id: "files-page", open: () => FP.isOpen, close: () => { STAGE.back(); } },
  { id: "viewer", open: () => VW.isOpen, close: () => { VW.close({ ask: true }); }, overlay: false },
  { id: "panel-sheet", open: () => STAGE.isOpen && PHONE.matches, close: () => { STAGE.close(); } },
  { id: "shells", open: () => SH.raised, close: () => SH.lower() },
  { id: "drawer", open: () => $("#app").classList.contains("drawer"), close: () => { setDrawer(false); } },
  { id: "decisions", open: () => D.isOpen(), close: () => { D.close(); } },
  { id: "chat-setup", open: () => CH.setupOpen, close: () => { CH.closeSetup(); } },
]);
const placeOk = (v) => v === "ws" || v === "chats" || !!PAGE_OF[v] || (v.startsWith("p:") && !!world.project(v.slice(2))) || (v.startsWith("t:") && !!world.thread(v.slice(2))) || v.startsWith("c:");
const { canBack, stepBack } = createBackSteps({ S, LAYERS, placeOk, go, back });
wireBack({ canBack, stepBack });

const resolveFromRow = createRowResolve({ world, resolveThread, allEl, allRender });
// ── touch: gestures for the same moves (js/gestures.js), and the title back to the top ──
wireGestures({
  phone: () => PHONE.matches,
  overlay: () => LAYERS.open({ overlay: true }),
  view: () => S.view,
  back,
  drawer: (open) => setDrawer(open),
  isDrawer: () => $("#app").classList.contains("drawer"),
  settingsOpen: () => !setEl.hidden, closeSettings: () => closeSettings(),
  viewerOpen: () => VW.isOpen, closeViewer: () => VW.close(),
  panelOpen: () => D.isOpen(),
  runsDeep: () => RS.open && RS.view === "run", runsBack: () => runsEscape(), runsCard,
  sheets: [
    { host: $("#panel"), open: () => PHONE.matches && D.isOpen(), close: () => D.close() },
    { host: allEl, card: () => allEl.querySelector(".sheet-card"), open: () => !allEl.hidden, close: closeAll },
    { host: jump, card: () => jump.querySelector(".sheet-card"), open: () => !jump.hidden, close: JUMP.close },
    { host: keys, card: () => keys.querySelector(".sheet-card"), open: () => !keys.hidden, close: closeKeys },
    { host: $("#iq-pop"), open: () => IQ.isOpen && $("#iq-pop").classList.contains("is-sheet"), close: () => IQ.close() },
    { host: $("#cs-pop"), open: () => CH.setupOpen && $("#cs-pop").classList.contains("is-sheet"), close: () => { CH.closeSetup(); updateComposer(); } },
  ],
  say,
  canResolve: () => !!world.act.storm,
  threadOf: (id) => world.thread(id),
  resolve: (tid, resolved, li) => resolveFromRow(tid, resolved, li),
  toast: (text) => toastLine(text),
});
$("#pb-t").addEventListener("click", () => {
  (S.view === "home" ? $("#home") : scroller).scrollTo({ top: 0, behavior: RM.matches ? "auto" : "smooth" });
});

// ── boot ────────────────────────────────────────────────────────────────────
drawPlaceIcons();
// a new chat's setup: folder, agent, model, effort, what it may do (all from the runtime's feature list)
{
  const cs = $("#cs-pop");
  // drawn in place (CH.renderSetup): the picker or the mode you chose keeps focus; arrows move through the modes
  radioKeys(cs);
  cs.addEventListener("click", (e) => {
    const m = e.target.closest("[data-csmode]");
    if (m) { CH.setPref("mode", m.dataset.csmode); CH.closeSetup(); updateComposer(); return; }
    const ag = e.target.closest("[data-cs-agent]");
    if (ag) { if (ag.getAttribute("aria-checked") !== "true") { CH.setPref("agent", ag.dataset.csAgent); CH.renderSetup(); updateComposer(); } return; }
    const cwd = e.target.closest("[data-cs-cwd]");
    if (cwd) { CH.setPref("cwd", cwd.dataset.csCwd); CH.closeSetup(); updateComposer(); return; }
    for (const [k, sel, attr] of [["model", "[data-cs-model]", "csModel"], ["effort", "[data-cs-effort]", "csEffort"]]) {
      const r = e.target.closest(sel);
      if (r) { CH.setPref(k, r.dataset[attr]); CH.renderSetup(); updateComposer(); return; }
    }
    if (e.target.closest("[data-cs-done]")) { CH.closeSetup(); updateComposer(); }
  });
  cs.addEventListener("keydown", (e) => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); CH.closeSetup(); } });
  document.addEventListener("pointerdown", (e) => { if (CH.setupOpen && !cs.contains(e.target) && !e.target.closest("#target, #iq, #cs-perm")) CH.closeSetup(); });
}
drawFrameIcons(SHAPE_IC);
$("#send").innerHTML = ICON.send; $("#send").dataset.mode = "send";
startShell({ THEME, applyTheme, SIDE, soundRender, PHONE, setDrawer, render, world, schedule, follow, loadDraft });
