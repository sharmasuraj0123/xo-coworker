// @ts-check

import { createScope } from "../core/kernel/scope.js";
import { radioKeys } from "../core/ui/a11y/keynav.js";
import { createSettingsHost } from "../modules/settings/host.js";
import { createRoutingPage } from "../modules/routing/page.js";
import { createRulesPage } from "../modules/rules/page.js";
import { createWorktreesPage } from "../modules/worktrees/page.js";

/** @typedef {Parameters<typeof createRoutingPage>[1] & Parameters<typeof createRulesPage>[1]} RoutingAndRulesOptions */

/** @param {RoutingAndRulesOptions & Parameters<typeof createWorktreesPage>[1]} options */
export function createSettings(options) {
  const root = document.getElementById("settings");
  if (!root) throw new Error("Settings root is missing");
  const scope = createScope();
  const host = createSettingsHost();
  const routing = createRoutingPage(host, options);
  scope.effect(() => routing.dispose);
  const rules = createRulesPage(host, options);
  scope.effect(() => rules.dispose);
  const trees = createWorktreesPage(host, options);
  scope.effect(() => trees.dispose);

  scope.effect(() => radioKeys(root, { follow: false }));
  scope.listen(root, "click", ({ target }) => {
    if (!(target instanceof Element) || routing.clickFirst(target)) return;
    if (target.closest('[aria-disabled="true"]') || routing.click(target) || rules.click(target)) return;
    trees.click(target);
  });
  scope.listen(root, "change", ({ target }) => {
    if (target instanceof Element) routing.change(target);
  });
  scope.listen(root, "submit", routing.submit);

  return {
    /** @param {string} id */
    open(id) {
      if (scope.signal.aborted) return;
      if (id === "routing") routing.open();
      else if (id === "rules") rules.open();
      else if (id === "worktrees") trees.open();
    },
    dispose: scope.dispose,
  };
}
