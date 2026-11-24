// Settings' Routing, Rules and Worktrees pages, wired to #settings: one listener per kind, in the order they've always answered.

import { radioKeys } from "../core/ui/a11y/keynav.js";
import { createSettingsHost } from "../modules/settings/host.js";
import { createRoutingPage } from "../modules/routing/page.js";
import { createRulesPage } from "../modules/rules/page.js";
import { createWorktreesPage } from "../modules/worktrees/page.js";

export function createSettings({ world, announce, PROJ, onChange }) {
  const host = createSettingsHost();
  const routing = createRoutingPage(host, { world, announce, PROJ, onChange });
  const rules = createRulesPage(host, { world, announce, PROJ });
  const trees = createWorktreesPage(host, { world, announce, PROJ });

  const root = document.querySelector("#settings");
  // every choice group in Settings (Routing, Shape's presets, the usual runtime): arrows move, Space or Enter chooses
  radioKeys(root, { follow: false });
  root.addEventListener("click", (e) => {
    const t = e.target;
    if (routing.clickFirst(t)) return;
    // Keep and Cancel wait while their question's answer is on its way: it can't be taken back by closing the question
    if (t.closest('[aria-disabled="true"]')) return;
    if (routing.click(t) || rules.click(t)) return;
    trees.click(t);
  });
  root.addEventListener("change", (e) => routing.change(e.target));
  root.addEventListener("submit", (e) => routing.submit(e));

  return {
    /** A page was opened: read what it shows. */
    open(id) {
      if (id === "routing") routing.open();
      else if (id === "rules") rules.open();
      else if (id === "worktrees") trees.open();
    },
  };
}
