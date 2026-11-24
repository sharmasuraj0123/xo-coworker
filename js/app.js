import { createWorld, esc } from "./world.js";
import { copyText, COPY_REFUSED } from "../core/platform/index.js";
import { createNoticeLine } from "../modules/conversation/notice-line.js";
import "./dropdown.js"; // <xo-select>: the one dropdown, in place of the browser's <select>
import { renderInline, setThreadInfo, setWebImages } from "./markdown.js";
import * as Kit from "../modules/decisions/kit.js";
import * as K from "../core/platform/keys.js";
import { createDecisions } from "./decide.js";
import { createPacing } from "../modules/decisions/pacing.js";
import { createIntel } from "../modules/chats/intel.js";
import { EFFORT, evidenceFor } from "../modules/decisions/rank.js";
import { ICON, $, RM, morph, expand } from "./ui.js";
import { sound } from "../core/services/sound.js";
import { plainText, heldWords, heldShort } from "./timeline.js";
import { stepLineHtml } from "./turnview.js";
import { nameWith } from "../core/services/comms.js";
import { mediaHtml, fromSharedFile, viewerFile, wireDragOut, webImagesHtml } from "./media.js";
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
import { initFollow, toLatest, toTop, unpin, isPinned, fromTop, toRow, fromLatest } from "../modules/conversation/follow.js";
import { createTyping } from "../modules/conversation/typing.js";
import { createDrafts, DRAFTS } from "../modules/conversation/drafts.js";
import { createReadingLayout } from "../modules/conversation/reading-layout.js";
import { createConversationStops } from "../modules/conversation/stops.js";
import { createRunningState } from "../modules/conversation/running.js";
import { createDelivery } from "../modules/conversation/delivery.js";
import { createComposerTarget } from "../modules/conversation/target.js";
import { createMentionList } from "../modules/conversation/mention.js";
import { createLiveConversation } from "../modules/conversation/live.js";
import { createConversationPaging } from "../modules/conversation/paging.js";
import { createConv, createConversationDrawing } from "../modules/conversation/draw.js";
import { createConversationMessages } from "../modules/conversation/messages.js";
import { createMessageDetails } from "../modules/conversation/message-details.js";
import { createMessageItems } from "../modules/conversation/message-items.js";
import { createThreadPage } from "../modules/conversation/thread-page.js";
import { createConversationNavigation } from "../modules/conversation/navigation.js";
import { createChecklistRenderer } from "../modules/conversation/checklist.js";
import { createConversationStarts } from "../modules/conversation/start.js";
import { createConversationHeader } from "../modules/conversation/header.js";
import { createComposerControls } from "../modules/conversation/composer-controls.js";
import { createComposer } from "../modules/conversation/composer.js";
import { createComposerAttachments } from "../modules/conversation/composer-attachments.js";
import { createMessageContext } from "../modules/conversation/message-context.js";
import { createDock } from "../modules/decisions/dock.js";
import { createConversationDecisionActions } from "../modules/decisions/conversation-actions.js";
import { tickElapsed } from "../shell/elapsed.js";
import { headOf } from "../modules/decisions/cardparts.js";
import { createAccounts } from "../modules/settings/accounts.js";
import { createViewer } from "./viewer.js";
import { createMap } from "../modules/map/map.js";
import { createStage } from "../shell/panel/panel.js";
import { createSide } from "../shell/rail/side.js";
import { kernel } from "../shell/kernel.js";
import { wireHeaderActions } from "../shell/header.js";
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
import { createFileQuestion } from "../modules/conversation/file-question.js";
import { setTheme as setDiffTheme } from "../modules/changes/diffview.js";
import { createChangesFrame } from "../modules/changes/frame.js";
import { createTray } from "./attach.js";
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
import { wireGestures, dockGestures } from "./gestures.js";
import { rtName } from "../core/services/runtimes.js";
import { createThreadRuntime } from "../modules/runtimes/thread.js";
// the UI's shape per person: which surfaces show, in what order, how dense, in which words (core/services/shape)
import { createShapeStore } from "../core/services/shape/index.js";
import { createSettingsFrame, createSettingsSections, createKeysPage, createShapeView, SHAPE_IC } from "../modules/settings/index.js";
import { keysSheetRender } from "../modules/settings/keys-sheet.js";
import { setWorkMode } from "./turnview.js";
import { radioKeys, menuKeys, focusOpened } from "./keynav.js";
import { createConversationNotices } from "../modules/conversation/notices.js";
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
const { convHost, openAsk, fwdSource, reactionsHtml } = createMessageContext({ world, PROJ });
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
const { heraldShow, heraldFor, heraldNext, heraldDrop } = createConversationNotices({ S, schedule });
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
  ask: { target: (f) => askPlace(f)?.name || null, send: (f, a, b, text) => askAboutLines(f, a, b, text), compose: (f, a, b) => composeAbout(f, a, b), file: (f) => askAboutFile(f) },
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
const messagesOf = createConversationMessages({ S, world, D, PROJ, convThread, chatOf, convProject, threadsOf });


const { runsStrip, workingRuns } = createRunsStrip({ world, SHAPE, schedule });
const checklistRender = createChecklistRenderer({ S, SHAPE, convThread, runsStrip, schedule });
// Sub-agents: a page in the right panel, over the thread page it was opened from
const runsCard = document.createElement("div");
Object.assign(runsCard, { id: "runs-card", className: "runs-pg", tabIndex: -1 });
runsCard.setAttribute("role", "region");
runsCard.setAttribute("aria-label", "Sub-agents");
const RS = { cmdsOpen: true, cmdsAll: false, said: null, gen: 0, opening: 0, open: false, session: null, title: "", view: "list", tree: [], counts: null, runId: null, run: null, anc: null, items: [], cursor: null, children: [], loading: false, error: null, gone: null, pollT: null, returnTo: null };
const pendingStops = [];
const running = createRunningState({ S, world, CH, convThread, chatOf });
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
const { decideKey, decideLimit } = createConversationDecisionActions({ S, D, world, tdock, convThread, schedule, announce });
const dockDeps = { CH, D, S, world, convThread, convHost, askShort, schedule, dockGestures };
const MDOCK = createDock({ el: tdock, view: () => S.view, region: () => placeRegion(), TD: { key: null, item: null, busy: false, undone: null, gen: 0 } }, dockDeps);
const TD = MDOCK.TD;
const dockRender = (needs) => MDOCK.render(needs);

// ── typing ──────────────────────────────────────────────────────────────────
const sendingTo = (chat) => (S.local[convOfChat(chat)] || []).find((m) => m.status === "sending" && m.target === chat) || null;
let TYPING = null;
function typingRender(C = MAIN) { return (TYPING ||= createTyping({ world, CH, PROJ, convThread, chatOf, isBusy, heldWords, openAsk, sendingTo, schedule: () => schedule(), tick: () => tickElapsed() })).render(C); }
function toastLine(text) { announce(text); heraldShow({ kind: "done", text }, 1600); }
// only a clock whose words changed is written (a rewrite is a mutation every layer reacts to)
setInterval(tickElapsed, 1000);

regionRings(); // the keyboard's ring over a file's or a change's region (js/ring.js)
keepFocusInView(); // focus a script hands on is never left out of sight (js/focusview.js)
/** A notice's control in the conversation in use: its Send, or one in its own page. */
const inUse = (sel) => () => { const K = composerNow(); return sel === "#send" ? K.send : K.main ? $(sel) : TP.box.querySelector(sel); };

// ── intelligence: the record line and the chip ─────────────────────────────
const { recordLine, undoRecord } = createRecordLines({ S, announce, schedule, heraldShow, heraldNext, placeRegion: () => placeRegion() });
// ── the composer: send, or Stop while something runs ───────────────────────
const say = $("#say"), atList = $("#at-list");
const MK = { main: true, get view() { return S.view; }, say, send: $("#send"), form: $("#composer"), target: $("#target"), label: $("#say-label"), get conv() { return MAIN; },
  tray: $("#att-tray"), attach: $("#attach"), input: $("#att-input"), note: $("#att-note"), iq: $("#iq"), at: atList };
const { saveDraft, loadDraft } = createDrafts({ S, store, MK, updateComposer: (K) => updateComposer(K) });
const { startHtml, startDraft } = createConversationStarts({ SHAPE, PROJ, say, growSay: () => growSay(), saveDraft, updateComposer: () => updateComposer() });
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
const { trayRender, addFiles, insertText, wireTray, dropThumb } = createComposerAttachments({ MK, tray, canAttach, attachChat, announce, heraldShow, updateComposer: (K) => updateComposer(K), saveDraft, VW });
const { liveBlock, blockFor, refuse, connDest, deliverLive, send, retry, putBack, editFailed } = createDelivery({
  S, world, MK, say, CH, STAGE, PROJ, chatOf, convOfChat, convThread, convProject, composerAt: (node) => composerAt(node),
  filesHere, tray, dropThumb, saveDraft, updateComposer: (K) => updateComposer(K), growSay: (K) => growSay(K), announce, heraldShow, heraldFor, schedule, render: () => render(), go,
});
const { heraldBox, heraldRender, heraldRoom, heraldBack } = createNoticeLine({
  S, world, MK, composerNow, panelHost: () => TP.box, convThread, connDest, placeRegion: () => placeRegion(), STOP_ICON,
});
const { targetLineRender, syncPlaceholder } = createComposerTarget({ MK, world, CH, PHONE, PROJ, convThread, convProject, liveBlock, isBusy, sendWhileRunning, noun });
const { chipRender, sendRender, chatTargetRender } = createComposerControls({ MK, S, CH, IQ, PHONE, STOP_ICON, sessionOf, filesHere, running, liveBlock });
const { atRender, atClose, pickAt } = createMentionList({ MK, world, projects, projectIcon, isBusy, saveDraft, updateComposer: (K) => updateComposer(K) });
$("#attach").innerHTML = ICON.clip;
$("#attach").addEventListener("click", () => attInput.click());
attInput.addEventListener("change", () => { addFiles(attInput.files); attInput.value = ""; });
wireTray(MK);
const { wireComposer, growSay, updateComposer } = createComposer({
  MK, say, trayRender, chipRender, lrefRender: () => lrefRender(), chatTargetRender, syncPlaceholder, sendRender,
  targetLineRender, connDest, schedule, atRender, atClose, saveDraft, atKeys, send, stopRun, wireAt, aimAt,
});
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
$("#cs-perm").addEventListener("click", () => { if (S.view !== "chats") return; CH.toggleSetup($("#cs-perm"), "mode"); updateComposer(); });
$("#send-now").addEventListener("click", () => { CH.toggleNow(S.view); updateComposer(); say.focus(); });
$("#iq").addEventListener("click", () => {
  if (S.view === "chats") { CH.toggleSetup($("#iq"), "model"); updateComposer(); return; }
  if (CH.isChats(S.view)) return;
  toggleIq(sessionOf(S.view), $("#iq"));
});
// one picker for every composer: its chip opens it and closes it, in the main chat or a thread in the panel
function toggleIq(sid, chip) { if (IQ.isOpen) IQ.close(); else IQ.open(sid, chip); }




const { TP, tpMount, tpShow, tpClose, drawThreadPage } = createThreadPage({
  STAGE, S, world, D, createDock, dockDeps, wireComposer, wireTray, closeThreadMenu: () => closeThreadMenu(), addFiles, toggleIq, sessionOf, convProject, watchDock,
  toastLine, loadAhead: (C) => loadAhead(C), returnPill: (destination) => returnPill(destination), saveDraft, loadDraft, convThread,
  stOf, glyphOf, isHeld, wordOf, rtTag, threadMenuHtml, checklistRender, drawConv: (C, needs) => drawConv(C, needs), updateComposer, sendRender, targetLineRender,
});
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
// the thread moves from the panel into the main chat: its frame snaps across while the panel steps back without its copy
function toMain(id) {
  closeThreadMenu({ focus: false });
  STAGE.closePage("thread"); go("t:" + id, { panel: true });
}
document.addEventListener("click", (e) => { const b = e.target.closest?.("[data-tp-main]"); if (b) toMain(b.dataset.tpMain); });
const { saveScroll, showMsg } = createConversationNavigation({ S, pageEl, main: () => MAIN });
const openFromPanel = createPanelThreadOpener({ S, world, STAGE, TP, go, showMsg });

// ── render ──────────────────────────────────────────────────────────────────
const scroller = $("#scroller"), msgsEl = $("#msgs");
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
const { loadAhead, loadOlderNow } = createConversationPaging({ MAIN, CH, world, convThread, chatOf, render: () => render() });


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
const returnPill = createReturnPill({ msgsEl, scroller, toRow });
const { liveReady, follow, loadChatHops, ensureRoot } = createLiveConversation({ S, world, CH, convThread, chatOf });
const messageDetails = createMessageDetails({
  S, world, REC, SHAPE, PROJ, convThread, convProject, isBusy, isHeld, stOf, glyphOf, wordOf, EFFORT,
  askTitle, threadMark, noun, sendWhileRunning, running, workingRuns, agentOf,
});
const { msgItems, drawingView } = createMessageItems({
  S, world, CH, CHG, STAGE, PROJ, projects, convThread, convProject, messagesOf, fwdSource, reactionsHtml,
  youText: (text) => youText(text), startHtml, fileRoute: (path, conv) => fileRoute(path, conv), ...messageDetails,
});
const drawConv = createConversationDrawing({ S, CHG, msgItems, readingPlace, holdPlace, foldsBefore, workMotion, ensureRoot, liveReady, typingRender });
const { go: navigate, back } = createNavigation({ S, VW, STAGE, IQ, PHONE, REC, TD, tdock, say, scroller, closeSettings, setDrawer: (open) => setDrawer(open), saveScroll, saveDraft, follow, pageEl, loadDraft, render: () => render(), returnPill, convThread });
function go(v, options) { return navigate(v, options); }
$("#top-back").addEventListener("click", back);

// ── files on messages (hub #30): the shared-file card, opening in the same viewer ──
const openMedia = createMediaOpener({ msgsEl, LB, VW });


const { youText, askPlace, askAboutLines, composeAbout, askAboutFile, lrefRender } = createFileQuestion({
  S, world, PROJ, convOfChat, CH, say, VW, STAGE, go, announce, heraldShow, schedule, blockFor, refuse, deliverLive,
  fileScope, localIn, lineRef, fileRef,
});

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
const { fileRoute, openSharedFile, openLineRef } = createConversationFiles({ currentView: () => drawingView() || S.view, convThread, convAt, CHG, VW });
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
const conversationHeaderHtml = createConversationHeader({
  S, world, PICK, LP, LW, STAGE, kernel, atOf, convHost, homeParts, projects, doneToday, isBusy, isHeld,
  threadCounts, PROJ, projectIcon, threadsCtl, threadTitleInput, threadLabelInput, threadMenuHtml, stOf, glyphOf, wordOf, rtTag,
});
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
