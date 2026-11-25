// @ts-check
import { conversationPresentationModule, checklistModule } from "../modules/conversation/presentation.js";
import { decisionDockModule, decisionModule } from "../modules/decisions/surface.js";
import { threadGroupsModule, threadPresentation, threadPresentationModule } from "../modules/threads/presentation.js";
import { navigationModule, shellFoundationModule } from "../shell/foundation.js";
import { bindConversationPress } from "../shell/conversation-press.js";
import { mountConversationMedia, mountConversationHeader, mountNoticeLine } from "../modules/conversation/surfaces.js";
import "../core/ui/components/xo-select.js";
import * as Kit from "../modules/decisions/kit.js";
import { intelModule } from "../modules/chats/intel-surface.js";
import { dockAtTop } from "../modules/conversation/dock-layout.js";
import { PAGE_OF, sessionOf, convOfChat } from "../shell/place-context.js";
import { runsModule } from "../modules/runs/module.js";
import { mountApplicationSettings } from "../modules/settings/application.js";
import { routingModule } from "../modules/routing/module.js";
import { rulesModule } from "../modules/rules/module.js";
import { worktreesModule } from "../modules/worktrees/module.js";
import { createRuntimeSettings } from "../modules/runtimes/settings.js";
import { chatModelModule, chatControlsModule } from "../modules/chats/surface.js";
import { mountMainViewport } from "../modules/conversation/main-viewport.js";
import { runControlsModule } from "../modules/conversation/run-controls.js";
import { conversationSessionModule } from "../modules/conversation/session.js";
import { createThreadPageModule } from "../modules/conversation/thread-page-module.js";
import { createTranscriptModule } from "../modules/conversation/transcript-module.js";
import { createComposerSurface } from "../modules/conversation/composer-surface.js";
import { messageContextModule } from "../modules/conversation/message-context.js";
import { askShort } from "../modules/decisions/ask-label.js";
import { createFilesModule } from "../modules/files/module.js";
import { mapAgentsModule, mapModule } from "../modules/map/module.js";
import { mountWorkspaceStage } from "../shell/panel/workspace-stage.js";
import { createSide } from "../shell/rail/side.js";
import { kernel, failureModule } from "../shell/kernel.js";
import { createWorkspaceHeader } from "../shell/workspace-header.js";
import { mountShellInteractions } from "../shell/interactions.js";
import { edgeCardsModule } from "../shell/edge-cards.js";
import { createShellRenderer } from "../shell/render.js";
import { appServicesModule } from "../shell/world.js";
import { shapeModule } from "../core/services/shape/module.js";
import { createScope } from "../core/kernel/scope.js";
import { PHONE } from "../core/platform/viewport.js";
import { startShell } from "../shell/start.js";
import { bootShell } from "../shell/boot.js";
import { launchpadModule } from "../modules/launchpad/surface.js";
import { filePlace } from "../modules/files/search-place.js";
import { createFileSearch } from "../modules/search/file-search.js";
import { createJumpModule } from "../modules/search/jump-module.js";
import { changeDataModule } from "../modules/changes/data.js";
import { setTheme } from "../modules/changes/diffview.js";
import { createThreadMenu } from "../modules/threads/menu.js";
import { createThreadActions } from "../modules/threads/action-surface.js";
import { createPanelThreadOpener } from "../modules/threads/open-panel-thread.js";
import { githubModule } from "../modules/github/surface.js";
import { createFileQuestion } from "../modules/conversation/file-question.js";
import { changesModule } from "../modules/changes/module.js";
import { createProjectModule } from "../modules/create-project/module.js";
import { projectIconsModule } from "../modules/projects/surface.js";
import { mountShells } from "../modules/shells/surface.js";
import { artifactsModule } from "../modules/artifacts/module.js";
import { sinceModule } from "../modules/since/module.js";
import { createHomeModule, homeSkeletonModule } from "../modules/home/module.js";
import { wordsOf } from "../modules/conversation/words.js";
import { threadRuntimeModule } from "../modules/runtimes/module.js";
import { SHAPE_IC } from "../modules/settings/index.js";
import { createSideRows } from "../shell/rail/rows.js";
import { createTheme, wireThemeToggle } from "../core/ui/theme.js";
/** @import { DecisionNeed } from "../modules/decisions/controller-types.d.ts" */
/** @import { WorldThread } from "../core/services/world/state-types.d.ts" */
/** @import { Conversation } from "../modules/conversation/draw-types.d.ts" */

/** @type {import("../core/kernel/types").ModuleDef} */
const workspaceModule = {
  manifest: { id: "xo.workspace", version: "1.0.0", kernel: "^1.1.0", core: true,
    needs: ["world", "notices", "announce", "shape", "navigationState", "placeContext", "redrawFocus", "drawer", "toastLine",
      "overlayFocus", "conversationSession", "terminalCapability", "navigation", "projectIcons", "threadRuntime", "decisionPresentation",
      "launchpad", "intelligence", "mapAgents",
      "conversationPresentation", "threadGroups", "checklist", "chats", "decisionDock", "messageContext", "runControls"], optional: ["runs"], provides: ["composer"] },
  activate(ctx) {
const appScope = createScope();
ctx.effect(() => appScope.dispose);
const phone = PHONE;
if (!phone) throw new Error("The application requires media queries.");
const world = ctx.use("world"), notices = ctx.use("notices"), announce = ctx.use("announce"), SHAPE = ctx.use("shape");
const navigationState = ctx.use("navigationState"), place = ctx.use("placeContext"), redrawFocus = ctx.use("redrawFocus");
const setDrawer = ctx.use("drawer").set, toastLine = ctx.use("toastLine"), focusOverlay = ctx.use("overlayFocus");
const render = () => ctx.emit("app:render"), syncInert = () => ctx.emit("app:sync-inert"), schedule = () => ctx.invalidate("workspace");
const session = ctx.use("conversationSession"), { go, back } = ctx.use("navigation");
const { PROJ, projects, convThread, convProject, atOf } = place;
const currentView = navigationState.view;
const { fileRoute, noun, setWorkMode, webPictures } = ctx.use("conversationPresentation");
const { main: MAIN, localMessages, folds: transcriptFolds, region: placeRegion, conversationAt: convAt } = session;
const { composer: MK, focus: { composerNow, composers } } = session;
const { say } = MK;
const { convHost } = ctx.use("messageContext");

const { THEME, applyTheme } = createTheme(appScope, setTheme);

const threadActions = createThreadActions();
const threadControls = threadActions.controls;
const { show: heraldShow, forMsg: heraldFor } = notices;

const { glyphOf, isBusy, isHeld, stOf, wordOf } = threadPresentation;
const { D, pings } = ctx.use("decisionPresentation");
const { intelligence: IQ, toggle: toggleIq, activate: activateIntel, undoRecord } = ctx.use("intelligence");

const CH = ctx.use("chats");
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
const { SH, mountPanel } = mountShells(appScope, { applicationShape: { shape: SHAPE, terminal: ctx.use("terminalCapability") }, places: kernel.places, view: currentView, world, PROJ, announce, heraldShow, onChange: schedule });

const wsHeadRender = createWorkspaceHeader(currentView, projects);
const { PICK, projectIcon } = ctx.use("projectIcons");
const { agentOf, threadMark, rtTag, sendWhileRunning, movable } = ctx.use("threadRuntime");
const { panelThreads, threadCounts } = ctx.use("threadGroups");
const { LP, LW, LPP } = ctx.use("launchpad");
const { stage: STAGE, module: stageModule } = mountWorkspaceStage(appScope, {
  files: FILES, openFiles: () => FP.show({ focus: true }),
  viewer: VW, view: currentView, go: (v, e) => openFromPanel(v, e), announce, onChange: schedule,
  agents: ctx.use("mapAgents").agents, threads: panelThreads,
  shell: (on, host, where) => panelShell(on, host, where), owns: (e) => SH.owns(e), places: kernel.places,
}, { place, shape: SHAPE, launch: LW });
const threadMenuHtml = createThreadMenu({ panelThreads, SH, movable, isBusy });

const sideRender = createSideRows(appScope, {
  view: currentView, world, CH, D, projects, convThread, isBusy, isHeld, askShort, projectIcon, folded: () => SIDE.folded,
});

const chatOf = convProject;
const { homeParts, homeRender, module: homeModule } = createHomeModule({
  threadMark, noun, kernel, heraldShow, SV: { homeOrder: (body) => SV.homeOrder(body) }, decideKey: (key) => decideKey(key),
});

const { workingRuns, stopRun, interruptRun, isStopping, running } = ctx.use("runControls");
const { render: checklistRender, toggle: toggleChecklist } = ctx.use("checklist");

const { main: MDOCK, decideKey, limitStatus, createDock, deps: dockDeps } = ctx.use("decisionDock");
const dockRender = MDOCK.render;


const composer = createComposerSurface(appScope, {
  places: kernel.places, view: currentView, session,
  localMessages, world, CH, STAGE, PROJ, chatOf, convOfChat, convThread, convProject, announce, heraldShow, heraldFor, schedule,
  render: () => render(), go, PHONE: phone, isBusy, sendWhileRunning, noun, IQ, sessionOf, running, projects, projectIcon,
  stopRun, VW, SHAPE,
});
ctx.provide("composer", composer);
ctx.effect(() => CH.attachRecovery(composer.putBack));
const { saveDraft, loadDraft, startHtml, addFiles, wireTray,
    fileReferences, lrefRender, blockFor, refuse, connDest, deliverLive, targetLineRender,
    syncPlaceholder, chipRender, sendRender, chatTargetRender, mentions, wireComposer, updateComposer } = composer;
ctx.on("app:intelligence-changed", () => { for (const input of composers()) chipRender(false, input); });
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
const { drawConv, module: transcriptModule } = createTranscriptModule({
  threadMark, noun, sendWhileRunning, running, workingRuns, agentOf, isStopping, localMessages, limitStatus, CH, STAGE,
  transcriptOpen: transcriptFolds.open, startHtml, fileRoute,
  reading, ensureRoot, liveReady, actions: () => ({ convAt, loadOlderNow, transcriptFolds, schedule, toggleChecklist, checklistRender,
    requestFocus: redrawFocus.request, heraldBox, interruptRun }),
});
ctx.effect(() => ctx.use("navigation").beforeLeave((resume) => {
  if (!VW.editing) return true;
  VW.leave(resume);
  return false;
}));
ctx.on("app:view-preparing", () => {
  threadControls.clear();
  closeSettings({ restore: false });
  setDrawer(false);
});
ctx.on("app:view-leaving", () => saveDraft());
ctx.on("app:view-visited", () => follow());
ctx.on("app:view-restoring", () => loadDraft());
ctx.on("app:return-target", returnPill);

const { askPlace, askAboutLines, composeAbout, askAboutFile } = createFileQuestion({
  view: currentView, localMessages, fileReferences, world, PROJ, convOfChat, CH, say, VW, STAGE, go, announce, heraldShow, schedule, blockFor, refuse, deliverLive,
  lrefRender,
});

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
  phone, focusIn: focusOverlay, fallback: () => say, at: () => atOf(currentView()),
  preferences: { THEME, webPictures }, mountRuntimes: (host) => createRuntimeSettings({ world, announce, ...host }),
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
appScope.effect(() => kernel.bus.on("app:render", () => {
  renderShell();
  if (world.state.loaded) activateIntel();
}));

const SIDE = createSide({ shape: SHAPE, announce, render, toggleJump: () => (jump.hidden ? JUMP.open() : JUMP.close()) });

const applyInert = mountShellInteractions(appScope, kernel.layers, {
  PHONE: phone, navigationState, capturing: settings.capturing, SH, jump, IQ, CREATE, keys, FP, QO, back, go, JUMP,
  composerNow, toggleIq, sessionOf, openKeys, STAGE, SIDE, runsLayer: { id: "runs", open: () => ctx.optional("runs")?.isOpen() ?? false, close: () => ctx.optional("runs")?.back() }, closeKeys, LB, setEl, closeSettings,
  VW, setDrawer, D, CH, PAGE_OF, world, updateComposer, say, toastLine, wordsOf, scroller,
});
appScope.effect(() => kernel.bus.on("app:sync-inert", applyInert));

for (const module of [
  stageModule, threadPageModule, transcriptModule, homeModule, JUMP.module,
  settings.module, filesModule, threadActions.module, CREATE.module,
]) kernel.register(module);
appScope.effect(() => SIDE.dispose);
ctx.on("app:started", () => appScope.effect(() => startShell({
  THEME, applyTheme, SIDE, PHONE: phone, setDrawer, render, world, schedule, follow, loadDraft,
})));
  },
};

await bootShell([
  appServicesModule, shellFoundationModule, failureModule, shapeModule, conversationSessionModule, edgeCardsModule, changeDataModule,
  messageContextModule, decisionDockModule, chatModelModule, chatControlsModule, threadGroupsModule, checklistModule, conversationPresentationModule, launchpadModule, intelModule, projectIconsModule, threadRuntimeModule, decisionModule, navigationModule, threadPresentationModule, homeSkeletonModule, workspaceModule, githubModule, sinceModule, artifactsModule,
  runsModule, runControlsModule, mapAgentsModule, mapModule, changesModule, routingModule, rulesModule, worktreesModule,
], SHAPE_IC);
