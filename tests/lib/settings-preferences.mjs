import assert from "node:assert/strict";

export async function checkSettingsPreferences(kernel, press) {
  const find = (selector) => document.querySelector(selector);
  const bubbles = find("#bubbles-tog");
  await kernel.disable("xo.settings");
  const bubbleState = bubbles.getAttribute("aria-checked");
  press("#bubbles-tog");
  assert.equal(bubbles.getAttribute("aria-checked"), bubbleState);
  const radio = find("#mode-seg [data-mode=dark]");
  const key = Object.assign(new Event("keydown", { bubbles: true, cancelable: true }), { key: "ArrowRight" });
  radio.dispatchEvent(key);
  assert.equal(key.defaultPrevented, false, "retired Appearance leaves radio navigation alone");
  const previousTheme = document.documentElement.dataset.theme;
  press("#theme");
  assert.notEqual(document.documentElement.dataset.theme, previousTheme, "global theme survives Settings retirement");
  press("#theme");
  press('#projects [data-go="p:demo"]');
  const density = document.documentElement.dataset.density;
  delete document.documentElement.dataset.density;
  press('[data-pj-icon="demo"]');
  press('[data-pk="project"]');
  assert.equal(document.documentElement.dataset.density, density, "a Shape update still applies while Settings is retired");
  press("#nv-home");
  await kernel.enable("xo.settings");
  press("#bubbles-tog");
  assert.notEqual(bubbles.getAttribute("aria-checked"), bubbleState, "one click toggles the replacement exactly once");
  press("#bubbles-tog");
}
