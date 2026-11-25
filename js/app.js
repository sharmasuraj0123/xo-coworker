// @ts-check
import { bindConversationPress } from "../shell/conversation-press.js";
import { mountConversationMedia, mountConversationHeader, mountNoticeLine } from "../modules/conversation/surfaces.js";
import "../core/ui/components/xo-select.js";
import { mountDecisionDock } from "../modules/decisions/dock-surface.js";
import * as Kit from "../modules/decisions/kit.js";
import { createDecisionSurface } from "../modules/decisions/surface.js";
import { createIntelSurface } from "../modules/chats/intel-surface.js";
import { $ } from "../core/platform/dom.js";
import { dockAtTop } from "../modules/conversation/dock-layout.js";
import { PAGE_OF, pageEl, sessionOf, convOfChat } from "../shell/place-context.js";
import { stepLineHtml, turnHtml, turnAv, setWorkMode } from "../modules/conversation/blocks/turn.js";
import { mountConversationMarkdown, WEBPICS } from "../modules/conversation/markdown.js";
import { createRunsModule } from "../modules/runs/module.js";
import { mountApplicationSettings } from "../modules/settings/application.js";
import { routingModule } from "../modules/routing/module.js";
import { rulesModule } from "../modules/rules/module.js";
import { worktreesModule } from "../modules/worktrees/module.js";
import { createRuntimeSettings } from "../modules/runtimes/settings.js";
import { createChatSurface } from "../modules/chats/surface.js";
import { mountMainViewport } from "../modules/conversation/main-viewport.js";
import { mountRunControls } from "../modules/conversation/run-controls.js";
import { createTranscriptFolds } from "../modules/conversation/transcript-folds.js";
import { createLocalMessages } from "../modules/conversation/local-messages.js";
import { createThreadPageModule } from "../modules/conversation/thread-page-module.js";
import { createTranscriptModule } from "../modules/conversation/transcript-module.js";
import { createChecklistRenderer } from "../modules/conversation/checklist.js";
import { createComposerSurface } from "../modules/conversation/composer-surface.js";
import { createMessageContext } from "../modules/conversation/message-context.js";
import { askShort } from "../modules/decisions/ask-label.js";
import { createFilesModule } from "../modules/files/module.js";
import { createMapModule } from "../modules/map/module.js";
import { mountWorkspaceStage } from "../shell/panel/workspace-stage.js";
import { createSide } from "../shell/rail/side.js";
import { kernel } from "../shell/kernel.js";
import { createWorkspaceHeader } from "../shell/workspace-header.js";
import { mountShellInteractions } from "../shell/interactions.js";
import { createNavigation } from "../shell/navigation.js";
import { createEdgeCards } from "../shell/edge-cards.js";
import { createShellRenderer } from "../shell/render.js";
import { createShellFoundation } from "../shell/foundation.js";
import { bootShell } from "../shell/boot.js";
import { createLaunchpadSurface } from "../modules/launchpad/surface.js";
import { createFileRoute } from "../modules/files/conversation-files.js";
import { fileScope, localIn } from "../modules/files/scope.js";
import { filePlace } from "../modules/files/search-place.js";
import { createFileSearch } from "../modules/search/file-search.js";
import { createJumpModule } from "../modules/search/jump-module.js";
import { changeDataModule } from "../modules/changes/data.js";
import { setTheme } from "../modules/changes/diffview.js";
import { lineRef, fileRef } from "../modules/changes/store.js";
import { createThreadGroups } from "../modules/threads/groups.js";
import { threadPresentation, threadPresentationModule } from "../modules/threads/presentation.js";
import { createThreadMenu } from "../modules/threads/menu.js";
import { createThreadActions } from "../modules/threads/action-surface.js";
import { createPanelThreadOpener } from "../modules/threads/open-panel-thread.js";
import { mountGithubPage } from "../modules/github/surface.js";
import { createFileQuestion } from "../modules/conversation/file-question.js";
import { createChangesModule } from "../modules/changes/module.js";
import { createProjectModule } from "../modules/create-project/module.js";
import { mountProjectIcons } from "../modules/projects/surface.js";
import { mountShells } from "../modules/shells/surface.js";
import { createArtifactsModule } from "../modules/artifacts/module.js";
import { sinceModule } from "../modules/since/module.js";
import { createHomeModule } from "../modules/home/module.js";
import { skTile, bar as skBar, rememberedMade } from "../modules/home/skeleton.js";
import { wordsOf } from "../modules/conversation/words.js";
import { createThreadRuntime } from "../modules/runtimes/thread.js";
import { SHAPE_IC } from "../modules/settings/index.js";
import { createSideRows } from "../shell/rail/rows.js";
import { createTheme, wireThemeToggle } from "../core/ui/theme.js";
/** @import { DecisionNeed } from "../modules/decisions/controller-types.d.ts" */
/** @import { WorldThread } from "../core/services/world/state-types.d.ts" */
/** @import { Conversation } from "../modules/conversation/draw-types.d.ts" */

const { appScope, world, schedule, notices, announce, applicationShape, navigationState, place, services, PHONE, redrawFocus,
  toastLine, focusOverlay, setDrawer } = createShellFoundation(render, () => syncInert());
const SHAPE = applicationShape.shape;
const noun = mountConversationMarkdown(appScope, SHAPE, (path) => fileRoute(path));

const { PROJ, projects, convThread, convProject, atOf } = place;
const { convHost } = createMessageContext({ world, PROJ });

const { THEME, applyTheme } = createTheme(appScope, setTheme);

const threadActions = createThreadActions({
  notice: () => ({ movedHere: IQ.movedHere, waitSince }), notices, go, render, schedule, requestFocus: redrawFocus.request, composerAt: (element) => composerAt(element),
  closePage: () => STAGE.closePage("thread"), showThread: (id, input) => STAGE.show("thread", id, { focus: true, input }),
  openOtherRuntime: () => openAlternate(sessionOf(currentView()), $("#iq")),
});
const threadControls = threadActions.controls;
const currentView = navigationState.view;

const localMessages = createLocalMessages();
const transcriptFolds = createTranscriptFolds();
const { show: heraldShow, forMsg: heraldFor } = notices;

const edgeCards = createEdgeCards(() => D, () => VW);
const { glyphOf, isBusy, isHeld, stOf, wordOf } = threadPresentation;
const { decisions: D, pings, waitSince, module: decisionModel } = createDecisionSurface({
  world, PROJ, announce, view: currentView, bus: kernel.bus, scope: appScope, showNotice: heraldShow,
  conversationOf: (project) => convOfChat(project), go,
  onShown: edgeCards.decisionOpened, onGone: edgeCards.decisionClosed,
  render: () => schedule(),
  back: (targets) => redrawFocus.back(targets, placeRegion, schedule),
});
const { intelligence: IQ, toggle: toggleIq, openAlternate, activate: activateIntel, undoRecord } = createIntelSurface({
  world, PROJ, announce, composers: () => composers(), redrawChip: (composer) => chipRender(false, composer),
  openThread: (id) => go(`t:${id}`, { focus: true }),
  simple: () => SHAPE.opts("xo:composer/intel").mode === "simple",
  scope: appScope, places: kernel.places, records: { view: currentView, localMessages, announce, schedule, heraldShow, placeRegion: () => placeRegion(),
    dismissRecord: (id) => notices.dismiss((notice) => notice.undo === id) },
});

const { chats: CH, module: chatControls } = createChatSurface({
  world, announce, transcriptOpen: transcriptFolds.open, heraldShow, go, schedule, view: currentView, phone: PHONE,
  composer: () => say, putBack: (text) => putBack(text), stop: (target) => stopRun(convAt(target).view),
  retryBlock: () => liveBlock(), refuse: (block, detail) => refuse(block, detail), aim: () => mentions.aim(MK),
  updateComposer: () => updateComposer(), toggleIntelligence: (view, chip) => toggleIq(sessionOf(view), chip),
}, { turnHtml, turnAv });
const files = createFilesModule({
  schedule, region: () => placeRegion(), opened: edgeCards.fileOpened, closed: edgeCards.fileClosed,
  ask: { target: (f) => askPlace(f)?.name || null, send: (f, a, b, text) => askAboutLines(f, a, b, text),
    compose: (f, a, b) => composeAbout(f, a, b), file: (f) => askAboutFile(f) },
  tree: () => ({ isBusy, go, paths: PATHS }),
  stage: () => STAGE, convAt: (button) => convAt(button),
});
const { module: filesModule, viewer: VW, tree: FILES, page: FP } = files;
const { paths: PATHS, quickOpen: QO } = createFileSearch(appScope, files, {
  place: () => filePlace(currentView(), { thread: world.thread, project: PROJ }), announce, syncInert: () => syncInert(),
});
const LB = mountConversationMedia(appScope, kernel.places, VW, announce);
const { SH, mountPanel } = mountShells(appScope, { applicationShape, places: kernel.places, view: currentView, world, PROJ, announce, heraldShow, onChange: schedule });
const artifacts = createArtifactsModule({ go, VW, skTile, skBar, rememberedMade });

const wsHeadRender = createWorkspaceHeader(currentView, projects);
const { PICK, projectIcon } = mountProjectIcons(appScope, { world, SHAPE, PROJ, announce, render: () => render() });
const MAP = createMapModule({ go: (v) => go(v, { panel: true }), isBusy, openFile: (f, from) => VW.open(f, from), stepLineHtml });
const { panelThreads, threadCounts } = createThreadGroups({
  world, D, MAP, convProject, askShort, threadMark: (t) => threadMark(t), isBusy, isHeld,
});
const { LP, LW, LPP, lpProject, dispose: disposeLaunchpad } = createLaunchpadSurface({
  world, isBusy, isHeld, PROJ, projectIcon, projects, go, announce, schedule, notices,
});
const STAGE = mountWorkspaceStage(appScope, {
  files: FILES, openFiles: () => FP.show({ focus: true }),
  github: { show: () => GH.show(), leave: () => GH.leave(), has: (view) => GH.has(view) },
  viewer: VW, view: currentView, go: (v, e) => openFromPanel(v, e), announce, onChange: schedule,
  threads: (v) => panelThreads(v),
  shell: (on, host, where) => panelShell(on, host, where), owns: (e) => SH.owns(e), places: kernel.places,
}, { place, shape: SHAPE, launch: LW });
const GH = mountGithubPage(appScope, { stage: STAGE, view: currentView, projectOf: lpProject, announce }, go, (text) => insertText(text, MK));
const { agentOf, threadMark, rtTag, sendWhileRunning, movable } = createThreadRuntime({ world, SHAPE, isHeld });
const threadMenuHtml = createThreadMenu({ panelThreads, SH, movable, isBusy });

const sideRender = createSideRows({
  view: currentView, world, CH, REC: { artifacts }, D, projects, convThread, isBusy, isHeld, askShort, projectIcon, folded: () => SIDE.folded,
});

const chatOf = convProject;
const { homeParts, homeRender, module: homeModule } = createHomeModule({
  threadMark, noun, kernel, heraldShow, SV: { homeOrder: (body) => SV.homeOrder(body) }, decideKey: (key) => decideKey(key),
});

/** @type {ReturnType<typeof createRunsModule>["working"]} */
const workingRuns = (thread) => runs.working(thread);
const { stopsHerald, stopRun, interruptRun, isStopping, pendingStops, running } = mountRunControls(appScope, {
  world, Kit, PROJ, announce, schedule, chatOf, heraldShow, workingRuns, view: currentView, CH, convThread,
  inUse: (selector) => inUse(selector),
  dismissStops: () => notices.dismiss((notice) => notice.tag === "stops"),
});
const runs = createRunsModule({
  stage: STAGE, shape: SHAPE, transcript: transcriptFolds, pendingStops, stopsHerald, heraldShow, commitMs: Kit.COMMIT_MS,
  placeRegion: () => placeRegion(), threadScroller: () => TP.C?.scroller,
  headFor: (opener) => convAt(opener) === MAIN ? $("#thead") : $("#tpthead"),
  threadAt: (opener) => convThread(convAt(opener).view),
});
const { render: checklistRender, toggle: toggleChecklist } = createChecklistRenderer({
  view: currentView, scope: appScope, SHAPE, convThread, places: kernel.places, schedule,
});

const { main: MDOCK, decideKey, limitStatus, createDock, deps: dockDeps } = mountDecisionDock({
  CH, D, bus: kernel.bus, places: kernel.places, scope: appScope, world, convThread, convHost, schedule, view: currentView, region: () => placeRegion(), announce,
});
const dockRender = MDOCK.render;


const { MK, say, composerAt, composerNow, composers, inUse, saveDraft, loadDraft, startHtml, addFiles, insertText, wireTray,
    fileReferences, liveBlock, blockFor, refuse, connDest, deliverLive, putBack, targetLineRender,
    syncPlaceholder, chipRender, sendRender, chatTargetRender, mentions, wireComposer, updateComposer } = createComposerSurface(appScope, {
  places: kernel.places, view: currentView, main: () => MAIN, panel: () => TP.K && TP.box ? { composer: TP.K, host: TP.box } : null,
  localMessages, world, CH, STAGE, PROJ, chatOf, convOfChat, convThread, convProject, announce, heraldShow, heraldFor, schedule,
  render: () => render(), go, PHONE, isBusy, sendWhileRunning, noun, IQ, sessionOf, running, projects, projectIcon,
  lrefRender: () => lrefRender(), stopRun, VW, SHAPE,
});
const { heraldBox, heraldRender, heraldRoom } = mountNoticeLine(appScope, kernel.places, {
  notice: notices.current, world, MK, composerNow, panelHost: () => TP.box, connDest, placeRegion: () => placeRegion(),
}, { requestFocus: redrawFocus.request, undo: notices.undo, undoRecord });

const { TP, drawThreadPage, module: threadPageModule } = createThreadPageModule({
  STAGE, threadControls, world, D, createDock, dockDeps, wireComposer, wireTray, go, closeAtCaret: mentions.closeAtCaret, closeThreadMenu: threadActions.closeMenu, addFiles, toggleIq, sessionOf, convProject, heraldRoom,
  toastLine, loadAhead: (C) => loadAhead(C), returnPill: (destination) => returnPill(destination), saveDraft, loadDraft, convThread,
  stOf, glyphOf, isHeld, wordOf, rtTag, threadMenuHtml, checklistRender, drawConv: (C, needs) => drawConv(C, needs), updateComposer, sendRender, targetLineRender,
});

const { MAIN, scroller, msgsEl, loadAhead, loadOlderNow, reading, returnPill, showMsg, placeRegion, liveReady, follow, loadChatHops, ensureRoot } = mountMainViewport(appScope, {
  view: currentView, alias: localMessages.alias, takeFoldChange: transcriptFolds.takeChange, heraldRoom, CH, world, convThread, chatOf, render: () => render(),
});
const openFromPanel = createPanelThreadOpener({ view: currentView, world, STAGE, TP, go, showMsg });
const { drawConv, drawingView, module: transcriptModule } = createTranscriptModule({
  REC: artifacts, threadMark, noun, sendWhileRunning, running, workingRuns, agentOf, isStopping, localMessages, limitStatus, CH, STAGE,
  transcriptOpen: transcriptFolds.open, youText: (text) => youText(text), startHtml, fileRoute: (path, conv) => fileRoute(path, conv),
  reading, ensureRoot, liveReady, actions: () => ({ convAt, loadOlderNow, transcriptFolds, schedule, toggleChecklist, checklistRender,
    requestFocus: redrawFocus.request, heraldBox, interruptRun }),
});
const { go: navigate, back } = createNavigation({
  location: navigationState, VW, STAGE, IQ, PHONE, bus: kernel.bus, say, scroller, closeSettings, setDrawer: (open) => setDrawer(open),
  clearDock: () => MDOCK.reset({ restoreFocus: false }),
  clearThreadEdit: threadControls.clear,
  saveDraft, follow, pageEl, loadDraft, render: () => render(), returnPill, convThread,
});
/** @param {string} v @param {import("../shell/navigation-types.d.ts").NavigationOptions} [options] */
function go(v, options) { return navigate(v, options); }

const { youText, askPlace, askAboutLines, composeAbout, askAboutFile, lrefRender } = createFileQuestion({
  view: currentView, localMessages, fileReferences, world, PROJ, convOfChat, CH, say, VW, STAGE, go, announce, heraldShow, schedule, blockFor, refuse, deliverLive,
  fileScope, localIn, lineRef, fileRef,
});

/** The conversation containing a control, or the main chat. */
const convAt = (/** @type {Node | null} */ el) => (TP.box?.contains(el) && TP.C ? TP.C : MAIN);
const fileRoute = createFileRoute({ currentView: () => drawingView() || currentView(), convThread });
bindConversationPress(appScope, kernel.places, announce, { go, showMsg, openFromPanel, thread: world.thread, heraldShow });
const topRender = mountConversationHeader({
  ...place, ...threadPresentation, threadControls, description: (project) => CREATE.descriptions.get(project), world, PICK, LP, LW, STAGE, kernel,
  convHost, homeParts, threadCounts, projectIcon, threadMenuHtml, rtTag, location: navigationState, CH, checklistRender, tdelRender: threadActions.renderDelete,
}, appScope, schedule);
const panelShell = mountPanel(STAGE);

const CREATE = createProjectModule({ phone: PHONE, go, heraldShow, setDrawer, welcome: localMessages.welcome });

const JUMP = createJumpModule({
  projectIcon, create: CREATE.open, settings: () => settings.open(), keys: () => openKeys(), IQ, toggleStage: () => STAGE.toggle(),
  go, focusIn: focusOverlay, onHidden: () => syncInert(),
});
const jump = JUMP.el;

const { SV, settings, setEl, keys, openKeys, closeKeys } = mountApplicationSettings(appScope, {
  shape: SHAPE, announce, view: currentView, convThread, world, setWorkMode, loadChatHops, SH, STAGE, schedule,
}, {
  phone: PHONE, focusIn: focusOverlay, fallback: () => say, at: () => atOf(currentView()),
  preferences: { THEME, webPictures: WEBPICS }, mountRuntimes: (host) => createRuntimeSettings({ world, announce, ...host }),
  beforeOpen: () => { setDrawer(false); if (D.isOpen()) D.close(); IQ.close({ restore: false }); }, onHidden: () => syncInert(),
});
const changesModule = createChangesModule({
  conversationAt: convAt, showChange: STAGE.showChange, openFile: VW.open, focusAfterDraw: redrawFocus.request,
});
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

const SIDE = createSide({ shape: SHAPE, announce, render, toggleJump: () => (jump.hidden ? JUMP.open() : JUMP.close()) });

const syncInert = mountShellInteractions(appScope, kernel.layers, {
  PHONE, navigationState, capturing: settings.capturing, SH, jump, IQ, CREATE, keys, FP, QO, back, go, JUMP,
  composerNow, toggleIq, sessionOf, openKeys, STAGE, SIDE, runsLayer: runs.layer, closeKeys, LB, setEl, closeSettings,
  VW, setDrawer, D, CH, PAGE_OF, world, updateComposer, say, toastLine, wordsOf, scroller,
});

await bootShell(appScope, [
  threadPageModule, applicationShape.module, services, changeDataModule, decisionModel, threadPresentationModule, transcriptModule,
  homeModule, JUMP.module, sinceModule, artifacts.module, runs.module, settings.module,
  MAP.module, changesModule, filesModule, threadActions.module, CREATE.module, chatControls, routingModule, rulesModule, worktreesModule,
], { shapeIcon: SHAPE_IC, dispose: [SIDE.dispose, CH.dispose, disposeLaunchpad], THEME, applyTheme, SIDE, PHONE, setDrawer, render, world, schedule, follow, loadDraft });
