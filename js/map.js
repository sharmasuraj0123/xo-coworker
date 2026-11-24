import { createMap as createPanelMap } from "../modules/map/map.js";
import { stepLineHtml } from "./turnview.js";

export { MAP_ICON } from "../modules/map/map.js";

export function createMap({ world, go, announce, isBusy, openFile }) {
  return createPanelMap({ world, go, announce, isBusy, openFile, stepLineHtml });
}
