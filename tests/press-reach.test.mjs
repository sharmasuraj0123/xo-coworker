// @ts-check

import assert from "node:assert/strict";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { list } from "postcss";
import { templateElements } from "../tools/conformance/templates.mjs";
import { declarationsFor, publishedRules, resolveValue, stylesheetRows } from "./lib/css-snapshot.mjs";
import { dom } from "./lib/dom.mjs";

const sheet = publishedRules();
const selectorOf = (row) => row.context.at(-1).selector;
const pressGradient = "linear-gradient(var(--press-fill),var(--press-fill))";
const shared = stylesheetRows.find((row) => row.property === "background-image" && row.value === pressGradient
  && row.context.at(-1)?.selector?.startsWith(":where(button,a[href][class],")
  && selectorOf(row).endsWith(":where(:active)"));
assert.ok(shared);
const exclusions = /:where\(:not\((.*)\)\):where\(:active\)$/.exec(selectorOf(shared));
assert.ok(exclusions);
const out = list.comma(exclusions[1]).filter((selector) => ![":disabled", '[aria-disabled="true"]'].includes(selector));

const has = (selector, property, prefix) => declarationsFor(selector, property)
  .some((row) => prefix === undefined || row.value.startsWith(prefix));
const veil = (control, state) => {
  const rows = declarationsFor((selector) => list.comma(selector)
    .some((part) => part.replace(/^button/, "").startsWith(control + ":" + state + "::")),
    "background-color");
  return Math.max(0, ...rows.map((row) => Number(/^color-mix\(in srgb,var\(--veil\) (\d+)%/.exec(row.value)?.[1] ?? 0)));
};

test("the long-press menu items receive the shared press fill", () => {
  assert.ok(!out.includes(".lp-menu button"));
});

test("picture tile overlays are above the picture and darken further under a press", () => {
  const overlay = ".mx-one::before,.mx-tile::before";
  for (const [property, value] of [["content", '""'], ["position", "absolute"], ["inset", "0"], ["z-index", "2"]]) {
    assert.ok(has(overlay, property, value), property);
  }
  for (const control of [".mx-one", ".mx-tile"]) {
    assert.ok(veil(control, "hover") >= 12, control);
    assert.ok(veil(control, "active") > veil(control, "hover"), control);
  }
});

test("a chosen control layers three press veils over the shared press fill", () => {
  const chosen = stylesheetRows.find((row) => row.property === "background-image" && row.important
    && row.value === [pressGradient, pressGradient, pressGradient].join(",")
    && row.context.at(-1)?.selector?.includes(".is-on):where(:active:not("));
  assert.ok(chosen);
  assert.ok(stylesheetRows.indexOf(chosen) > stylesheetRows.indexOf(shared));
});

const { document, window } = await dom(
  '<button class="mx-tile"><img src="dark.png"></button><button class="mx-one"><img src="light.png"></button>'
  + '<button class="att-ic is-img"><img src="attachment.png"></button>',
);
const make = document.createElement.bind(document);
document.createElement = (name, options) => name === "canvas" ? {
  getContext: () => {
    let image;
    return {
      drawImage: (source) => { image = source; },
      getImageData: () => ({
        data: new Uint8ClampedArray(image.src === "light.png" ? [127, 128, 128, 255] : [126, 128, 128, 255]),
      }),
    };
  },
} : make(name, options);
for (const img of document.querySelectorAll("img")) {
  Object.defineProperties(img, { complete: { value: true }, naturalWidth: { value: 8 } });
}
const { PICTURE_FACE } = await import("../core/services/media/hydrate.js");

test("each picture-faced button has hover and press overlays", () => {
  const controls = new Set(list.comma(PICTURE_FACE).map((selector) => selector.replace(/^button/, "")));
  const markup = templateElements(fileURLToPath(new URL("../", import.meta.url)));
  for (const button of markup.filter((element) => element.matches("button.is-img,button:has(>img)"))) {
    const first = Array.from(button.classList)[0];
    if (first) controls.add("." + first + (button.matches(".is-img") ? ".is-img" : ""));
  }
  for (const control of controls) assert.ok(veil(control, "hover") > 0 && veil(control, "active") > veil(control, "hover"), control);
});

test("the picture tone selects the opposing veil colour", () => {
  const selector = ":where(" + list.comma(PICTURE_FACE).join(",") + ")";
  for (const [tone, colour] of [["dark", "#ffffff"], ["light", "#000000"]]) {
    const row = declarationsFor(selector + '[data-tone="' + tone + '"]', "--veil").at(-1);
    assert.ok(row);
    assert.equal(String(resolveValue(row.value)).toLowerCase(), colour);
  }
  for (const img of document.querySelectorAll("img")) {
    img.dispatchEvent(new window.Event("pointerover", { bubbles: true }));
    assert.equal(img.parentElement.dataset.tone, img.src === "light.png" ? "light" : "dark");
  }
});

const activeFill = (fragment, property, value) => has((selector) => selector.includes(":active")
  && selector.includes(fragment), property, value);
const track = (state, percent) => has((selector) =>
  selector.startsWith(":where(.theme,.switch):where(:" + state) && selector.endsWith(" .th-track"),
"background-image", "linear-gradient(color-mix(in srgb,var(--ink) " + percent + "%");
const custom = {
  ".send": () => activeFill(".send:not(.is-stop)", "background-color", "var(--pri-fill-press)")
    && activeFill(".send.is-stop", "background-color", "color-mix(in srgb,var(--ink) 18%,var(--stop))")
    && !activeFill(".send.is-stop", "background-color", "var(--pri-fill-press)"),
  ".btn-pri": () => activeFill(".btn-pri", "background-color", "var(--pri-fill-press)"),
  ".xd-btn.is-pri": () => activeFill(".xd-btn.is-pri", "background-color", "var(--pri-fill-press)"),
  ".xd-send": () => activeFill(".xd-send", "background-color", "var(--pri-fill-press)"),
  ".iq-done": () => activeFill(".iq-done", "background-color", "color-mix(in srgb,var(--ink)"),
  ".b-hold": () => has(".hold-fill", "transform", "scaleX(var(--p,0))")
    && has(".hold-fill", "background", "color-mix(in srgb,var(--err) 38%")
    && !has((selector) => /^\.b-hold\.(?:is-holding|tense)$/.test(selector), "box-shadow"),
  ".theme": () => track("active", 28),
  ".switch": () => track("active", 28),
  ".tw-act.lp-btn": () => activeFill(".tw-act.lp-btn", "background", "var(--ok-fill-press)"),
  ".lk:not(.lk-in)": () => declarationsFor(".lk-out:active", "opacity").some(({ value }) => resolveValue(value) === ".7"),
  ":is(.vw-cut-dl,.wsh-home,.cp-link,.fl-link,.lp-ln,.shl-all)": () =>
    activeFill(":is(.vw-cut-dl,.wsh-home,.cp-link,.fl-link,.lp-ln,.shl-all)", "opacity", ".7"),
  ".prow": () => has(":root:root .side :is(.nrow,.prow):active", "background-image", pressGradient + ",linear-gradient(var(--hover-fill)")
    && has(":root:root .side :is(.nrow,.prow):not([role=menuitem]):hover", "background-image", "linear-gradient(var(--hover-fill)"),
  ".nrow": () => has(":root:root .side :is(.prow.busy,.prow.needs,.prow.is-on,.nrow.is-on):active",
    "background-image", [pressGradient, pressGradient].join(",")),
};

test("each control excluded by the shared fill has visible press feedback of its own", () => {
  assert.deepEqual(out.filter((selector) => !custom[selector]?.()), []);
  for (const control of [".create", ".btn", ".iq", ".iq-row", ".b", ".gear", ".side-plus"]) {
    assert.ok(!out.includes(control), control);
  }
  assert.ok(track("hover", 14));
});

test("a press state adds neither a halo nor an inner shadow", () => {
  const bad = sheet.filter((rule) => /:active|\.is-holding|\.tense/.test(rule.sel)
    && rule.declarations.some(({ p, v }) => p === "box-shadow" && /0 0 0 [1-9]|inset 0 1px 2px/.test(v)));
  assert.deepEqual(bad.map((rule) => rule.sel), []);
});
