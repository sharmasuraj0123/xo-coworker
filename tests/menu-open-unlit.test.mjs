// @ts-check

import assert from "node:assert/strict";
import { dom, same } from "./lib/dom.mjs";
import { declarationsFor } from "./lib/css-snapshot.mjs";
import { focusOpened, pointerFollows } from "../core/ui/a11y/keynav.js";

const { document, window } = await dom('<div role="menu"><button role="menuitem" disabled>A</button><button role="menuitem">B</button></div>');
const menu = document.querySelector('[role="menu"]');
const [, available] = menu.querySelectorAll('[role="menuitem"]');
focusOpened(menu, { detail: 1 });
same(document.activeElement, menu);
assert.equal(menu.getAttribute("tabindex"), "-1");
pointerFollows(menu);
available.dispatchEvent(new window.Event("pointermove", { bubbles: true }));
same(document.activeElement, available);
menu.focus();
focusOpened(menu, { detail: 0 });
same(document.activeElement, available);

assert.ok(declarationsFor(".nrow:not([role=menuitem]):hover", "background")
  .some((row) => row.value === "var(--row-hover)"));
assert.ok(declarationsFor(":root:root .side :is(.nrow,.prow):not([role=menuitem]):hover", "background-image").length);
