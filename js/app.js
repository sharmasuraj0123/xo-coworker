// @ts-check
import { createWorld } from "../core/services/world/store.js";
import { esc } from "../core/platform/util.js";
import { PHONE as viewportPhone } from "../core/platform/viewport.js";
import { createCodeCopy } from "../core/ui/markdown/copy.js";
import { createNoticeLine } from "../modules/conversation/notice-line.js";
import "../core/ui/components/xo-select.js";
import { renderInline, setThreadInfo, setWebImages } from "../core/ui/markdown/markdown.js";
import * as Kit from "../modules/decisions/kit.js";
import * as K from "../core/platform/keys.js";
import { createDecisionSurface } from "../modules/decisions/surface.js";
import { createIntelSurface } from "../modules/chats/intel-surface.js";
import { EFFORT, evidenceFor } from "../modules/decisions/rank.js";
import { ICON } from "../core/ui/icons/names.js";
import { $ } from "../core/platform/dom.js";
import { watchDock, dockAtTop } from "../modules/conversation/dock-layout.js";
import { RM } from "../core/ui/motion.js";
import { plainText, heldWords, heldShort } from "../core/services/world/timeline.js";
import { stepLineHtml, turnHtml, turnAv, setWorkMode } from "../modules/conversation/blocks/turn.js";
import { nameWith } from "../core/services/comms.js";
import { mediaHtml, webImagesHtml } from "../core/services/media/render.js";
import { fromSharedFile, viewerFile } from "../core/services/media/items.js";
import { wireDragOut } from "../core/services/media/hydrate.js";
import { startRich } from "../core/ui/markdown/rich.js";
import { createLightbox } from "../modules/conversation/lightbox.js";
import { createRunsModule } from "../modules/runs/module.js";
import { createPendingRunStops } from "../core/services/run-stops.js";
import { sound } from "../core/services/sound.js";
import { wireSound } from "../modules/settings/sound.js";
import { createSettingsModule } from "../modules/settings/module.js";
import { routingModule } from "../modules/routing/module.js";
import { rulesModule } from "../modules/rules/module.js";
import { worktreesModule } from "../modules/worktrees/module.js";
import { createRuntimeSettings } from "../modules/runtimes/settings.js";
import { createChatSurface } from "../modules/chats/surface.js";
import { initFollow, toLatest, toTop, unpin, isPinned, fromTop, toRow, fromLatest } from "../modules/conversation/follow.js";
import { mountMainDecoration } from "../modules/conversation/main-decoration.js";
import { createTyping } from "../modules/conversation/typing.js";
import { createDrafts } from "../modules/conversation/drafts.js";
import { createReadingLayout } from "../modules/conversation/reading-layout.js";
import { createConversationStops } from "../modules/conversation/stops.js";
import { createRunningState } from "../modules/conversation/running.js";
import { createTranscriptFolds } from "../modules/conversation/transcript-folds.js";
import { createDelivery } from "../modules/conversation/delivery.js";
import { createLocalMessages } from "../modules/conversation/local-messages.js";
import { createFileReferences } from "../modules/conversation/file-references.js";
import { createComposerTarget } from "../modules/conversation/target.js";
import { createMentionList } from "../modules/conversation/mention-input.js";
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
import { createComposerFocus } from "../modules/conversation/composer-focus.js";
import { createComposerAttachments } from "../modules/conversation/composer-attachments.js";
import { createMainComposer, mountMainComposer } from "../modules/conversation/main-composer.js";
import { createMessageContext } from "../modules/conversation/message-context.js";
import { createDock } from "../modules/decisions/dock.js";
import { createDockFolds } from "../modules/decisions/dock-folds.js";
import { createConversationDecisionActions } from "../modules/decisions/conversation-actions.js";
import { tickElapsed } from "../shell/elapsed.js";
import { headOf } from "../modules/decisions/cardparts.js";
import { createFilesModule } from "../modules/files/module.js";
import { diff, jump as jumpDiff, setTheme as setDiffTheme } from "../modules/changes/diffview.js";
import { isImageChange, drawImageChange } from "../modules/changes/imagechange.js";
import { createMapModule } from "../modules/map/module.js";
import { createStage } from "../shell/panel/panel.js";
import { createSide } from "../shell/rail/side.js";
import { kernel } from "../shell/kernel.js";
import { wireHeaderActions } from "../shell/header.js";
import { createTopHeader } from "../shell/top-header.js";
import { createWorkspaceHeader } from "../shell/workspace-header.js";
import { stackLayers } from "../shell/layers.js";
import { createOverlayFocus, mountKeyboardLayers } from "../shell/keyboard-layers.js";
import { wireGlobalKeys } from "../shell/global-keys.js";
import { createShortcutsSheet } from "../modules/settings/shortcuts-sheet.js";
import { wireBack } from "../shell/back.js";
import { createBackSteps } from "../shell/back-steps.js";
import { createNavigation } from "../shell/navigation.js";
import { createNavigationState } from "../shell/navigation-state.js";
import { createReturnPill } from "../shell/return-pill.js";
import { createDecisionPings } from "../shell/decision-pings.js";
import { createShellRenderer, createShellScheduler } from "../shell/render.js";
import { createAppServices } from "../shell/app-services.js";
import { createRedrawFocus } from "../shell/redraw-focus.js";
import { createDrawer } from "../shell/phone.js";
import { drawPlaceIcons, drawFrameIcons } from "../shell/frame-icons.js";
import { startShell } from "../shell/start.js";
import { createLaunchpad } from "../modules/launchpad/launchpad.js";
import { createLpApi } from "../modules/launchpad/client.js";
import { createConversationFiles } from "../modules/files/conversation-files.js";
import { createMediaOpener } from "../modules/files/open-media.js";
import { fileScope, localIn } from "../modules/files/scope.js";
import { filePlace } from "../modules/files/search-place.js";
import { createPaths } from "../core/services/paths.js";
import { createQuickOpen } from "../modules/search/quickopen.js";
import { createWorkspaceJump } from "../modules/search/jump-items.js";
import { createChanges, lineRef, fileRef } from "../modules/changes/store.js";
import { createSavedSoon } from "../modules/changes/saved.js";
import { createThreadResolve } from "../modules/threads/resolve.js";
import { createThreadGroups } from "../modules/threads/groups.js";
import { threadsCtl } from "../modules/threads/header.js";
import { createThreadMenu } from "../modules/threads/menu.js";
import { createThreadMenuActions } from "../modules/threads/menu-actions.js";
import { threadNotices } from "../modules/threads/notices.js";
import { glyphOf, isBusy, isHeld, stOf, threadInfo, wordOf } from "../modules/threads/status.js";
import { createThreadDelete } from "../modules/threads/delete.js";
import { createThreadEditing, threadTitleInput, threadLabelInput } from "../modules/threads/editing.js";
import { createThreadControls } from "../modules/threads/controls.js";
import { createPanelThreadOpener } from "../modules/threads/open-panel-thread.js";
import { createLpWindow } from "../modules/launchpad/window.js";
import { createLpPage } from "../modules/launchpad/page.js";
import { createGhPage } from "../modules/github/page.js";
import { createFileQuestion } from "../modules/conversation/file-question.js";
import { createChangesModule } from "../modules/changes/module.js";
import { createTray } from "../core/services/media/attachment-tray.js";
import { api, uploadAttachment } from "../core/platform/api.js";
import { initCreate } from "../modules/create-project/create.js";
import { createProjectIconPicker } from "../modules/projects/icon-picker.js";
import { createProjectIconChoice } from "../modules/projects/icon-choice.js";
import { createShells } from "../modules/shells/dock.js";
import { createShellPanel } from "../modules/shells/panel.js";
import { createArtifactsModule } from "../modules/artifacts/module.js";
import { sinceModule } from "../modules/since/module.js";
import { createRecordLines } from "../modules/chats/record-lines.js";
import { createHomeController } from "../modules/home/controller.js";
import { skTile, bar as skBar, rememberedMade } from "../modules/home/skeleton.js";
import { wireGestures, dockGestures } from "../shell/gestures.js";
import { wordsOf } from "../modules/conversation/words.js";
import { createThreadRuntime } from "../modules/runtimes/thread.js";
import { createShapeStore } from "../core/services/shape/index.js";
import { createShapeView, SHAPE_IC } from "../modules/settings/index.js";
import { keysSheetRender } from "../modules/settings/keys-sheet.js";
import { menuKeys } from "../core/ui/a11y/keynav.js";
import { createConversationNotices } from "../core/services/notices/line.js";
import { createLaunchpadHerald } from "../modules/launchpad/herald.js";
import { createSideRows } from "../shell/rail/rows.js";
import { createAnnouncer } from "../core/ui/a11y/announce.js";
import { createShapeApply } from "../modules/settings/apply-shape.js";
import { createTheme, wireThemeToggle } from "../core/ui/theme.js";
import { regionRings } from "../core/ui/a11y/ring.js";
import { keepFocusInView, usable } from "../core/ui/a11y/focus.js";
import { createScope } from "../core/kernel/scope.js";
/** @import { DecisionNeed } from "../modules/decisions/controller-types.d.ts" */
/** @import { WorldThread } from "../core/services/world/state-types.d.ts" */
/** @import { Conversation } from "../modules/conversation/draw-types.d.ts" */

const appScope = createScope();
if (!viewportPhone) throw new Error("The application requires media queries.");
const PHONE = viewportPhone;
const world = createWorld();
appScope.effect(() => world.dispose);
const schedule = createShellScheduler(() => render(), appScope);
const redrawFocus = createRedrawFocus();
// what the backend can do, asked each time (a surface that needs a missing one stays away); filled in below
/** @type {Record<string, (() => boolean) | undefined>} */
const CAP = {};
const SHAPE = createShapeStore({
  caps: { has: (/** @type {string} */ c) => CAP[c]?.() ?? true },
  remote: { get: () => api.shape(), put: (body) => api.putShape(body) },
  notice: (h) => heraldShow({ kind: "calm", ...h }, 6000),
}, appScope);
appScope.effect(() => world.onEvent((e) => { if (e.kind === "shape") SHAPE.heard(e.value); }));
const WEBPICS = "xo:conversation/webpics";
setWebImages((/** @type {{ alt: string, url?: string, file?: string }[]} */ list) => {
  const web = list.flatMap(({ url, alt }) => url ? [{ url, alt }] : []);
  if (web.length && !SHAPE.on(WEBPICS)) return null;
  const own = list.flatMap(({ file, alt }) => file ? [fromSharedFile({ path: file, name: file.split("/").pop(), title: alt || null }, { route: fileRoute })] : []);
  if (!web.length) return mediaHtml(own, { side: "them" });
  return own.length ? mediaHtml(own, { side: "them" }) + webImagesHtml(web) : webImagesHtml(web);
});
startRich();
/** The app's original term remains in the tooltip when the shape renames it. @param {string} w */
const noun = (w) => { const x = SHAPE.word(w); return x === w ? esc(w) : `<span title="${esc(`XO's word: ${w}`)}">${esc(x)}</span>`; };

const params = new URL(location.href).searchParams;
/** @param {string | null | undefined} id */
function PROJ(id) {
  if (!id) return "";
  if (id === "workspace") return "Workspace";
  if (id === "@account") return "Your account";
  if (id === "@chats") return "Chats";
  return world.project(id)?.name || id;
}
const { convHost, openAsk, fwdSource, reactionsHtml } = createMessageContext({ world, PROJ });
const STOP_ICON = ICON.stop;

const { THEME, applyTheme } = createTheme(appScope, setDiffTheme);

const navigationState = createNavigationState();
const threadControls = createThreadControls();
const currentView = navigationState.view;
/** @type {Map<string, string>} */
const projectDescriptions = new Map();
const notices = createConversationNotices(schedule);
const localMessages = createLocalMessages();
const transcriptFolds = createTranscriptFolds();
const { show: heraldShow, forMsg: heraldFor, drop: heraldDrop } = notices;
const waitSince = new Map();
const announce = createAnnouncer($("#live"), appScope);
const codeCopy = createCodeCopy(announce);

// one card at the right edge: the newest shows, the one it covers steps aside and comes back when it closes
/** @typedef {{ readonly isOpen: boolean, park: () => unknown, unpark: () => unknown }} EdgeCard */
/** @type {EdgeCard | null} */
let coveredEdge = null;
const edgeOver = (/** @type {EdgeCard} */ card) => { if (card.isOpen) { card.park(); coveredEdge = card; } };
const edgeBack = (/** @type {EdgeCard} */ card) => {
  if (coveredEdge !== card) return;
  coveredEdge = null;
  card.unpark();
};
const decisionsCard = { get isOpen() { return D.isOpen(); }, park: () => D.park(), unpark: () => D.unpark() };
const { decisions: D, pacing: P } = createDecisionSurface({
  world, PROJ, announce, waitSince, params, scope: appScope, showNotice: heraldShow,
  conversationOf: (project) => convOfChat(project), go,
  onShown: () => edgeOver(VW),
  onGone: () => edgeBack(VW),
  render: () => schedule(),
  back: (sels) => { const here = placeRegion(); if (usable(here)) here.focus({ preventScroll: true }); redrawFocus.request([...sels, placeRegion]); schedule(); },
  // a docked decision's own line ("Allowed. Undo") ends the moment its decision is undone, by its Undo or a key
  onUndone: (key) => {
    if (currentView() === "home") restoreHomeDecision(key);
    MDOCK.undoReceipt(key);
    TP.dock?.undoReceipt(key);
  },
});
const { intelligence: IQ, toggle: toggleIq, openAlternate, activate: activateIntel } = createIntelSurface({
  world, PROJ, announce, composers: () => composers(), redrawChip: (composer) => chipRender(false, composer),
  openThread: (id) => go(`t:${id}`, { focus: true }),
  simple: () => SHAPE.opts("xo:composer/intel").mode === "simple",
  record: (session, rec) => recordLine(session, rec),
});

const {
  chats: CH, mountControls: mountChatControls, bindComposerButtons: bindChatButtons, handleMessageAction: chatMessageAction,
} = createChatSurface({
  world, announce, transcriptOpen: transcriptFolds.open, heraldShow: (...a) => heraldShow(...a), go: (...a) => go(...a), schedule: () => schedule(),
  view: currentView, list: $("#msgs"), composer: () => say, putBack: (text) => putBack(text),
  stop: (target) => stopRun(convAt(target).view),
  canRetry() {
    const block = liveBlock();
    if (block) refuse(block, "the message stays, to retry");
    return !block;
  },
}, { turnHtml, turnAv });
// what a place changed, from Space's /changes (modules/changes/store.js): the panel's Changes, Files' diffs, the chips' counts
const CHG = createChanges({ world, api, onChange: () => schedule() });
const { module: filesModule, viewer: VW, tree: FILES, page: FP } = createFilesModule({
  viewer: {
  onChange: schedule, changes: CHG,
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
  },
  renderers: { $, diff, jump: jumpDiff, isImageChange, drawImageChange },
  tree: () => ({ isBusy, PROJ, go: (v) => go(v), changes: CHG, paths: PATHS }),
  stage: () => STAGE,
});
const savedSoon = createSavedSoon(CHG);
// a file changed on disk (Space's file.version): the open file takes it in, and the place's file list follows
appScope.effect(() => world.onEvent((e) => {
  if (e.kind !== "file") return;
  VW.fileChanged({ ...e.data, type: e.type });
  const d = e.data || {}, m = /^(\.xo\/worktrees\/[^/]+)\/(.+)$/.exec(d.path || "");
  if (d.project_id && (d.kind === "create" || d.kind === "delete" || d.kind === "rename")) {
    PATHS.changed({ project: d.project_id, base: m ? m[1] : "" }, { kind: d.kind, path: m ? m[2] : d.path, old_path: d.old_path ? d.old_path.replace(/^\.xo\/worktrees\/[^/]+\//, "") : null });
  }
}));
// every file in a place (core/services/paths.js), for ⌘P and the tree's Find; ⌘P and ⌘⇧F themselves (modules/search/quickopen.js)
const PATHS = createPaths({ api, onChange: () => { QO.refresh(); FILES.pathsChanged && FILES.pathsChanged(); } });
/** The place the view shows files of (a thread's worktree, a project's folder), or null. */
const placeNow = () => filePlace(currentView(), { thread: (id) => world.thread(id), project: (id) => PROJ(id) });
const QO = createQuickOpen({
  paths: PATHS, api, place: placeNow, announce,
  openFile: (rel, { line }) => {
    const place = placeNow();
    if (place) VW.open({ path: rel, name: rel.split("/").pop(), project: place.project, rel, ...(line ? { lines: [line, line] } : {}) }, null);
  },
  openFiles: () => VW.openFiles || [],
  layer: { shown: () => syncInert(), hidden: () => syncInert() },
});
// A picture opens over the conversation; Open in Files hands it to the Files viewer.
const LB = createLightbox({ openFile: (it, from) => VW.open(viewerFile(it), from), announce });
wireDragOut($("#msgs"));
// shells (js/shells/): the dock under the main column, the sidebar's Shells row, the top bar's Shell buttons
const SH = createShells({ PROJ, announce, notify: (h) => heraldShow(h, 6000), onChange: () => schedule(), wanted: () => SHAPE.on("xo:dock/shells") });
CAP.terminal = () => SH.available;
const artifacts = createArtifactsModule({ go, VW, skTile, skBar, rememberedMade });

const projects = () => world.state.projects.filter((p) => p.id !== "workspace");
const wsHeadRender = createWorkspaceHeader(currentView, projects);
const { ownIcon, projectIcon, forgetIcon } = createProjectIconChoice({ world, SHAPE });
const { PICK, pickIcon, closePick } = createProjectIconPicker({ world, SHAPE, PROJ, ownIcon, forgetIcon, announce, render: () => render() });

appScope.listen(document, "click", ({ target }) => {
  const button = target instanceof Element ? target.closest("[data-pj-icon]") : null;
  const id = button?.getAttribute("data-pj-icon");
  if (id != null && button instanceof HTMLElement) pickIcon(id, button);
});
appScope.listen(document, "pointerdown", ({ target }) => {
  if (PICK.el && target instanceof Element && !target.closest(".pk-pop,[data-pj-icon]")) closePick();
});
const threadsOf = (/** @type {string} */ pid) => world.state.threads.filter((t) => t.project === pid && t.state !== "resolved");
const convThread = (/** @type {string} */ v) => v.startsWith("t:") ? world.thread(v.slice(2)) ?? null : null;
nameWith({
  thread: (id) => world.thread(id)?.title || null,
  project: (chatId) => (world.state.projects || []).find((p) => p.chatId === chatId)?.name || null,
  here: () => { const v = currentView() || ""; const t = convThread(v); return t ? PROJ(t.project) : v.startsWith("p:") ? PROJ(v.slice(2)) : null; },
});
const convProject = (/** @type {string} */ v) => (v === "ws" || v === "home" ? "workspace" : v.startsWith("p:") ? v.slice(2) : convThread(v)?.project ?? null);
const sessionOf = (/** @type {string} */ v) => (v === "home" ? "ws" : v);
const askTitle = (/** @type {Parameters<typeof headOf>[0]} */ n) => { const h = headOf(n); return (h.verb ? `${esc(h.verb)} ` : "") + (h.md ? renderInline(h.text, true) : esc(h.text)); };
const askShort = (/** @type {Parameters<typeof headOf>[0]} */ n) => { const h = headOf(n); return [h.verb, h.md ? plainText(h.text) : h.text].filter(Boolean).join(" "); };
setThreadInfo(threadInfo(world.thread));
const MAP = createMapModule({ go: (v) => go(v, { panel: true }), isBusy, openFile: (f, from) => VW.open(f, from), stepLineHtml });
const { panelThreads, threadCounts } = createThreadGroups({
  world, D, MAP, convProject, askShort, threadMark: (t) => threadMark(t), isBusy, isHeld,
});
/** @param {string | null | undefined} v */
const lpProject = (v) => v?.startsWith("p:") ? v.slice(2) : v?.startsWith("t:") ? world.thread(v.slice(2))?.project ?? null : null;
/** @param {string} p @param {string | null} [id] */
function lpThread(p, id) {
  const t = id ? world.thread(id) : world.state.threads.find((row) =>
    row.project === p && /^deploy to launchpad/i.test(row.title) && row.state !== "resolved");
  if (!t || t.project !== p) return null;
  return { thread: t.id, title: t.title, since: t.createdAt, busy: isBusy(t), held: isHeld(t) ? heldShort(t.held) : null,
    done: t.state === "done" || t.state === "resolved" };
}
const LP = createLaunchpad({
  api: createLpApi(), projectOf: lpProject, nameOf: (p) => PROJ(p), findThread: lpThread,
  go: (v) => { LW.close(); go(v); }, announce, onChange: schedule,
  ...createLaunchpadHerald({ show: heraldShow, forMsg: heraldFor, drop: heraldDrop }),
});
const LW = createLpWindow({ launch: LP, projectOf: lpProject, nameOf: PROJ,
  iconOf: (/** @type {string | null} */ p) => p ? projectIcon(p) : "", allApps: () => go("launchpad"), onChange: schedule });
const LPP = createLpPage({ el: $("#lpp"), launch: LP, projects: () => projects().map((p) => p.id), iconOf: projectIcon,
  open: (/** @type {string} */ v, /** @type {HTMLElement | null} */ from) => LW.open(v, from),
  press: (/** @type {string} */ name) => LW.press(name) });
/** @type {Record<string, string>} */
const PAGE_OF = { home: "#home", artifacts: "#arts", launchpad: "#lpp" };
const pageEl = (/** @type {string} */ v) => PAGE_OF[v] ? $(PAGE_OF[v]) : null;
const panelPlace = (/** @type {string} */ v) => /^(?:ws$|[pt]:)/.test(v || "");
const atOf = (/** @type {string} */ v) => {
  const t = convThread(v);
  return { view: v, project: t?.project ?? (v.startsWith("p:") ? v.slice(2) : undefined), thread: t?.id };
};
const STAGE = createStage({
  place: panelPlace, files: FILES, openFiles: () => FP.show({ focus: true }),
  github: {
    show: () => GH.show(), leave: () => GH.leave(),
    has: (v) => { const project = lpProject(v); return project && project !== "workspace" ? GH.has(project) : Promise.resolve(false); },
  },
  viewer: VW, view: currentView, go: (v, e) => openFromPanel(v, e), announce, onChange: schedule,
  frames: () => SHAPE.list("panel").map((s) => s.id.slice("xo:panel/".length)), threads: (v) => panelThreads(v),
  shell: (on, host, where) => panelShell(on, host, where), owns: (e) => SH.owns(e), at: () => atOf(currentView()), places: kernel.places,
});
const GH = createGhPage({ stage: STAGE, api, view: currentView, projectOf: (view) => lpProject(view) ?? "", announce, work: (p, it) => {
  if (currentView() !== `p:${p}`) go(`p:${p}`);
  const what = it.kind === "pr" ? `Review pull request #${it.number}` : `Work on issue #${it.number}`;
  appScope.frame(() => { insertText(`${what}, “${it.title}”: ${it.url}`, MK); announce("The ask is in the message box. Send it to start a thread."); });
} });
wireHeaderActions(kernel.places, () => atOf(currentView()));
// the place beside the panel's name: a thread's project (its title is the conversation's own head), a project
STAGE.names = (v) => {
  const p = v.startsWith("t:") ? world.thread(v.slice(2))?.project : v.startsWith("p:") ? v.slice(2) : null;
  return p && p !== "workspace" ? PROJ(p) : p === "workspace" || v === "ws" ? "Workspace" : "Your projects";
};
const { agentOf, threadMark, rtTag, sendWhileRunning, movable } = createThreadRuntime({ world, SHAPE, isHeld });
const threadMenuHtml = createThreadMenu({ panelThreads, SH, movable, isBusy });
/** The composer's target line in a thread; while its agent works, where your words land. */
const doneToday = () => world.state.threads.filter((t) => t.state === "done" && new Date(t.lastAt).toDateString() === new Date().toDateString());

const threadNotice = threadNotices({ find: world.thread, projectName: PROJ, movedHere: IQ.movedHere, show: heraldShow, waitSince });
appScope.effect(() => world.onEvent((e) => {
  if (e.kind === "message") {
    // the coordinator answered something you asked, and you're looking elsewhere: one calm line
    const conv = e.project === "workspace" ? "ws" : "p:" + e.project;
    if (e.answered && currentView() !== conv) heraldShow({ kind: "reply", text: e.project === "workspace" ? "The coordinator replied" : `${PROJ(e.project)} coordinator replied`, sub: short1(e.text), open: conv }, 7000);
    if (e.answered) announce(`${e.project === "workspace" ? "The coordinator" : PROJ(e.project) + " coordinator"} replied: ${e.text}`);
    schedule();
    return;
  }
  threadNotice(e);
}));

const short1 = (/** @type {string | null | undefined} */ text) => { const s = String(text || "").replace(/[*_`#>]+/g, "").replace(/\s+/g, " ").trim(); return s.length > 64 ? s.slice(0, 63).replace(/\s+\S*$/, "") + "…" : s; };

/** @type {Parameters<typeof createDecisionPings<DecisionNeed>>[0]} */
const pingOptions = { view: currentView, P, PROJ, askShort, heraldShow };
const pings = createDecisionPings(pingOptions);

const sideRender = createSideRows({
  view: currentView, world, CH, REC: { artifacts }, D, projects, convThread, isBusy, isHeld, askShort, projectIcon, folded: () => SIDE.folded,
});

/** The chat behind a conversation: "ws" → workspace, "p:x" → x (threads use their project). */
const chatOf = convProject;
const convOfChat = (/** @type {string} */ chat) => chat === "workspace" ? "ws" : "p:" + chat;
const { homeParts, homeRender, openNext, restore: restoreHomeDecision } = createHomeController({
  host: $("#home"), scope: appScope, isCurrent: () => currentView() === "home", D, world, Kit, EFFORT,
  evidenceFor, convOfChat, threadMark, noun, isBusy, askTitle, PROJ, kernel, heraldShow,
  SV: { homeOrder: (body) => SV.homeOrder(body) }, announce, schedule, decideKey: (key) => decideKey(key),
});
const messagesOf = createConversationMessages({ localMessages, shape: SHAPE, world, D, PROJ, convThread, chatOf, convProject, threadsOf });

const pendingStops = createPendingRunStops();
/** @type {ReturnType<typeof createRunsModule>["working"]} */
const workingRuns = (thread) => runs.working(thread);
const { stopsHerald, stopRun, interruptRun, isStopping, dispose: disposeConversationStops } = createConversationStops({
  world, Kit, PROJ, announce, schedule, chatOf, pendingStops, heraldShow, running: (view) => running(view), workingRuns,
  inUse: (selector) => inUse(selector),
  dismissStops: () => notices.dismiss((notice) => notice.tag === "stops"),
});
const running = createRunningState({ view: currentView, isStopping, world, CH, convThread, chatOf });
const runs = createRunsModule({
  stage: STAGE, shape: SHAPE, transcript: transcriptFolds, pendingStops, stopsHerald, heraldShow, commitMs: Kit.COMMIT_MS,
  placeRegion: () => placeRegion(), threadScroller: () => TP.C?.scroller,
  headFor: (opener) => convAt(opener) === MAIN ? $("#thead") : $("#tpthead"),
  threadAt: (opener) => convThread(convAt(opener).view),
});
const { render: checklistRender, toggle: toggleChecklist } = createChecklistRenderer({
  view: currentView, scope: appScope, SHAPE, convThread, places: kernel.places, schedule,
});

// ── the thread's own decision: docked above the composer (Today's card, #20) ──
const tdock = $("#tdock");
const dockFolds = createDockFolds();
const { decideKey, decideLimit, limitStatus } = createConversationDecisionActions({
  view: currentView, unfold: dockFolds.unfold, scope: appScope, D, world, tdock, convThread, schedule, announce,
});
const dockDeps = { CH, D, folds: dockFolds, world, convThread, convHost, askShort, schedule, dockGestures };
const MDOCK = createDock({ el: tdock, view: currentView, region: () => placeRegion() }, dockDeps);
const dockRender = MDOCK.render;

const sendingTo = (/** @type {string} */ chat) => localMessages.list(convOfChat(chat)).find((m) => m.who === "you" && m.status === "sending" && m.target === chat) || null;
let TYPING = null;
function typingRender(C = MAIN) { return (TYPING ||= createTyping({ world, CH, PROJ, convThread, chatOf, isBusy, heldWords, openAsk, sendingTo, schedule: () => schedule(), tick: () => tickElapsed() })).render(C); }
/** @param {string} text */
function toastLine(text) { announce(text); heraldShow({ kind: "done", text }, 1600); }
// only a clock whose words changed is written (a rewrite is a mutation every layer reacts to)
appScope.interval(tickElapsed, 1000);

const stopRegionRings = regionRings();
const stopFocusInView = keepFocusInView();
/** @param {string} sel */
const inUse = (sel) => () => { const K = composerNow(); return sel === "#send" ? K.send : K.main ? $(sel) : TP.box?.querySelector(sel) ?? null; };

// ── intelligence: the record line and the chip ─────────────────────────────
const { recordLine, undoRecord, dispose: disposeRecordLines } = createRecordLines({
  view: currentView, localMessages, announce, schedule, heraldShow, placeRegion: () => placeRegion(),
  dismissRecord: (id) => notices.dismiss((notice) => notice.undo === id),
});
// ── the composer: send, or Stop while something runs ───────────────────────
const MK = createMainComposer(currentView, () => MAIN);
const { say } = MK;
const { composerAt, composerNow, composers, dispose: disposeComposerFocus } = createComposerFocus({
  main: MK,
  panel: () => TP.K && TP.box ? { composer: TP.K, host: TP.box } : null,
  isThread: () => STAGE.pageShown?.name === "thread",
  coversChat: () => document.body.classList.contains("stage-full") || PHONE.matches,
}, schedule);
const { saveDraft, loadDraft } = createDrafts(MK, (composer) => { mentions.reset(composer); updateComposer(composer); });
const { startHtml, startDraft } = createConversationStarts({ SHAPE, PROJ, say, growSay: () => growSay(), saveDraft, updateComposer: () => updateComposer() });
let trayFrame = false;
const tray = createTray({ upload: uploadAttachment, onChange: () => {
  if (trayFrame) return;
  trayFrame = true;
  appScope.frame(() => { trayFrame = false; trayRender(); sendRender(); });
} });
/** Storm conversations take files; a plain chat (Chats) has no route for them. */
const canAttach = (/** @type {string} */ v) => !CH.isChats(v);
/** The chat id a file added here uploads to: the Workspace, the project, or the thread's project. */
const attachChat = (/** @type {string} */ v) => { const p = chatOf(v); return p && world.act.chatId ? world.act.chatId(p) : null; };
const filesHere = (view = currentView()) => (canAttach(view) ? tray.status(view) : { count: 0, busy: false, failed: false });
const { trayRender, addFiles, insertText, wireTray, dropThumb } = createComposerAttachments({ MK, tray, canAttach, attachChat, announce, heraldShow, updateComposer: (K) => updateComposer(K), saveDraft, VW });
const fileReferences = createFileReferences();
const { liveBlock, blockFor, refuse, connDest, deliverLive, send, retry, putBack, editFailed } = createDelivery({
  view: currentView, signal: appScope.signal, localMessages, fileReferences, world, MK, say, CH, STAGE, PROJ, chatOf, convOfChat, convThread,
  convProject, composerAt: (node) => composerAt(node),
  filesHere, tray, dropThumb, saveDraft, updateComposer: (K) => updateComposer(K), growSay: (K) => growSay(K), announce, heraldShow, heraldFor, schedule, render: () => render(), go,
});
const { heraldBox, heraldRender, heraldRoom, heraldBack } = createNoticeLine({
  notice: notices.current, world, MK, composerNow, panelHost: () => TP.box, connDest, placeRegion: () => placeRegion(), STOP_ICON,
});

const { targetLineRender, syncPlaceholder } = createComposerTarget({ MK, world, CH, PHONE, PROJ, convThread, convProject, liveBlock, isBusy, sendWhileRunning, noun });
const { chipRender, sendRender, chatTargetRender } = createComposerControls({
  MK, CH, IQ, PHONE, STOP_ICON, sessionOf, filesHere, running, liveBlock,
});
const mentions = createMentionList({ MK, world, projects, projectIcon, isBusy, saveDraft, updateComposer: (K) => updateComposer(K) });
const { wireComposer, growSay, updateComposer } = createComposer({
  MK, say, trayRender, chipRender, lrefRender: () => lrefRender(), chatTargetRender, syncPlaceholder, sendRender,
  targetLineRender, connDest, schedule, mentions, saveDraft, send, stopRun,
});
mountMainComposer(appScope, MK, { wireTray, wireComposer, composerAt, canAttach, addFiles });
bindChatButtons({
  scope: appScope, target: $("#target"), permissions: $("#cs-perm"), sendNow: $("#send-now"), intelligence: $("#iq"),
  updateComposer, aim: () => mentions.aim(MK), toggleIntelligence: (view, chip) => toggleIq(sessionOf(view), chip),
});

const { TP, tpMount, tpShow, tpFocus, tpClose, drawThreadPage } = createThreadPage({
  STAGE, threadControls, world, D, createDock, dockDeps, wireComposer, wireTray, closeThreadMenu: () => closeThreadMenu(), addFiles, toggleIq, sessionOf, convProject, heraldRoom,
  toastLine, loadAhead: (C) => loadAhead(C), returnPill: (destination) => returnPill(destination), saveDraft, loadDraft, convThread,
  stOf, glyphOf, isHeld, wordOf, rtTag, threadMenuHtml, checklistRender, drawConv: (C, needs) => drawConv(C, needs), updateComposer, sendRender, targetLineRender,
});
/** @type {import("../shell/panel/pages.js").PageSpec & { id: string }} */
const threadPage = {
  id: "thread",
  title: (key) => world.thread(key)?.title || "Thread",
  mount: (box) => tpMount(box),
  onShow: tpShow,
  focusEntry: tpFocus,
  // a reply being written is kept (its draft), so closing never loses it: nothing to ask
  close: () => tpClose(),
  // Esc in its composer leaves the field first (the draft stays); the next Esc goes back to the sections
  escape: () => { if (threadControls.menu()?.location === "page") { closeThreadMenu(); return true; }
    if (TP.K && document.activeElement === TP.K.say && !TP.K.at.hidden) { mentions.closeAtCaret(TP.K); return true; }
    if (TP.K && document.activeElement === TP.K.say) { TP.K.say.blur(); TP.C?.scroller.focus({ preventScroll: true }); return true; } return false; },
};
const threadPageModuleId = "xo.thread-page";
kernel.register({
  manifest: { id: threadPageModuleId, version: "1.0.0", kernel: "^1.1.0", contributes: ["panel.page:thread"] },
  activate: (ctx) => { ctx.contribute("panel.page", threadPage); },
});
// the thread moves from the panel into the main chat: its frame snaps across while the panel steps back without its copy
/** @param {string} id */
function toMain(id) {
  closeThreadMenu({ focus: false });
  STAGE.closePage("thread"); go("t:" + id, { panel: true });
}
appScope.listen(document, "click", ({ target }) => {
  const id = target instanceof Element ? target.closest("[data-tp-main]")?.getAttribute("data-tp-main") : null;
  if (id) toMain(id);
});
const { showMsg } = createConversationNavigation({ alias: localMessages.alias, main: () => MAIN });
const openFromPanel = createPanelThreadOpener({ view: navigationState.view, world, STAGE, TP, go, showMsg });

const scroller = $("#scroller"), msgsEl = $("#msgs");
const MAIN = createConv({ view: currentView, msgs: msgsEl, scroller, column: $("#column"), typing: $("#typing"), main: true,
  follow: { toLatest, toTop, unpin, isPinned, fromTop, toRow, fromLatest } });
const { readingPlace, holdPlace, foldsBefore, workMotion } = createReadingLayout({ takeFoldChange: transcriptFolds.takeChange, MAIN });

/** Where you carry on when the control you were on goes and nothing more particular is named: the place's own
 *  region (Home, Artifacts, else the conversation). */
const placeRegion = () => pageEl(currentView()) || scroller;
const { loadAhead, loadOlderNow } = createConversationPaging({ MAIN, CH, world, convThread, chatOf, render: () => render() });


// what scrolling asks of the page (an older page near the top, the header's edge): once a frame, not once an event
let scrolling = false;
appScope.listen(scroller, "scroll", () => {
  if (scrolling) return;
  scrolling = true;
  appScope.frame(() => { scrolling = false; loadAhead(); $("#top").classList.toggle("is-scrolled", fromTop() > 120); });
}, { passive: true });
watchDock(appScope, { dock: $("#dock"), host: $("#app"), heraldRoom });
appScope.effect(initFollow);

// ── navigation: back always returns exactly where you were ─────────────────
const returnPill = createReturnPill({ msgsEl, scroller, toRow });
const { liveReady, follow, loadChatHops, ensureRoot } = createLiveConversation({ view: currentView, world, CH, convThread, chatOf });
const messageDetails = createMessageDetails({
  aliases: localMessages.aliases, world, REC: artifacts, SHAPE, PROJ, convThread, convProject, isBusy, isHeld, stOf, glyphOf, wordOf, EFFORT,
  askTitle, threadMark, noun, sendWhileRunning, running, workingRuns, agentOf, isStopping,
});
const { msgItems, drawingView } = createMessageItems({
  limitStatus, world, CH, CHG, STAGE, PROJ, projects, convThread, convProject, messagesOf, fwdSource, reactionsHtml, transcriptOpen: transcriptFolds.open,
  youText: (text) => youText(text), startHtml, fileRoute: (path, conv) => fileRoute(path, conv), ...messageDetails,
});
const drawConv = createConversationDrawing({
  CHG, msgItems, readingPlace, holdPlace, foldsBefore, workMotion, ensureRoot, liveReady, typingRender,
});
const { go: navigate, back } = createNavigation({
  location: navigationState, VW, STAGE, IQ, PHONE, bus: kernel.bus, say, scroller, closeSettings, setDrawer: (open) => setDrawer(open),
  clearDock: () => MDOCK.reset({ restoreFocus: false }),
  clearThreadEdit: threadControls.clear,
  saveDraft, follow, pageEl, loadDraft, render: () => render(), returnPill, convThread,
});
/** @param {string} v @param {import("../shell/navigation-types.d.ts").NavigationOptions} [options] */
function go(v, options) { return navigate(v, options); }
appScope.listen($("#top-back"), "click", back);

// ── files on messages (hub #30): the shared-file card, opening in the same viewer ──
const openMedia = createMediaOpener({ msgsEl, LB, VW });


const { youText, askPlace, askAboutLines, composeAbout, askAboutFile, lrefRender } = createFileQuestion({
  view: currentView, localMessages, fileReferences, world, PROJ, convOfChat, CH, say, VW, STAGE, go, announce, heraldShow, schedule, blockFor, refuse, deliverLive,
  fileScope, localIn, lineRef, fileRef,
});

const resolveThread = createThreadResolve({ world, schedule, announce, heraldFor, heraldShow, heraldDrop });
const threadEditing = createThreadEditing({
  controls: threadControls, world, render: () => render(), schedule, announce, heraldShow, composerAt: (el) => composerAt(el), requestFocus: redrawFocus.request,
});
const { closeThreadMenu } = threadEditing;
const threadDelete = createThreadDelete({ world, render: () => render(), view: currentView, go, announce, heraldShow, PROJ });
const threadMenuAction = createThreadMenuActions({
  thread: world.thread, go, controls: threadControls, editing: threadEditing, deletion: threadDelete,
  render: () => render(), schedule, scope: appScope, resolve: resolveThread, heraldShow,
  closePage: () => STAGE.closePage("thread"), showThread: (id, input) => STAGE.show("thread", id, { focus: true, input }),
  openOtherRuntime: () => openAlternate(sessionOf(currentView()), $("#iq")),
});
menuKeys($("#top"), { close: () => closeThreadMenu() });
threadEditing.bind($("#top"));
// "Coordinator needs you" in a chat's header: the card above the composer, unfolded and in focus
appScope.listen($("#top"), "click", ({ target }) => {
  const id = target instanceof Element ? target.closest("[data-dock-open]")?.getAttribute("data-dock-open") : null;
  if (!id) return;
  dockFolds.unfold(id);
  dockRender(D.needItems());
  appScope.frame(() => tdock.querySelector(".card")?.focus({ preventScroll: true }));
});

/** The conversation containing a control, or the main chat. */
const convAt = (/** @type {Node | null} */ el) => (TP.box?.contains(el) && TP.C ? TP.C : MAIN);
const { fileRoute, openSharedFile, openLineRef } = createConversationFiles({ currentView: () => drawingView() || currentView(), convThread, convAt, CHG, VW });
/** @param {Element} el */
const rowIn = (el) => el.closest("#msgs > [data-k]")?.getAttribute("data-k") ?? null;
appScope.listen(document, "click", (event) => {
  const t = event.target;
  if (!(t instanceof Element)) return;
  const e = /** @type {MouseEvent} */ (event);
  /** @param {string} attribute */
  const action = (attribute) => t.closest(`[${attribute}]`)?.getAttribute(attribute);
  if (t.closest("#iq-pop")) return;
  const link = t.closest("[data-go]");
  const destination = link?.getAttribute("data-go");
  if (link && destination && !t.closest("#stage")) {
    e.preventDefault();
    go(destination, { row: rowIn(link) });
    const message = link.getAttribute("data-go-msg");
    if (message) showMsg(message);
    return;
  }
  const tl = t.closest("a[data-thread]");
  const threadId = tl?.getAttribute("data-thread");
  if (tl && threadId) {
    e.preventDefault();
    if (world.thread(threadId)) {
      if (t.closest("#stage")) openFromPanel("t:" + threadId, e);
      else go("t:" + threadId, { row: rowIn(tl) });
    } else heraldShow({ kind: "calm", text: "That thread isn't loaded", sub: "it may be in another project" }, 3200);
    return;
  }
  if (t.closest("[data-older]")) { loadOlderNow(convAt(t)); return; }
  const start = action("data-start");
  if (start != null) { startDraft(+start); return; }
  const decide = action("data-decide");
  if (decide) { decideKey(decide); return; }
  if (t.closest("[data-next]")) { openNext(); return; }
  if (t.closest("[data-create]")) { CREATE.open(); return; }
  const shell = action("data-shell");
  if (shell != null) { openShell(shell); return; }
  const recordUndo = action("data-rec-undo");
  if (recordUndo) { undoRecord(recordUndo); return; }
  // Return focus when the notice disappears, including when its opener redraws.
  if (t.closest("[data-herald-undo]")) {
    const h = notices.current(), u = h?.undo;
    // a notice whose Undo names its own destination (Launchpad's) is left to it (lpshell LP21/LP36)
    if (!h?.ownFocus) {
      heraldBack(h)?.focus({ preventScroll: true });
      const K = composerNow();
      redrawFocus.request([...((h && h.back) || []), () => K.say]);
    }
    if (typeof u === "function") notices.undo();
    else if (u) undoRecord(u);
    return;
  }
  if (chatMessageAction(t)) return;
  if (runs.openFrom(t)) return;
  // storm blocks: open or fold a block or a row (thinking steps, an activity group, a command's output)
  const tb = t.closest("[data-tb]");
  if (tb) {
    const key = tb.getAttribute("data-tb");
    if (!key) return;
    const tc = convAt(tb);
    if (tb.closest(".msgs")) tc.follow.unpin();
    transcriptFolds.toggle(key, { host: tc.msgs, restoreFocus: tb.contains(document.activeElement) });
    schedule(); return;
  }
  const lb = t.closest("[data-limit]");
  const limit = lb?.getAttribute("data-limit"), decision = lb?.getAttribute("data-limit-d");
  if (limit && decision) { void decideLimit(limit, decision); return; }
  if (threadMenuAction(t, e)) return;
  if (t.closest("[data-ck]")) { const tc = convAt(t), th = convThread(tc.view); if (th) { toggleChecklist(th.id); if (tc === MAIN) checklistRender(D.needItems()); else checklistRender(D.needItems(), $("#tpthead"), tc.view, "tck-list"); } return; }
  const retryId = action("data-retry");
  if (retryId) { retry(retryId); return; }
  // A stopped turn moves focus from Interrupt to Undo.
  if (t.closest("[data-interrupt]")) {
    redrawFocus.request([() => heraldBox()?.querySelector("[data-herald-undo]")]);
    interruptRun(convAt(t).view);
    return;
  }
  const ed = t.closest("[data-edit]");
  const edit = ed?.getAttribute("data-edit");
  if (ed && edit) { editFailed(edit, composerAt(ed)); return; }
  const mx = t.closest("[data-mx]");
  if (mx instanceof HTMLElement) { openMedia(mx, e); return; }
  if (t.closest("[data-lref-x]")) { fileReferences.remove(currentView()); lrefRender(); say.focus(); return; }
  const lr = t.closest("[data-ref]");
  if (lr instanceof HTMLElement) { e.preventDefault(); openLineRef(lr); return; }
  // a changed file's chip: its diff in the panel's Changes; anything else (a link to a file), Files
  const cf = t.closest(".tb-cf[data-file]");
  // Unpin on the source row so opening the panel keeps the reading position.
  if (cf) {
    const cv = convAt(cf), c = CHG.forTarget(cv.view, cf.getAttribute("data-file") || "");
    if (c) {
      cv.follow.unpin(cf); // the row you clicked in stays where it is while the panel takes its room (follow.js)
      const s = CHG.scope(cv.view);
      const inFiles = () => {
        if (!s || !(cf instanceof HTMLElement)) return;
        const rel = s.worktree ? `.xo/worktrees/${s.worktree}/${c.path}` : c.path;
        VW.open({ path: c.path, name: c.path.split("/").pop(), project: s.project, rel, show: "changes" }, cf);
      };
      // ⌘/Ctrl-click: its diff in the panel's Files page, as the file (the same place a file opens)
      if (s && (e.metaKey || e.ctrlKey)) { inFiles(); return; }
      // Focus the Changes row when the diff opens in the panel.
      if (STAGE.showChange(c.path)) {
        redrawFocus.request([`#stage [data-cx="${CSS.escape(c.path)}"]`, "#stage .cx-pd"]);
        schedule();
        return;
      }
      // a shape without the panel's Changes (Make content): its diff in Files instead
      if (s) { inFiles(); return; }
    }
  }
  const fb = t.closest("[data-file]");
  if (fb instanceof HTMLElement) { e.preventDefault(); openSharedFile(fb); return; }
  const cp = t.closest("[data-copy]");
  if (cp) void codeCopy.copy(cp);
});
/** @type {Parameters<typeof createConversationHeader<DecisionNeed>>[0]} */
const headerOptions = {
  threadControls, description: (project) => projectDescriptions.get(project), world, PICK, LP, LW, STAGE, kernel, atOf,
  convHost, homeParts, projects, doneToday, isBusy, isHeld,
  threadCounts, PROJ, projectIcon, threadsCtl, threadTitleInput, threadLabelInput, threadMenuHtml, stOf, glyphOf, wordOf, rtTag,
};
const conversationHeaderHtml = createConversationHeader(headerOptions);
const topRender = createTopHeader({
  location: navigationState, convThread, isBusy, CH, STAGE, checklistRender, PROJ, conversationHeaderHtml, kernel, atOf, LP, LW, tdelRender: threadDelete.render,
}, appScope, schedule);
const { panelShell, openShell, dispose: disposeShellPanel } = createShellPanel({
  view: navigationState.view, STAGE, SH, world, heraldShow,
});

// ── phone drawer ────────────────────────────────────────────────────────────
const setDrawer = createDrawer({ phone: PHONE, syncInert: () => syncInert() });

// ── Create XO Project (modules/create-project/create.js): start empty or clone a repository ─────
const CREATE = initCreate({
  world, go, heraldShow, announce, setDrawer,
  welcome: (id, description, text) => {
    if (description) projectDescriptions.set(id, description);
    localMessages.welcome(`p:${id}`, text);
  },
  // On a phone the sidebar button that opened it is inside the closed drawer: return to the menu.
  onPhoneClose: () => { if (PHONE.matches) appScope.timeout(() => $("#pb-menu").focus({ preventScroll: true }), RM.matches ? 0 : 170); },
}, appScope);
appScope.listen($("#side-add"), "click", CREATE.open);

// ── jump (⌘K) ───────────────────────────────────────────────────────────────
const jump = $("#jump");
const focusOverlay = createOverlayFocus(appScope);
const JUMP = createWorkspaceJump({
  host: jump, sources: kernel.places, items: { D, projects, threadsOf, projectIcon, glyphOf, wordOf },
  actions: {
    create: () => CREATE.open(), settings: openSettings, keys: () => openKeys(), theme: () => $("#theme").click(),
    intelligence: () => !!IQ.kindOf(sessionOf(currentView())), openIntelligence: () => IQ.open(sessionOf(currentView()), $("#iq")),
    stage: () => !pageEl(currentView()), toggleStage: () => STAGE.toggle(),
  },
  go, announce, focusIn: focusOverlay, onHidden: () => syncInert(),
}, appScope);

// ── keys sheet ──────────────────────────────────────────────────────────────
const keys = $("#keys");
const { openKeys, closeKeys } = createShortcutsSheet({ keys, closeButton: keys.querySelector("[data-close]"), keysSheetRender, focusOverlay, syncInert: () => syncInert() });

// ── settings: a page over the main area; closing it returns exactly where you were ──
const setEl = $("#settings");
kernel.register(createAppServices({ world, announce, projectName: (id) => id ? PROJ(id) : "", currentView }, schedule));
// Settings › Shape and the page's own reading of the shape (density, work, rail)
const soundRender = wireSound({ sound, announce });
const SV = createShapeView({ shape: SHAPE, announce, notice: (n) => heraldShow({ kind: "stopped", text: n.text, sub: n.sub, force: true }) });
const shapeApply = createShapeApply({ view: currentView, SV, SHAPE, setWorkMode, convThread, world, loadChatHops, SH, STAGE, schedule });
appScope.effect(() => SHAPE.onChange(() => shapeApply()));
shapeApply({ boot: true });
const settings = createSettingsModule({
  el: setEl, side: $("#set-side"), phoneButton: $("#set-phone"), closeButton: $("#set-x"), phone: PHONE,
  focusIn: focusOverlay, fallback: () => say,
  at: () => { const view = currentView(); return { project: view.startsWith("p:") ? view.slice(2) : convThread(view)?.project }; },
  preferences: { THEME, shape: SHAPE, webPictures: WEBPICS },
  mountRuntimes: (runtimeHost) => createRuntimeSettings({ world, announce, ...runtimeHost }), shape: SV,
  beforeOpen: () => { setDrawer(false); if (D.isOpen()) D.close(); IQ.close({ restore: false }); },
  onHidden: () => syncInert(),
});
const leafModules = [sinceModule, artifacts.module, runs.module, settings.module, MAP.module, createChangesModule(CHG), filesModule];
for (const module of [...leafModules, routingModule, rulesModule, worktreesModule]) kernel.register(module);
function openSettings() { settings.open(); }
/** @param {Parameters<typeof settings.close>[0]} [options] */
function closeSettings(options) { settings.close(options); }
appScope.effect(() => K.onChange(() => { if (!keys.hidden) keysSheetRender(); schedule(); }));

wireThemeToggle(appScope, applyTheme, announce);

/** @type {Parameters<typeof createShellRenderer<DecisionNeed, WorldThread, Conversation>>[0]} */
const rendererOptions = {
  world, D, view: currentView, restoreFocus: redrawFocus.restore, PAGE_OF, MAIN,
  pings, dockAtTop, convThread, sideRender, homeRender, places: kernel.places, LPP,
  topRender, wsHeadRender, drawConv, say, msgsEl, placeRegion, loadAhead, TP, STAGE, drawThreadPage,
  dockRender, heraldRender, chatTargetRender, targetLineRender, syncPlaceholder, sendRender, chipRender,
  MAP, VW, LW, FP, titleFor: Kit.titleFor, isBusy,
};
const renderShell = createShellRenderer(rendererOptions, appScope, schedule);
function render() {
  renderShell();
  if (world.state.loaded) activateIntel(sessionOf);
}

const SIDE = createSide({ shape: SHAPE, keys: K, announce, render, toggleJump: () => (jump.hidden ? JUMP.open() : JUMP.close()) });

// the Map's toggle, in every conversation's header
appScope.listen(document, "click", ({ target }) => {
  if (!(target instanceof Element)) return;
  if (target.closest("[data-stage-toggle]")) STAGE.toggle();
  else if (target.closest("[data-stage-open]")) STAGE.threads();
  else {
    const button = target.closest("[data-lp-open]");
    if (button instanceof HTMLElement) {
      if (LW.isOpen) LW.close();
      else LW.open(currentView(), button);
    }
  }
});

const GLOBAL = {
  shells: () => SH.toggle(),
  jump: () => (jump.hidden ? JUMP.open() : JUMP.close()),
  intel: () => { const K = composerNow(); toggleIq(sessionOf(K.view), K.iq); },
  write: () => composerNow().say.focus(),
  keys: () => openKeys(),
  map: () => STAGE.toggle(),
  sideFold: () => SIDE.fold(!SIDE.folded),
};

// One history entry of the app's own while there's somewhere to go back to: Back closes the top-most open layer, then goes to a thread's parent, then the places you came through; with nothing left the browser leaves.
const LAYERS = stackLayers(kernel.layers, [
  { id: "create", open: () => CREATE.isOpen(), close: () => { CREATE.close(); } },
  { id: "jump", tab: () => jump, inertsApp: true, watchHidden: jump, open: () => !jump.hidden, close: () => { JUMP.close(); } },
  { id: "intel", open: () => IQ.isOpen, close: () => { IQ.close(); } },
  { id: "quickopen", inertsApp: true, open: () => QO.isOpen, close: () => { QO.close(); } },
  runs.layer,
  { id: "keys", tab: () => keys, inertsApp: true, watchHidden: keys, open: () => !keys.hidden, close: () => { closeKeys(); } },
  { id: "lightbox", open: () => LB.isOpen, close: () => { LB.close(); }, overlay: false },
  { id: "settings", tab: () => PHONE.matches ? setEl : null, watchHidden: setEl, open: () => !setEl.hidden, close: () => { closeSettings(); } },
  { id: "files-page", open: () => FP.isOpen, close: () => { STAGE.back(); } },
  { id: "viewer", open: () => VW.isOpen, close: () => { VW.close({ ask: true }); }, overlay: false },
  { id: "panel-sheet", open: () => STAGE.isOpen && PHONE.matches, close: () => { STAGE.close(); } },
  { id: "shells", open: () => SH.raised, close: () => SH.lower() },
  { id: "drawer", tab: () => PHONE.matches ? $("#side") : null, open: () => $("#app").classList.contains("drawer"), close: () => { setDrawer(false); } },
  { id: "decisions", open: () => D.isOpen(), close: () => { D.close(); } },
  { id: "chat-setup", open: () => CH.setupOpen, close: () => { CH.closeSetup(); } },
]);
/** @param {string} v */
const placeOk = (v) => v === "ws" || CH.isChats(v) || Object.hasOwn(PAGE_OF, v)
  || v.startsWith("p:") && !!world.project(v.slice(2)) || v.startsWith("t:") && !!world.thread(v.slice(2));
const { syncInert, dispose: disposeKeyboardLayers } = mountKeyboardLayers({
  layers: LAYERS, phone: PHONE, app: $("#app"), main: $("#main"), side: $("#side"), settings: setEl,
});
const disposeGlobalKeys = wireGlobalKeys({
  view: navigationState.view, capturing: settings.capturing, SH, jump, IQ, CREATE, keys, GLOBAL, FP, QO, LAYERS, back, go,
});
const { canBack, stepBack } = createBackSteps({ location: navigationState, LAYERS, placeOk, go, back });
appScope.effect(() => wireBack({ canBack, stepBack }));

// ── touch gestures and the title back to the top ──
wireGestures({
  phone: () => PHONE.matches,
  overlay: () => LAYERS.open({ overlay: true }),
  view: currentView,
  back,
  drawer: (open) => setDrawer(open),
  isDrawer: () => $("#app").classList.contains("drawer"),
  settingsOpen: () => !setEl.hidden, closeSettings: () => closeSettings(),
  viewerOpen: () => VW.isOpen, closeViewer: () => VW.close(),
  panelOpen: () => D.isOpen(),
  sheets: [
    { host: $("#panel"), open: () => PHONE.matches && D.isOpen(), close: () => D.close() },
    { host: jump, card: () => jump.querySelector(".sheet-card"), open: () => !jump.hidden, close: JUMP.close },
    { host: keys, card: () => keys.querySelector(".sheet-card"), open: () => !keys.hidden, close: closeKeys },
    { host: $("#iq-pop"), open: () => IQ.isOpen && $("#iq-pop").classList.contains("is-sheet"), close: () => IQ.close() },
    { host: $("#cs-pop"), open: () => CH.setupOpen && $("#cs-pop").classList.contains("is-sheet"), close: () => { CH.closeSetup(); updateComposer(); } },
  ],
  say,
  toast: (text) => toastLine(text),
}, wordsOf, appScope);
appScope.listen($("#pb-t"), "click", () => {
  (currentView() === "home" ? $("#home") : scroller).scrollTo({ top: 0, behavior: RM.matches ? "auto" : "smooth" });
});

// ── boot ────────────────────────────────────────────────────────────────────
drawPlaceIcons();
mountChatControls({
  scope: appScope, scroller, greeting: $("#cs-hi"), setup: $("#cs-pop"), phone: PHONE, updateComposer,
});
drawFrameIcons(SHAPE_IC);
$("#send").innerHTML = ICON.send; $("#send").dataset.mode = "send";
appScope.effect(mountMainDecoration);
for (const module of leafModules) appScope.effect(() => () => { void kernel.disable(module.manifest.id); });
for (const dispose of [
  codeCopy.dispose, disposeComposerFocus, disposeGlobalKeys, disposeKeyboardLayers, LAYERS.undo, SIDE.dispose,
  CH.dispose, IQ.dispose, GH.dispose,
  threadDelete.dispose, threadEditing.dispose, stopRegionRings, stopFocusInView, notices.dispose,
  disposeRecordLines,
  SH.dispose, disposeShellPanel, () => { void kernel.disable(threadPageModuleId); }, disposeConversationStops,
  STAGE.disposeLayout, LPP.dispose, LW.dispose,
]) appScope.effect(() => dispose);
appScope.listen(window, "pagehide", (event) => {
  kernel.bus.emit("app:pagehide");
  if ("persisted" in event && event.persisted) return;
  appScope.dispose();
});
await kernel.start();
appScope.effect(() => startShell({ THEME, applyTheme, SIDE, soundRender, PHONE, setDrawer, render, world, schedule, follow, loadDraft }));
