// @ts-check

/** @import { Topics } from "../../core/kernel/types" */

/** @import { StageNavigation } from "./panel-types" */

/** @param {StageNavigation} stage @param {boolean} phone @param {Topics["app:view-preparing"]} change */
export function prepareStageNavigation(stage, phone, change) {
  if (!change.changed) return;
  stage.leave();
  if (phone && change.panel && stage.isOpen) stage.close({ restore: false, quiet: true });
}
