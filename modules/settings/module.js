// @ts-check

import { createSettingsHost } from "./host.js";
import { settingsPageEvents } from "./page-events.js";
import { radioKeys } from "../../core/ui/a11y/keynav.js";

export { SETTINGS_PAGE_OPEN } from "./page-events.js";

/** @type {import("../../core/kernel/types").ModuleDef} */
export const settingsModule = {
  manifest: { id: "xo.settings", version: "1.0.0", kernel: "^1.1.0", provides: ["settings"] },
  activate(ctx) {
    const root = document.getElementById("settings");
    if (!root) throw new Error("Settings root is missing");
    ctx.effect(() => radioKeys(root, { follow: false }));
    ctx.provide("settings", { ...createSettingsHost(), bindPage: settingsPageEvents(ctx, root) });
  },
};
