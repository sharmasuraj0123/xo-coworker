// @ts-check

import { createSettingsHost } from "../../modules/settings/host.js";
import { SETTINGS_PAGE_OPEN } from "../../modules/settings/page-events.js";
import { dom } from "./dom.mjs";

/** @param {string} id */
export async function mountSettingsPage(id) {
  await dom(`<section id="settings"><button data-set="${id}">Settings</button>`
    + `<div data-page="${id}"><div class="set-live"></div></div></section>`);
  return Object.freeze(createSettingsHost());
}

/** @param {string} page @param {import("../../core/kernel/types").ModuleDef} module @param {Omit<import("../../shell/app-service-types").AppServices, "currentView">} services */
export async function openSettingsModule(page, module, services) {
  await mountSettingsPage(page);
  const { createKernel } = await import("../../core/kernel/index.js");
  const { createAppServices } = await import("../../shell/app-services.js");
  const { settingsModule } = await import("../../modules/settings/module.js");
  const kernel = createKernel();
  kernel.register(createAppServices({ ...services, currentView: () => "home" }, () => {}));
  kernel.register(settingsModule);
  kernel.register(module);
  await kernel.start();
  kernel.bus.emit(SETTINGS_PAGE_OPEN, page);
  return () => kernel.disable(settingsModule.manifest.id);
}
