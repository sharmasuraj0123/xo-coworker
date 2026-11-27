// @ts-check

import { api } from "../../core/platform/api.js";
import { usageApi } from "../../core/platform/usage-response.js";
import { isInstalled } from "../../core/services/runtimes.js";
import { createUsagePage } from "./page.js";

/** @type {import("./types").UsageSource} */
const source = {
  runtimes: async (signal) => (await api.runtimes({ signal })).runtimes.filter(isInstalled).map((rt) => rt.name),
  usage: (name, days, signal) => usageApi.runtime(name, days, signal),
};

/** @type {import("../../core/kernel/types").ModuleDef} */
export const usageModule = {
  manifest: { id: "xo.usage", version: "1.0.0", kernel: "^1.1.0", needs: ["settings"] },
  activate(ctx) {
    const settings = ctx.use("settings");
    const page = createUsagePage(settings, source);
    ctx.effect(() => page.dispose);
    ctx.effect(() => settings.bindPage("usage", page));
  },
};
