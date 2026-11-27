// @ts-check
import { bootShell, startupModule } from "../shell/boot.js";
import { conversationPresentationModule, checklistModule } from "../modules/conversation/presentation.js";
import { decisionDockModule, decisionModule } from "../modules/decisions/surface.js";
import { threadGroupsModule, threadPresentationModule } from "../modules/threads/presentation.js";
import { navigationModule, shellFoundationModule } from "../shell/foundation.js";
import { conversationPressModule } from "../shell/conversation-press.js";
import { conversationMediaModule, conversationHeaderModule, noticeLineModule } from "../modules/conversation/surfaces.js";
import { intelModule } from "../modules/chats/intel-surface.js";
import { runsModule } from "../modules/runs/module.js";
import { shortcutsModule } from "../modules/settings/shortcuts-sheet.js";
import { settingsModule, settingsFrameModule } from "../modules/settings/module.js";
import { shapeViewModule } from "../modules/settings/application.js";
import { routingModule } from "../modules/routing/module.js";
import { rulesModule } from "../modules/rules/module.js";
import { worktreesModule } from "../modules/worktrees/module.js";
import { usageModule } from "../modules/usage/module.js";
import { chatModelModule, chatControlsModule } from "../modules/chats/surface.js";
import { mainViewportModule, conversationContentModule } from "../modules/conversation/main-viewport.js";
import { runControlsModule } from "../modules/conversation/run-controls.js";
import { conversationSessionModule } from "../modules/conversation/session.js";
import { threadPageModule } from "../modules/conversation/thread-page-module.js";
import { transcriptModule } from "../modules/conversation/transcript-module.js";
import { composerModule } from "../modules/conversation/composer-module.js";
import { messageContextModule } from "../modules/conversation/message-context.js";
import { filesModule } from "../modules/files/module.js";
import { mapAgentsModule, mapModule } from "../modules/map/module.js";
import { stageModule } from "../shell/panel/workspace-stage.js";
import { railModule } from "../shell/rail/module.js";
import { interactionModule } from "../shell/interactions.js";
import { edgeCardsModule } from "../shell/edge-cards.js";
import { workspaceRendererModule } from "../shell/render.js";
import { appServicesModule } from "../shell/world.js";
import { shapeModule } from "../core/services/shape/module.js";
import { launchpadModule } from "../modules/launchpad/surface.js";
import { fileSearchModule } from "../modules/search/file-search-module.js";
import { jumpModule } from "../modules/search/jump-module.js";
import { changeDataModule } from "../modules/changes/data.js";
import { threadControlsModule, threadActionsModule } from "../modules/threads/action-surface.js";
import { githubModule } from "../modules/github/surface.js";
import { fileQuestionsModule } from "../modules/conversation/file-question-module.js";
import { changesModule } from "../modules/changes/module.js";
import { createProjectModule, projectDescriptionsModule } from "../modules/create-project/module.js";
import { projectIconsModule } from "../modules/projects/surface.js";
import { shellDockModule, shellPanelModule } from "../modules/shells/surface.js";
import { artifactsModule } from "../modules/artifacts/module.js";
import { sinceModule } from "../modules/since/module.js";
import { homeModule, homeSkeletonModule } from "../modules/home/module.js";
import { threadRuntimeModule, runtimeSettingsModule } from "../modules/runtimes/module.js";
import { themeModule } from "../shell/theme.js";

export default await bootShell([
  conversationHeaderModule,
  interactionModule,
  railModule,
  startupModule,
  jumpModule,
  homeModule,
  themeModule,
  settingsModule,
  settingsFrameModule,
  shapeViewModule,
  shortcutsModule,
  runtimeSettingsModule,
  createProjectModule,
  projectDescriptionsModule,
  appServicesModule,
  shellFoundationModule,
  shapeModule,
  conversationSessionModule,
  edgeCardsModule,
  changeDataModule,
  messageContextModule,
  decisionDockModule,
  chatModelModule,
  chatControlsModule,
  threadGroupsModule,
  checklistModule,
  conversationPresentationModule,
  launchpadModule,
  intelModule,
  projectIconsModule,
  threadRuntimeModule,
  decisionModule,
  navigationModule,
  threadPresentationModule,
  homeSkeletonModule,
  workspaceRendererModule,
  conversationContentModule,
  githubModule,
  sinceModule,
  artifactsModule,
  threadPageModule,
  threadControlsModule,
  threadActionsModule,
  conversationPressModule,
  conversationMediaModule,
  noticeLineModule,
  mainViewportModule,
  transcriptModule,
  stageModule,
  filesModule,
  composerModule,
  shellDockModule,
  shellPanelModule,
  fileSearchModule,
  fileQuestionsModule,
  runsModule,
  runControlsModule,
  mapAgentsModule,
  mapModule,
  changesModule,
  routingModule,
  rulesModule,
  worktreesModule,
  usageModule,
]);
