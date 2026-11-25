// @ts-check

import { ICON } from "../../core/ui/icons/names.js";
import { onChange } from "../../core/platform/keys.js";
import { mountPreferences } from "./preferences.js";
import { createAccounts } from "./accounts.js";
import { createSettingsFrame } from "./frame.js";
import { createKeysPage } from "./keys-page.js";
import { SETTINGS_PAGE_OPEN } from "./page-events.js";
import { createSettingsSections } from "./sections.js";

/** @import { ModuleContext } from "../../core/kernel/types.d.ts" */

/** @import { SettingsSurfaceHost } from "./types.d.ts" */

/** @param {ModuleContext} ctx @param {SettingsSurfaceHost} host */
export function mountSettingsSurface(ctx, host) {
  const { el, at, shape } = host;
  const nav = el.querySelector(".set-nav");
  const pages = el.querySelector(".set-page")?.parentElement;
  const box = el.querySelector("#set-keys-list");
  if (!(nav instanceof HTMLElement) || !pages || !(box instanceof HTMLElement)) throw new Error("Settings pages are missing");
  const announce = ctx.use("announce");
  mountPreferences(ctx, host.preferences, announce);
  const runtimes = host.mountRuntimes({ scope: ctx, root: el });
  const keys = createKeysPage({ box, announce, resetIcon: ICON.retry });
  ctx.effect(() => () => { keys.dispose(); box.replaceChildren(); });
  const accounts = createAccounts({ announce });
  ctx.effect(() => () => {
    accounts.dispose();
    el.querySelector('[data-page="accounts"] .set-live')?.replaceChildren();
  });
  const sections = createSettingsSections({
    places: ctx.places, nav, pages, at, pick: (id) => frame.setPage(id), isOpen: () => !el.hidden, onTabs: shape.apply,
  });
  ctx.effect(() => sections.destroy);
  const frame = createSettingsFrame({
    ...host,
    onPage(id) {
      ctx.emit(SETTINGS_PAGE_OPEN, id);
      if (id === "runtimes" && !el.hidden) runtimes.open();
      if (id === "accounts") accounts.open();
      if (id === "shape") shape.open();
      sections.show(id);
    },
    beforeOpen() { host.beforeOpen(); sections.resume(); },
    onOpen(id) { if (id === "runtimes") runtimes.open(); },
    beforeClose() { keys.cancel(); sections.hide(); },
  });
  ctx.effect(() => frame.dispose);
  ctx.effect(() => onChange(keys.render));
  const first = nav.querySelector("[data-set]")?.getAttribute("data-set");
  if (first && !nav.querySelector('[aria-selected="true"]')) frame.setPage(first);
  keys.render();
  return { open: frame.open, close: frame.close, capturing: keys.capturing };
}
