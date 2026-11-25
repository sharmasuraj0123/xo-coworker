// @ts-check
import { bindConversationPress, mountPressRoutes, valuePress } from "../shell/conversation-press.js";
import { createWorld } from "../core/services/world/store.js";
import { PHONE as viewportPhone } from "../core/platform/viewport.js";
import { createCodeCopy } from "../core/ui/markdown/copy.js";
import { createNoticeLine } from "../modules/conversation/notice-line.js";
import "../core/ui/components/xo-select.js";
import { setThreadInfo } from "../core/ui/markdown/markdown.js";
import * as Kit from "../modules/decisions/kit.js";
import * as K from "../core/platform/keys.js";
import { createDecisionSurface } from "../modules/decisions/surface.js";
import { createIntelSurface } from "../modules/chats/intel-surface.js";
import { EFFORT, evidenceFor } from "../modules/decisions/rank.js";
import { ICON } from "../core/ui/icons/names.js";
import { $ } from "../core/platform/dom.js";
import { dockAtTop } from "../modules/conversation/dock-layout.js";
import { RM } from "../core/ui/motion.js";
import { heldWords } from "../core/services/world/timeline.js";
import { createPlaceContext, PAGE_OF, pageEl, panelPlace, sessionOf, convOfChat } from "../shell/place-context.js";
import { stepLineHtml, turnHtml, turnAv, setWorkMode } from "../modules/conversation/blocks/turn.js";
import { nameWith } from "../core/services/comms.js";
import { viewerFile } from "../core/services/media/items.js";
import { wireDragOut } from "../core/services/media/hydrate.js";
import { mountConversationMarkdown, WEBPICS } from "../modules/conversation/markdown.js";
import { createLightbox } from "../modules/conversation/lightbox.js";
import { createRunsModule } from "../modules/runs/module.js";
import { createPendingRunStops } from "../core/services/run-stops.js";
import { createSettingsModule } from "../modules/settings/module.js";
import { routingModule } from "../modules/routing/module.js";
import { rulesModule } from "../modules/rules/module.js";
import { worktreesModule } from "../modules/worktrees/module.js";
import { createRuntimeSettings } from "../modules/runtimes/settings.js";
import { createChatSurface } from "../modules/chats/surface.js";
import { toRow } from "../modules/conversation/follow.js";
import { mountMainDecoration } from "../modules/conversation/main-decoration.js";
import { createTyping } from "../modules/conversation/typing.js";
import { mountMainViewport } from "../modules/conversation/main-viewport.js";
import { createConversationStops } from "../modules/conversation/stops.js";
import { createRunningState } from "../modules/conversation/running.js";
import { createTranscriptFolds } from "../modules/conversation/transcript-folds.js";
import { createLocalMessages } from "../modules/conversation/local-messages.js";
import { createLiveConversation } from "../modules/conversation/live.js";
import { createConversationDrawing } from "../modules/conversation/draw.js";
import { createConversationMessages } from "../modules/conversation/messages.js";
import { createMessageDetails } from "../modules/conversation/message-details.js";
import { createMessageItems } from "../modules/conversation/message-items.js";
import { createThreadPageModule } from "../modules/conversation/thread-page-module.js";
import { createConversationNavigation } from "../modules/conversation/navigation.js";
import { transcriptActions } from "../modules/conversation/transcript-actions.js";
import { createNavigationLinks } from "../shell/navigation-links.js";
import { createChecklistRenderer } from "../modules/conversation/checklist.js";
import { createConversationHeader } from "../modules/conversation/header.js";
import { createComposerSurface } from "../modules/conversation/composer-surface.js";
import { createMessageContext } from "../modules/conversation/message-context.js";
import { createDock } from "../modules/decisions/dock.js";
import { createDockFolds } from "../modules/decisions/dock-folds.js";
import { createConversationDecisionActions } from "../modules/decisions/conversation-actions.js";
import { tickElapsed } from "../shell/elapsed.js";
import { askTitle, askShort } from "../modules/decisions/ask-label.js";
import { createFilesModule } from "../modules/files/module.js";
import { diff, jump as jumpDiff, setTheme as setDiffTheme } from "../modules/changes/diffview.js";
import { isImageChange, drawImageChange } from "../modules/changes/imagechange.js";
import { createMapModule } from "../modules/map/module.js";
import { createStage } from "../shell/panel/panel.js";
import { bindPanelHeaderControls } from "../shell/panel/header-controls.js";
import { createSide } from "../shell/rail/side.js";
import { kernel } from "../shell/kernel.js";
import { wireHeaderActions } from "../shell/header.js";
import { createTopHeader } from "../shell/top-header.js";
import { createWorkspaceHeader } from "../shell/workspace-header.js";
import { mountShellInteractions } from "../shell/interactions.js";
import { createOverlayFocus } from "../shell/keyboard-layers.js";
import { createShortcutsSheet } from "../modules/settings/shortcuts-sheet.js";
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
import { createLaunchpadSurface } from "../modules/launchpad/surface.js";
import { createConversationFiles } from "../modules/files/conversation-files.js";
import { createMediaOpener } from "../modules/files/open-media.js";
import { fileScope, localIn } from "../modules/files/scope.js";
import { filePlace } from "../modules/files/search-place.js";
import { createFileSearch } from "../modules/search/file-search.js";
import { createWorkspaceJump } from "../modules/search/jump-items.js";
import { createChanges, lineRef, fileRef } from "../modules/changes/store.js";
import { createSavedSoon } from "../modules/changes/saved.js";
import { createThreadResolve } from "../modules/threads/resolve.js";
import { createThreadGroups } from "../modules/threads/groups.js";
import { threadsCtl } from "../modules/threads/header.js";
import { createThreadMenu } from "../modules/threads/menu.js";
import { createThreadMenuActions } from "../modules/threads/menu-actions.js";
import { threadNotices } from "../modules/threads/notices.js";
import { replyNotices } from "../modules/chats/reply-notices.js";
import { glyphOf, isBusy, isHeld, stOf, threadInfo, wordOf } from "../modules/threads/status.js";
import { createThreadDelete } from "../modules/threads/delete.js";
import { createThreadEditing, threadTitleInput, threadLabelInput } from "../modules/threads/editing.js";
import { createThreadControls } from "../modules/threads/controls.js";
import { createPanelThreadOpener } from "../modules/threads/open-panel-thread.js";
import { createGhPage } from "../modules/github/page.js";
import { createFileQuestion } from "../modules/conversation/file-question.js";
import { createChangesModule } from "../modules/changes/module.js";
import { api } from "../core/platform/api.js";
import { initCreate } from "../modules/create-project/create.js";
import { mountProjectIcons } from "../modules/projects/surface.js";
import { createShells } from "../modules/shells/dock.js";
import { createShellPanel } from "../modules/shells/panel.js";
import { createArtifactsModule } from "../modules/artifacts/module.js";
import { sinceModule } from "../modules/since/module.js";
import { createRecordLines } from "../modules/chats/record-lines.js";
import { createHomeController } from "../modules/home/controller.js";
import { skTile, bar as skBar, rememberedMade } from "../modules/home/skeleton.js";
import { dockGestures } from "../shell/gestures.js";
import { wordsOf } from "../modules/conversation/words.js";
import { createThreadRuntime } from "../modules/runtimes/thread.js";
import { createApplicationShape } from "../core/services/shape/application.js";
import { createShapeView, SHAPE_IC } from "../modules/settings/index.js";
import { menuKeys } from "../core/ui/a11y/keynav.js";
import { createConversationNotices } from "../core/services/notices/line.js";
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
const applicationShape = createApplicationShape({ scope: appScope, events: world, notice: (h) => heraldShow({ kind: "calm", ...h }, 6000) });
const SHAPE = applicationShape.shape;
const noun = mountConversationMarkdown(appScope, SHAPE, (path) => fileRoute(path));

const params = new URL(location.href).searchParams;
const { PROJ, projects, threadsOf, convThread, convProject, doneToday, atOf } = createPlaceContext(world);
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
const files = createFilesModule({
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
  stage: () => STAGE, openSharedFile: (button) => openSharedFile(button), openLineRef: (button) => openLineRef(button),
});
const savedSoon = createSavedSoon(CHG);
const { module: filesModule, viewer: VW, tree: FILES, page: FP } = files;
const { paths: PATHS, quickOpen: QO } = createFileSearch(appScope, files, {
  place: () => filePlace(currentView(), { thread: world.thread, project: PROJ }), announce, syncInert: () => syncInert(),
});
// A picture opens over the conversation; Open in Files hands it to the Files viewer.
const LB = createLightbox({ openFile: (it, from) => VW.open(viewerFile(it), from), announce });
wireDragOut($("#msgs"));
// shells (js/shells/): the dock under the main column, the sidebar's Shells row, the top bar's Shell buttons
const SH = createShells({ PROJ, announce, notify: (h) => heraldShow(h, 6000), onChange: () => schedule(), wanted: () => SHAPE.on("xo:dock/shells") });
applicationShape.terminal(() => SH.available);
const artifacts = createArtifactsModule({ go, VW, skTile, skBar, rememberedMade });

const wsHeadRender = createWorkspaceHeader(currentView, projects);
const { PICK, projectIcon } = mountProjectIcons(appScope, { world, SHAPE, PROJ, announce, render: () => render() });
nameWith({
  thread: (id) => world.thread(id)?.title || null,
  project: (chatId) => (world.state.projects || []).find((p) => p.chatId === chatId)?.name || null,
  here: () => { const v = currentView() || ""; const t = convThread(v); return t ? PROJ(t.project) : v.startsWith("p:") ? PROJ(v.slice(2)) : null; },
});
setThreadInfo(threadInfo(world.thread));
const MAP = createMapModule({ go: (v) => go(v, { panel: true }), isBusy, openFile: (f, from) => VW.open(f, from), stepLineHtml });
const { panelThreads, threadCounts } = createThreadGroups({
  world, D, MAP, convProject, askShort, threadMark: (t) => threadMark(t), isBusy, isHeld,
});
const { LP, LW, LPP, lpProject } = createLaunchpadSurface({
  world, isBusy, isHeld, PROJ, projectIcon, projects, go, announce, schedule, notices,
});
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

const threadNotice = threadNotices({ find: world.thread, projectName: PROJ, movedHere: IQ.movedHere, show: heraldShow, waitSince });
const replyNotice = replyNotices(currentView, PROJ, heraldShow, announce, schedule);
appScope.effect(() => world.onEvent((event) => { if (!replyNotice(event)) threadNotice(event); }));

/** @type {Parameters<typeof createDecisionPings<DecisionNeed>>[0]} */
const pingOptions = { view: currentView, P, PROJ, askShort, heraldShow };
const pings = createDecisionPings(pingOptions);

const sideRender = createSideRows({
  view: currentView, world, CH, REC: { artifacts }, D, projects, convThread, isBusy, isHeld, askShort, projectIcon, folded: () => SIDE.folded,
});

/** The chat behind a conversation: "ws" → workspace, "p:x" → x (threads use their project). */
const chatOf = convProject;
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
const { decideKey, limitStatus } = createConversationDecisionActions({
  places: kernel.places,
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
const { MK, say, composerAt, composerNow, composers, saveDraft, loadDraft, startHtml, addFiles, insertText, wireTray,
    fileReferences, liveBlock, blockFor, refuse, connDest, deliverLive, putBack, targetLineRender,
    syncPlaceholder, chipRender, sendRender, chatTargetRender, mentions, wireComposer, updateComposer } = createComposerSurface(appScope, {
  places: kernel.places, view: currentView, main: () => MAIN, panel: () => TP.K && TP.box ? { composer: TP.K, host: TP.box } : null,
  localMessages, world, CH, STAGE, PROJ, chatOf, convOfChat, convThread, convProject, announce, heraldShow, heraldFor, schedule,
  render: () => render(), go, PHONE, isBusy, sendWhileRunning, noun, IQ, sessionOf, running, projects, projectIcon,
  lrefRender: () => lrefRender(), stopRun, VW, SHAPE,
});
const { heraldBox, heraldRender, heraldRoom, undoNotice } = createNoticeLine({
  notice: notices.current, world, MK, composerNow, panelHost: () => TP.box, connDest, placeRegion: () => placeRegion(), STOP_ICON,
});
bindChatButtons({
  scope: appScope, target: $("#target"), permissions: $("#cs-perm"), sendNow: $("#send-now"), intelligence: $("#iq"),
  updateComposer, aim: () => mentions.aim(MK), toggleIntelligence: (view, chip) => toggleIq(sessionOf(view), chip),
});

const { TP, drawThreadPage, module: threadPageModule } = createThreadPageModule({
  STAGE, threadControls, world, D, createDock, dockDeps, wireComposer, wireTray, go, closeAtCaret: mentions.closeAtCaret, closeThreadMenu: (opts) => closeThreadMenu(opts), addFiles, toggleIq, sessionOf, convProject, heraldRoom,
  toastLine, loadAhead: (C) => loadAhead(C), returnPill: (destination) => returnPill(destination), saveDraft, loadDraft, convThread,
  stOf, glyphOf, isHeld, wordOf, rtTag, threadMenuHtml, checklistRender, drawConv: (C, needs) => drawConv(C, needs), updateComposer, sendRender, targetLineRender,
});
kernel.register(threadPageModule);
const { showMsg } = createConversationNavigation(appScope, { alias: localMessages.alias, main: () => MAIN });
const openFromPanel = createPanelThreadOpener({ view: navigationState.view, world, STAGE, TP, go, showMsg });

const { MAIN, scroller, msgsEl, loadAhead, loadOlderNow, reading } = mountMainViewport(appScope, {
  view: currentView, takeFoldChange: transcriptFolds.takeChange, heraldRoom, CH, world, convThread, chatOf, render: () => render(),
});
const placeRegion = () => pageEl(currentView()) || scroller;

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
  CHG, msgItems, ...reading, ensureRoot, liveReady, typingRender,
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
appScope.effect(() => menuKeys($("#top"), { close: () => closeThreadMenu() }));
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
appScope.effect(() => mountPressRoutes(kernel.places, "xo.conversation", transcriptActions({
  convAt, loadOlderNow, transcriptFolds, schedule, convThread, toggleChecklist, checklistRender,
  needs: D.needItems, requestFocus: redrawFocus.request, heraldBox, interruptRun,
})));
appScope.effect(() => mountPressRoutes(kernel.places, "xo.shell", {
  navigate: createNavigationLinks({ go, showMsg, openFromPanel, thread: world.thread, heraldShow }),
  next: valuePress("data-next", () => openNext(), true),
  create: valuePress("data-create", () => CREATE.open(), true), shell: valuePress("data-shell", (id) => openShell(id), true),
  "record-undo": valuePress("data-rec-undo", undoRecord),
  "notice-undo": valuePress("data-herald-undo", () => undoNotice({ requestFocus: redrawFocus.request, undo: notices.undo, undoRecord }), true),
  "chat-message": chatMessageAction, "thread-menu": threadMenuAction,
  media(target, event) { const el = target.closest("[data-mx]"); if (!(el instanceof HTMLElement)) return false; openMedia(el, event); return true; },
  copy: valuePress("data-copy", (_, el) => codeCopy.copy(el), true),
}));
bindConversationPress(appScope, kernel.places);
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
const { keys, openKeys, closeKeys } = createShortcutsSheet(appScope, focusOverlay, () => syncInert(), schedule);

// ── settings: a page over the main area; closing it returns exactly where you were ──
const setEl = $("#settings");
kernel.register(applicationShape.module);
kernel.register(createAppServices({ world, announce, projectName: (id) => id ? PROJ(id) : "", currentView }, schedule));
// Settings › Shape and the page's own reading of the shape (density, work, rail)
const SV = createShapeView({ shape: SHAPE, announce });
const shapeApply = createShapeApply({ view: currentView, SV, SHAPE, setWorkMode, convThread, world, loadChatHops, SH, STAGE, schedule });
appScope.effect(() => SHAPE.onChange(() => shapeApply()));
shapeApply({ boot: true });
const settings = createSettingsModule({
  el: setEl, side: $("#set-side"), phoneButton: $("#set-phone"), closeButton: $("#set-x"), phone: PHONE,
  focusIn: focusOverlay, fallback: () => say,
  at: () => { const view = currentView(); return { project: view.startsWith("p:") ? view.slice(2) : convThread(view)?.project }; },
  preferences: { THEME, webPictures: WEBPICS },
  mountRuntimes: (runtimeHost) => createRuntimeSettings({ world, announce, ...runtimeHost }), shape: SV,
  beforeOpen: () => { setDrawer(false); if (D.isOpen()) D.close(); IQ.close({ restore: false }); },
  onHidden: () => syncInert(),
});
const changesModule = createChangesModule(CHG, {
  conversationAt: convAt, showChange: STAGE.showChange, openFile: VW.open, focusAfterDraw: redrawFocus.request,
});
const leafModules = [sinceModule, artifacts.module, runs.module, settings.module, MAP.module, changesModule, filesModule];
for (const module of [...leafModules, routingModule, rulesModule, worktreesModule]) kernel.register(module);
function openSettings() { settings.open(); }
/** @param {Parameters<typeof settings.close>[0]} [options] */
function closeSettings(options) { settings.close(options); }

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

bindPanelHeaderControls(appScope, STAGE, LW, currentView);

const syncInert = mountShellInteractions(appScope, kernel.layers, {
  PHONE, navigationState, capturing: settings.capturing, SH, jump, IQ, CREATE, keys, FP, QO, back, go, JUMP,
  composerNow, toggleIq, sessionOf, openKeys, STAGE, SIDE, runsLayer: runs.layer, closeKeys, LB, setEl, closeSettings,
  VW, setDrawer, D, CH, PAGE_OF, world, updateComposer, say, toastLine, wordsOf, scroller,
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
  codeCopy.dispose, SIDE.dispose,
  CH.dispose, IQ.dispose, GH.dispose,
  threadDelete.dispose, threadEditing.dispose, stopRegionRings, stopFocusInView, notices.dispose,
  disposeRecordLines,
  SH.dispose, disposeShellPanel, () => { void kernel.disable(threadPageModule.manifest.id); }, disposeConversationStops,
  STAGE.disposeLayout, LPP.dispose, LW.dispose,
]) appScope.effect(() => dispose);
appScope.listen(window, "pagehide", (event) => {
  kernel.bus.emit("app:pagehide");
  if ("persisted" in event && event.persisted) return;
  appScope.dispose();
});
await kernel.start();
appScope.effect(() => startShell({ THEME, applyTheme, SIDE, PHONE, setDrawer, render, world, schedule, follow, loadDraft }));
