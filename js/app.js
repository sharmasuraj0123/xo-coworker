// @ts-check
import { conversationPresentationModule, checklistModule } from "../modules/conversation/presentation.js";
import { decisionDockModule, decisionModule } from "../modules/decisions/surface.js";
import { threadGroupsModule, threadPresentation, threadPresentationModule } from "../modules/threads/presentation.js";
import { navigationModule, shellFoundationModule } from "../shell/foundation.js";
import { conversationPressModule } from "../shell/conversation-press.js";
import { conversationMediaModule, mountConversationHeader, noticeLineModule } from "../modules/conversation/surfaces.js";
import "../core/ui/components/xo-select.js";
import * as Kit from "../modules/decisions/kit.js";
import { intelModule } from "../modules/chats/intel-surface.js";
import { dockAtTop } from "../modules/conversation/dock-layout.js";
import { PAGE_OF, sessionOf } from "../shell/place-context.js";
import { runsModule } from "../modules/runs/module.js";
import { mountApplicationSettings } from "../modules/settings/application.js";
import { routingModule } from "../modules/routing/module.js";
import { rulesModule } from "../modules/rules/module.js";
import { worktreesModule } from "../modules/worktrees/module.js";
import { createRuntimeSettings } from "../modules/runtimes/settings.js";
import { chatModelModule, chatControlsModule } from "../modules/chats/surface.js";
import { mainViewportModule } from "../modules/conversation/main-viewport.js";
import { runControlsModule } from "../modules/conversation/run-controls.js";
import { conversationSessionModule } from "../modules/conversation/session.js";
import { threadPageModule } from "../modules/conversation/thread-page-module.js";
import { transcriptModule } from "../modules/conversation/transcript-module.js";
import { composerModule } from "../modules/conversation/composer-module.js";
import { messageContextModule } from "../modules/conversation/message-context.js";
import { askShort } from "../modules/decisions/ask-label.js";
import { filesModule } from "../modules/files/module.js";
import { mapAgentsModule, mapModule } from "../modules/map/module.js";
import { stageModule } from "../shell/panel/workspace-stage.js";
import { railCountsModule } from "../shell/rail/counts.js";
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
import { fileSearchModule } from "../modules/search/file-search-module.js";
import { createJumpModule } from "../modules/search/jump-module.js";
import { changeDataModule } from "../modules/changes/data.js";
import { setTheme } from "../modules/changes/diffview.js";
import { threadControlsModule, threadActionsModule } from "../modules/threads/action-surface.js";
import { githubModule } from "../modules/github/surface.js";
import { fileQuestionsModule } from "../modules/conversation/file-question-module.js";
import { changesModule } from "../modules/changes/module.js";
import { createProjectModule } from "../modules/create-project/module.js";
import { projectIconsModule } from "../modules/projects/surface.js";
import { shellDockModule, shellPanelModule } from "../modules/shells/surface.js";
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
      "overlayFocus", "conversationSession", "shellDock", "stage", "navigation", "projectIcons", "threadRuntime", "decisionPresentation",
      "launchpad", "intelligence", "threadControls", "threadMenu",
      "conversationPresentation", "threadGroups", "checklist", "chats", "decisionDock", "messageContext", "composer", "lightbox", "noticeLine", "mainViewport", "fileSearch"], optional: ["runs", "files", "transcript", "threadActions", "threadPage"] },
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
const { projects, convThread, convProject, atOf } = place;
const currentView = navigationState.view;
const { noun, setWorkMode, webPictures } = ctx.use("conversationPresentation");
const { main: MAIN, region: placeRegion } = session;
const { composer: MK, focus: { composerNow } } = session;
const { say } = MK;
const { convHost } = ctx.use("messageContext");

const { THEME, applyTheme } = createTheme(appScope, setTheme);

const threadControls = ctx.use("threadControls");
const { show: heraldShow } = notices;

const { isBusy, isHeld } = threadPresentation;
const { D, pings } = ctx.use("decisionPresentation");
const { intelligence: IQ, toggle: toggleIq, activate: activateIntel } = ctx.use("intelligence");

const CH = ctx.use("chats");
const files = () => ctx.optional("files");
const { quickOpen: QO } = ctx.use("fileSearch");
const LB = ctx.use("lightbox");
const SH = ctx.use("shellDock");

const wsHeadRender = createWorkspaceHeader(currentView, projects);
const { PICK, projectIcon } = ctx.use("projectIcons");
const { threadMark, rtTag } = ctx.use("threadRuntime");
const { threadCounts } = ctx.use("threadGroups");
const { LP, LW, LPP } = ctx.use("launchpad");
const STAGE = ctx.use("stage");
const threadMenuHtml = ctx.use("threadMenu");

const sideRender = createSideRows(appScope, {
  view: currentView, world, CH, D, projects, convThread, isBusy, isHeld, askShort, projectIcon, folded: () => SIDE.folded,
});

const { homeParts, homeRender, module: homeModule } = createHomeModule({
  threadMark, noun, kernel, heraldShow, SV: { homeOrder: (body) => SV.homeOrder(body) }, decideKey: (key) => decideKey(key),
});

const { render: checklistRender } = ctx.use("checklist");

const { main: MDOCK, decideKey } = ctx.use("decisionDock");
const dockRender = MDOCK.render;


const composer = ctx.use("composer");
const { loadDraft,
    targetLineRender,
    syncPlaceholder, chipRender, sendRender, chatTargetRender, updateComposer } = composer;
const { heraldRender } = ctx.use("noticeLine");

const { scroller, msgsEl, loadAhead, follow, loadChatHops } = ctx.use("mainViewport");
/** @type {import("../core/kernel/types").Services["transcript"]} */
const drawConv = (conversation, needs) => ctx.optional("transcript")?.(conversation, needs);
ctx.on("app:view-preparing", () => {
  closeSettings({ restore: false });
  setDrawer(false);
});

const topRender = mountConversationHeader({
  ...place, ...threadPresentation, threadControls, description: (project) => CREATE.descriptions.get(project), world, PICK, LP, LW, STAGE, kernel,
  convHost, homeParts, threadCounts, projectIcon, threadMenuHtml, rtTag, location: navigationState, CH, checklistRender, tdelRender: (thread) => ctx.optional("threadActions")?.renderDelete(thread),
}, appScope, schedule);

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
  topRender, wsHeadRender, drawConv, say, msgsEl, placeRegion, loadAhead, STAGE, drawThreadPage: (needs) => ctx.optional("threadPage")?.draw(needs),
  dockRender, heraldRender, chatTargetRender, targetLineRender, syncPlaceholder, sendRender, chipRender,
  files, LW, titleFor: Kit.titleFor, isBusy,
};
const renderShell = createShellRenderer(rendererOptions, appScope, schedule);
appScope.effect(() => kernel.bus.on("app:render", () => {
  renderShell();
  if (world.state.loaded) activateIntel();
}));

const SIDE = createSide({ shape: SHAPE, announce, render, toggleJump: () => (jump.hidden ? JUMP.open() : JUMP.close()) });

const applyInert = mountShellInteractions(appScope, kernel.layers, {
  PHONE: phone, navigationState, capturing: settings.capturing, SH, jump, IQ, CREATE, keys, files, QO, back, go, JUMP,
  composerNow, toggleIq, sessionOf, openKeys, STAGE, SIDE, runsLayer: { id: "runs", open: () => ctx.optional("runs")?.isOpen() ?? false, close: () => ctx.optional("runs")?.back() }, closeKeys, LB, setEl, closeSettings,
  setDrawer, D, CH, PAGE_OF, world, updateComposer, say, toastLine, wordsOf, scroller,
});
appScope.effect(() => kernel.bus.on("app:sync-inert", applyInert));

for (const module of [
  homeModule, JUMP.module,
  settings.module, CREATE.module,
]) kernel.register(module);
appScope.effect(() => SIDE.dispose);
ctx.on("app:started", () => appScope.effect(() => startShell({
  THEME, applyTheme, SIDE, PHONE: phone, setDrawer, render, world, schedule, follow, loadDraft,
})));
  },
};

await bootShell([
  appServicesModule, shellFoundationModule, failureModule, shapeModule, conversationSessionModule, edgeCardsModule, changeDataModule,
  messageContextModule, decisionDockModule, chatModelModule, chatControlsModule, threadGroupsModule, checklistModule, conversationPresentationModule, launchpadModule, intelModule, projectIconsModule, threadRuntimeModule, decisionModule, navigationModule, threadPresentationModule, homeSkeletonModule, railCountsModule, workspaceModule, githubModule, sinceModule, artifactsModule,
  threadPageModule, threadControlsModule, threadActionsModule, conversationPressModule, conversationMediaModule, noticeLineModule, mainViewportModule, transcriptModule, stageModule, filesModule, composerModule, shellDockModule, shellPanelModule, fileSearchModule, fileQuestionsModule, runsModule, runControlsModule, mapAgentsModule, mapModule, changesModule, routingModule, rulesModule, worktreesModule,
], SHAPE_IC);
