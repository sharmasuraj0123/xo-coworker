// @ts-check

import { createSettingsHost } from "./host.js";
import { settingsPageEvents } from "./page-events.js";
import { radioKeys } from "../../core/ui/a11y/keynav.js";
import { mountSettingsSurface } from "./surface.js";

import { requireHtml } from "../../core/platform/dom.js";
import { PHONE } from "../../core/platform/viewport.js";

/** @type {import("../../core/kernel/types").ModuleDef} */
export const settingsModule = {
  manifest: { id: "xo.settings", version: "1.0.0", kernel: "^1.1.0", provides: ["settings"] },
  activate(ctx) {
    const root = requireHtml("#settings");
    ctx.effect(() => radioKeys(root, { follow: false }));
    ctx.provide("settings", { ...createSettingsHost(), bindPage: settingsPageEvents(ctx, root) });
  },
};

/** @type {import("../../core/kernel/types").ModuleDef} */
export const settingsFrameModule = {
  manifest: { id: "xo.settings-frame", version: "1.0.0", kernel: "^1.1.0",
    needs: ["settings", "announce", "shape", "shapeView", "theme", "overlayFocus", "conversationSession", "currentView", "placeContext",
      "conversationPresentation", "mountRuntimeSettings", "drawer", "decisionPresentation", "intelligence"], provides: ["settingsFrame"] },
  activate(ctx) {
    if (!PHONE) throw new Error("Settings requires media queries");
    const view = ctx.use("currentView"), place = ctx.use("placeContext"), say = ctx.use("conversationSession").composer.say;
    const drawer = ctx.use("drawer"), { D } = ctx.use("decisionPresentation"), { intelligence } = ctx.use("intelligence");
    const frame = mountSettingsSurface(ctx, {
      el: requireHtml("#settings"), side: requireHtml("#set-side", "button"), phoneButton: requireHtml("#set-phone", "button"),
      closeButton: requireHtml("#set-x", "button"), phone: PHONE, focusIn: ctx.use("overlayFocus"), fallback: () => say,
      shape: ctx.use("shapeView"), at: () => place.atOf(view()), mountRuntimes: ctx.use("mountRuntimeSettings"),
      preferences: { THEME: ctx.use("theme").THEME, webPictures: ctx.use("conversationPresentation").webPictures },
      beforeOpen() { drawer.set(false); if (D.isOpen()) D.close(); intelligence.close({ restore: false }); },
      onHidden: () => ctx.emit("app:sync-inert"),
    });
    ctx.on("app:view-preparing", () => frame.close({ restore: false }));
    ctx.provide("settingsFrame", frame);
  },
};
