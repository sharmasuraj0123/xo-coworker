// @ts-check
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
  return stage;
}
