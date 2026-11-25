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
import { turnHtml, turnAv, setWorkMode } from "../modules/conversation/blocks/turn.js";
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
import { createConversationSession } from "../modules/conversation/session.js";
import { createThreadPageModule } from "../modules/conversation/thread-page-module.js";
import { createTranscriptModule } from "../modules/conversation/transcript-module.js";
import { createChecklistRenderer } from "../modules/conversation/checklist.js";
import { createComposerSurface } from "../modules/conversation/composer-surface.js";
import { createMessageContext } from "../modules/conversation/message-context.js";
import { askShort } from "../modules/decisions/ask-label.js";
import { createFilesModule } from "../modules/files/module.js";
import { mapModule } from "../modules/map/module.js";
import { mapFrameAt } from "../shell/panel/frame-bindings.js";
import { mountWorkspaceStage } from "../shell/panel/workspace-stage.js";
import { createSide } from "../shell/rail/side.js";
import { kernel } from "../shell/kernel.js";
import { createWorkspaceHeader } from "../shell/workspace-header.js";
import { mountShellInteractions } from "../shell/interactions.js";
import { createNavigation } from "../shell/navigation.js";
import { edgeCardsModule } from "../shell/edge-cards.js";
import { createShellRenderer } from "../shell/render.js";
import { createShellFoundation } from "../shell/foundation.js";
import { bootShell } from "../shell/boot.js";
import { failureModule } from "../shell/failures.js";
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
import { changesModule } from "../modules/changes/module.js";
import { createProjectModule } from "../modules/create-project/module.js";
import { mountProjectIcons } from "../modules/projects/surface.js";
import { mountShells } from "../modules/shells/surface.js";
import { artifactsModule } from "../modules/artifacts/module.js";
import { sinceModule } from "../modules/since/module.js";
import { createHomeModule, homeSkeletonModule } from "../modules/home/module.js";
import { wordsOf } from "../modules/conversation/words.js";
import { createThreadRuntime } from "../modules/runtimes/thread.js";
import { SHAPE_IC } from "../modules/settings/index.js";
import { createSideRows } from "../shell/rail/rows.js";
import { createTheme, wireThemeToggle } from "../core/ui/theme.js";
/** @import { DecisionNeed } from "../modules/decisions/controller-types.d.ts" */
/** @import { WorldThread } from "../core/services/world/state-types.d.ts" */
/** @import { Conversation } from "../modules/conversation/draw-types.d.ts" */

const { appScope, world, schedule, notices, shellServices, announce, applicationShape, navigationState, place, services, PHONE, redrawFocus,
  render, syncInert, toastLine, focusOverlay, setDrawer } = createShellFoundation(kernel.bus);
const SHAPE = applicationShape.shape;
const noun = mountConversationMarkdown(appScope, SHAPE, (path) => fileRoute(path));

const { PROJ, projects, convThread, convProject, atOf } = place;
const currentView = navigationState.view;
const { session, module: sessionModule } = createConversationSession(currentView, kernel.places, schedule);
const { main: MAIN, localMessages, folds: transcriptFolds, region: placeRegion, conversationAt: convAt } = session;
const { composer: MK, focus: { composerNow, composers, inUse } } = session;
const { say } = MK;
const { convHost } = createMessageContext({ world, PROJ });

const { THEME, applyTheme } = createTheme(appScope, setTheme);

const threadActions = createThreadActions();
const threadControls = threadActions.controls;
const { show: heraldShow, forMsg: heraldFor } = notices;

const { glyphOf, isBusy, isHeld, stOf, wordOf } = threadPresentation;
const { decisions: D, pings, module: decisionModel } = createDecisionSurface({
  world, PROJ, announce, view: currentView, bus: kernel.bus, scope: appScope, showNotice: heraldShow,
  conversationOf: (project) => convOfChat(project), go,
  render: () => schedule(),
  back: (targets) => redrawFocus.back(targets, placeRegion, schedule),
});
const { intelligence: IQ, toggle: toggleIq, activate: activateIntel, undoRecord, module: intelModule } = createIntelSurface({
  world, PROJ, announce, composers, redrawChip: (composer) => chipRender(false, composer),
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
  ask: { target: (f) => askPlace(f)?.name || null, send: (f, a, b, text) => askAboutLines(f, a, b, text),
    compose: (f, a, b) => composeAbout(f, a, b), file: (f) => askAboutFile(f) },
  paths: () => PATHS,
});
const { module: filesModule, viewer: VW, tree: FILES, page: FP } = files;
const { paths: PATHS, quickOpen: QO } = createFileSearch(appScope, files, {
  place: () => filePlace(currentView(), { thread: world.thread, project: PROJ }), announce, syncInert: () => syncInert(),
});
const LB = mountConversationMedia(appScope, kernel.places, VW, announce);
const { SH, mountPanel } = mountShells(appScope, { applicationShape, places: kernel.places, view: currentView, world, PROJ, announce, heraldShow, onChange: schedule });

const wsHeadRender = createWorkspaceHeader(currentView, projects);
const { PICK, projectIcon } = mountProjectIcons(appScope, { world, SHAPE, PROJ, announce, render: () => render() });
const { panelThreads, threadCounts } = createThreadGroups({
  world, D, MAP: { agents: (view) => mapFrameAt(kernel.places)?.api.agents(view) ?? [] }, convProject, askShort,
  threadMark: (t) => threadMark(t), isBusy, isHeld,
});
const { LP, LW, LPP, lpProject, dispose: disposeLaunchpad } = createLaunchpadSurface({
  world, isBusy, isHeld, PROJ, projectIcon, projects, go, announce, schedule, notices,
});
const { stage: STAGE, module: stageModule } = mountWorkspaceStage(appScope, {
  files: FILES, openFiles: () => FP.show({ focus: true }),
  github: { show: () => GH.show(), leave: () => GH.leave(), has: (view) => GH.has(view) },
  viewer: VW, view: currentView, go: (v, e) => openFromPanel(v, e), announce, onChange: schedule,
  threads: (v) => panelThreads(v),
  shell: (on, host, where) => panelShell(on, host, where), owns: (e) => SH.owns(e), places: kernel.places,
}, { place, shape: SHAPE, launch: LW });
const GH = mountGithubPage(appScope, { stage: STAGE, view: currentView, projectOf: lpProject, announce }, go, (text) => insertText(text, MK));
const { agentOf, threadMark, rtTag, sendWhileRunning, movable } = createThreadRuntime({ world, SHAPE, isHeld });
const threadMenuHtml = createThreadMenu({ panelThreads, SH, movable, isBusy });

const sideRender = createSideRows(appScope, {
  view: currentView, world, CH, places: kernel.places, D, projects, convThread, isBusy, isHeld, askShort, projectIcon, folded: () => SIDE.folded,
});

const chatOf = convProject;
const { homeParts, homeRender, module: homeModule } = createHomeModule({
  threadMark, noun, kernel, heraldShow, SV: { homeOrder: (body) => SV.homeOrder(body) }, decideKey: (key) => decideKey(key),
});

/** @type {ReturnType<typeof createRunsModule>["working"]} */
const workingRuns = (thread) => runs.working(thread);
const { stopsHerald, stopRun, interruptRun, isStopping, pendingStops, running } = mountRunControls(appScope, {
  world, Kit, PROJ, announce, schedule, chatOf, heraldShow, workingRuns, view: currentView, CH, convThread,
  inUse,
  dismissStops: () => notices.dismiss((notice) => notice.tag === "stops"),
});
const runs = createRunsModule({
  stage: STAGE, shape: SHAPE, transcript: transcriptFolds, pendingStops, stopsHerald, heraldShow, commitMs: Kit.COMMIT_MS,
  placeRegion, threadScroller: () => session.panel()?.C?.scroller,
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


const { saveDraft, loadDraft, startHtml, addFiles, insertText, wireTray,
    fileReferences, lrefRender, liveBlock, blockFor, refuse, connDest, deliverLive, putBack, targetLineRender,
    syncPlaceholder, chipRender, sendRender, chatTargetRender, mentions, wireComposer, updateComposer } = createComposerSurface(appScope, {
  places: kernel.places, view: currentView, session,
  localMessages, world, CH, STAGE, PROJ, chatOf, convOfChat, convThread, convProject, announce, heraldShow, heraldFor, schedule,
  render: () => render(), go, PHONE, isBusy, sendWhileRunning, noun, IQ, sessionOf, running, projects, projectIcon,
  stopRun, VW, SHAPE,
});
const { heraldBox, heraldRender, heraldRoom } = mountNoticeLine(appScope, kernel.places, {
  notice: notices.current, world, MK, composerNow, panelHost: () => session.panel()?.box ?? null, connDest, placeRegion,
}, { requestFocus: redrawFocus.request, undo: notices.undo, undoRecord });

const { TP, drawThreadPage, module: threadPageModule } = createThreadPageModule({
  STAGE, threadControls, world, D, createDock, dockDeps, wireComposer, wireTray, go, closeAtCaret: mentions.closeAtCaret, closeThreadMenu: threadActions.closeMenu, addFiles, toggleIq, sessionOf, convProject, heraldRoom,
  toastLine, loadAhead: (C) => loadAhead(C), returnPill: (destination) => returnPill(destination), saveDraft, loadDraft, convThread,
  stOf, glyphOf, isHeld, wordOf, rtTag, threadMenuHtml, checklistRender, drawConv: (C, needs) => drawConv(C, needs), updateComposer, sendRender, targetLineRender,
});

const { scroller, msgsEl, loadAhead, loadOlderNow, reading, returnPill, showMsg, liveReady, follow, loadChatHops, ensureRoot } = mountMainViewport(appScope, {
  main: MAIN,
  view: currentView, alias: localMessages.alias, takeFoldChange: transcriptFolds.takeChange, heraldRoom, CH, world, convThread, chatOf, render: () => render(),
});
const openFromPanel = createPanelThreadOpener({ view: currentView, world, STAGE, TP, go, showMsg });
const { drawConv, drawingView, module: transcriptModule } = createTranscriptModule({
  threadMark, noun, sendWhileRunning, running, workingRuns, agentOf, isStopping, localMessages, limitStatus, CH, STAGE,
  transcriptOpen: transcriptFolds.open, youText: (text) => youText(text), startHtml, fileRoute: (path, conv) => fileRoute(path, conv),
  reading, ensureRoot, liveReady, actions: () => ({ convAt, loadOlderNow, transcriptFolds, schedule, toggleChecklist, checklistRender,
    requestFocus: redrawFocus.request, heraldBox, interruptRun }),
});
const { back, module: navigationModule } = createNavigation({
  location: navigationState, VW, STAGE, IQ, PHONE, bus: kernel.bus, say, scroller, closeSettings, setDrawer: (open) => setDrawer(open),
  clearDock: () => MDOCK.reset({ restoreFocus: false }),
  clearThreadEdit: threadControls.clear,
  saveDraft, follow, pageEl, loadDraft, render: () => render(), returnPill, convThread,
});
/** @param {string} v @param {import("../shell/navigation-types.d.ts").NavigationOptions} [options] */
function go(v, options) { kernel.bus.emit("app:navigate", { view: v, options }); }

const { youText, askPlace, askAboutLines, composeAbout, askAboutFile } = createFileQuestion({
  view: currentView, localMessages, fileReferences, world, PROJ, convOfChat, CH, say, VW, STAGE, go, announce, heraldShow, schedule, blockFor, refuse, deliverLive,
  fileScope, localIn, lineRef, fileRef, lrefRender,
});

const fileRoute = createFileRoute({ currentView: () => drawingView() || currentView(), convThread });
bindConversationPress(appScope, kernel.places, announce, { go, showMsg, openFromPanel, thread: world.thread, heraldShow });
const topRender = mountConversationHeader({
  ...place, ...threadPresentation, threadControls, description: (project) => CREATE.descriptions.get(project), world, PICK, LP, LW, STAGE, kernel,
  convHost, homeParts, threadCounts, projectIcon, threadMenuHtml, rtTag, location: navigationState, CH, checklistRender, tdelRender: threadActions.renderDelete,
}, appScope, schedule);
const panelShell = mountPanel(STAGE);

const CREATE = createProjectModule();

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
/** @param {Parameters<typeof settings.close>[0]} [options] */
function closeSettings(options) { settings.close(options); }

wireThemeToggle(appScope, applyTheme, announce);

/** @type {Parameters<typeof createShellRenderer<DecisionNeed, WorldThread, Conversation>>[0]} */
const rendererOptions = {
  world, D, view: currentView, restoreFocus: redrawFocus.restore, PAGE_OF, MAIN,
  pings, dockAtTop, convThread, sideRender, homeRender, places: kernel.places, LPP,
  topRender, wsHeadRender, drawConv, say, msgsEl, placeRegion, loadAhead, TP, STAGE, drawThreadPage,
  dockRender, heraldRender, chatTargetRender, targetLineRender, syncPlaceholder, sendRender, chipRender,
  VW, LW, FP, titleFor: Kit.titleFor, isBusy,
};
const renderShell = createShellRenderer(rendererOptions, appScope, schedule);
appScope.effect(() => kernel.bus.on("app:paint", () => {
  renderShell();
  if (world.state.loaded) activateIntel(sessionOf);
}));

const SIDE = createSide({ shape: SHAPE, announce, render, toggleJump: () => (jump.hidden ? JUMP.open() : JUMP.close()) });

const applyInert = mountShellInteractions(appScope, kernel.layers, {
  PHONE, navigationState, capturing: settings.capturing, SH, jump, IQ, CREATE, keys, FP, QO, back, go, JUMP,
  composerNow, toggleIq, sessionOf, openKeys, STAGE, SIDE, runsLayer: runs.layer, closeKeys, LB, setEl, closeSettings,
  VW, setDrawer, D, CH, PAGE_OF, world, updateComposer, say, toastLine, wordsOf, scroller,
});
appScope.effect(() => kernel.bus.on("app:sync-inert", applyInert));

await bootShell(appScope, [
  shellServices, failureModule, navigationModule, sessionModule, stageModule, intelModule, edgeCardsModule,
  threadPageModule, applicationShape.module, services, changeDataModule, decisionModel, threadPresentationModule, transcriptModule,
  homeSkeletonModule, homeModule, JUMP.module, sinceModule, artifactsModule, runs.module, settings.module,
  mapModule, changesModule, filesModule, threadActions.module, CREATE.module, chatControls, routingModule, rulesModule, worktreesModule,
], { shapeIcon: SHAPE_IC, dispose: [SIDE.dispose, CH.dispose, disposeLaunchpad], THEME, applyTheme, SIDE, PHONE, setDrawer, render, world, schedule, follow, loadDraft });
