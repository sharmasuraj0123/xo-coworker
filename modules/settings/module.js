// @ts-check

import { createSettingsHost } from "./host.js";
import { settingsPageEvents } from "./page-events.js";
import { radioKeys } from "../../core/ui/a11y/keynav.js";
import { mountSettingsSurface } from "./surface.js";

/** @param {import("./types.d.ts").SettingsSurfaceHost} [host] */
export function createSettingsModule(host) {
  /** @type {ReturnType<typeof mountSettingsSurface> | undefined} */
  let active;
  /** @type {import("../../core/kernel/types").ModuleDef} */
  const module = {
    manifest: { id: "xo.settings", version: "1.0.0", kernel: "^1.1.0", provides: ["settings"], needs: host ? ["announce"] : [] },
    activate(ctx) {
      const root = host?.el ?? document.getElementById("settings");
      if (!root) throw new Error("Settings root is missing");
      ctx.effect(() => radioKeys(root, { follow: false }));
      ctx.provide("settings", { ...createSettingsHost(), bindPage: settingsPageEvents(ctx, root) });
      if (host) active = mountSettingsSurface(ctx, host);
      ctx.effect(() => () => { active = undefined; });
    },
  };
  return {
    module,
    open: () => active?.open(),
    /** @param {Parameters<NonNullable<typeof active>["close"]>[0]} [options] */
    close(options) { active?.close(options); },
    capturing: () => active?.capturing() ?? false,
  };
}
