// @ts-check

import { createSettingsHost } from "../../modules/settings/host.js";
import { dom } from "./dom.mjs";

/** @param {string} id */
export async function mountSettingsPage(id) {
  await dom(`<section id="settings"><button data-set="${id}">Settings</button>`
    + `<div data-page="${id}"><div class="set-live"></div></div></section>`);
  const host = createSettingsHost();
  Object.freeze(host.R);
  return host;
}
