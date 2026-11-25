// @ts-check
import { prepareStageNavigation } from "./navigation.js";
import { PHONE } from "../../core/platform/viewport.js";
import { panelPlace } from "../place-context.js";
import { createStage } from "./panel.js";
import { bindPanelHeaderControls } from "./header-controls.js";
import { wireHeaderActions } from "../header.js";

/** @import { StageDeps } from "./panel-types" */

/** @import { Services, ModuleContext } from "../../core/kernel/types" */

/** @typedef {Omit<StageDeps, "at" | "place" | "frames">} StageOptions */

/** @typedef {Parameters<typeof bindPanelHeaderControls>[2]} LaunchWindow */

/** @typedef {{ place: Services["placeContext"], shape: Services["shape"], launch: LaunchWindow }} StageContext */

/** @param {Pick<ModuleContext, "effect" | "listen">} scope @param {StageOptions} options @param {StageContext} host */
export function mountWorkspaceStage(scope, options, { place, shape, launch }) {
  const at = () => place.atOf(options.view());
  const stage = createStage({
    ...options, at, place: panelPlace, frames: () => shape.list("panel").map((frame) => frame.id.slice("xo:panel/".length)),
  });
  stage.names = place.panelName;
  wireHeaderActions(scope, options.places, at);
  bindPanelHeaderControls(scope, stage, launch, options.view);
  scope.effect(() => stage.disposeLayout);
  /** @type {import("../../core/kernel/types").ModuleDef} */
  const module = {
    manifest: { id: "xo.stage", version: "1.0.0", kernel: "^1.1.0", core: true, provides: ["stage"] },
    activate(ctx) {
      ctx.provide("stage", stage);
      ctx.on("app:view-preparing", (change) => prepareStageNavigation(stage, !!PHONE?.matches, change));
    },
  };
  return { stage, module };
}
