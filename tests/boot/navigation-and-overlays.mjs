// @ts-check
import {
  document, checkFeatureOwnership, flushFrames, assert, window, setImmediate, STONE, FLAVOURS,
  storage, blockedStorage, lastHomeVisit, artifactsSignal, setPhone,
} from "./environment.mjs";
import {
  kernel, press, fold,
} from "./startup-and-chats.mjs";
const jump = document.querySelector("#jump");
await checkFeatureOwnership(kernel, press, flushFrames);
const app = document.querySelector("#app");
assert.equal(Boolean(document.querySelector('#side input[type="search"], #side #pf-in')), false, "The sidebar uses Jump for project search");
press("#side-jump");
assert.equal(jump.hidden, false, "The visible sidebar search opens Jump");
press("#side-jump");
assert.equal(jump.hidden, true);
const key = (/** @type {string} */ name, mods = {}) => {
  const event = Object.assign(new window.Event("keydown", { cancelable: true }), { key: name, altKey: false, ctrlKey: false, metaKey: false, shiftKey: false, ...mods });
  window.dispatchEvent(event);
  return event;
};
assert.equal(key("b", { metaKey: true, shiftKey: true }).defaultPrevented, true);
assert.ok(app.classList.contains("side-folded"));
assert.equal(fold.getAttribute("aria-expanded"), "false");
key("b", { metaKey: true, shiftKey: true });
assert.ok(!app.classList.contains("side-folded"));
assert.equal(key("k", { metaKey: true }).defaultPrevented, true, "boot registers the Jump shortcut");
assert.equal(jump.hidden, false);
await new Promise((resolve) => setImmediate(resolve));
assert.equal(app.inert, true, "the app's Jump layer holds the application inert");
const jumpField = document.querySelector("#jump-q");
Object.defineProperty(jumpField, "tabIndex", { value: 0 });
fold.focus();
assert.equal(key("Tab").defaultPrevented, true, "the app's Jump layer traps Tab");
assert.ok(document.activeElement === jumpField, "Tab moves focus back into Jump");
assert.equal(key("Escape").defaultPrevented, true);
assert.equal(jump.hidden, true, "Escape dispatches through the app's Jump layer");
assert.equal(app.inert, false, "closing Jump returns the application to interaction");

fold.focus();
const shortcuts = document.querySelector("#keys");
assert.equal(key("?").defaultPrevented, true, "boot registers the Shortcuts key");
assert.equal(shortcuts.hidden, false);
assert.ok(document.activeElement === shortcuts.querySelector("[data-close]"), "opening Shortcuts focuses its close button");
key("Escape");
assert.equal(shortcuts.hidden, true, "Escape closes Shortcuts");
assert.ok(document.activeElement === fold, "closing Shortcuts restores the previous focus");
await new Promise((resolve) => setImmediate(resolve));

press("#set-side");
assert.equal(document.querySelector("#settings").hidden, false, "sidebar opens Settings");
assert.ok(!document.querySelector('#settings [data-set="sounds"], #settings [data-page="sounds"], #sound-tog'));
press('#settings [data-set="appearance"]');
assert.equal(document.querySelector('#settings [data-page="appearance"]').hidden, false, "Appearance is the visible Settings page");
assert.deepEqual([...document.querySelectorAll('#mode-seg [role="radio"]')].map((b) => [b.dataset.mode, b.textContent]), [["dark", "Dark"], ["light", "Light"], ["system", "System"]]);
assert.deepEqual([...document.querySelectorAll('#flavour-seg [role="radio"]')].map((b) => [b.dataset.flavour, b.textContent]), [STONE, ...FLAVOURS].map(({ id, name }) => [id, name]));
press('#mode-seg [data-mode="dark"]');
assert.equal(document.documentElement.dataset.theme, "dark", "choosing Dark applies it immediately");
assert.equal(storage.get("cv-theme"), "dark", "choosing Dark persists it");
assert.equal(document.querySelector('#mode-seg [data-mode="dark"]').getAttribute("aria-checked"), "true");
press('#flavour-seg [data-flavour="stone"]');
assert.equal(document.documentElement.dataset.flavour, undefined, "Stone removes the flavour override");
assert.equal(storage.get("cv-flavour"), "stone", "choosing Stone persists it");
press("#bubbles-tog");
assert.equal(document.documentElement.dataset.msgx, "bubbles");
assert.equal(document.documentElement.dataset.msgxTails, "");
assert.equal(storage.get("cv-bubbles"), "on");
assert.equal(document.querySelector("#bubbles-tog").getAttribute("aria-checked"), "true");
press("#bubbles-tog");
assert.equal(document.documentElement.dataset.msgx, undefined);
assert.equal(document.documentElement.dataset.msgxTails, undefined);
assert.equal(storage.get("cv-bubbles"), "off");

press("#theme");
assert.equal(document.documentElement.dataset.theme, "light", "the theme switch applies Light");
assert.equal(storage.get("cv-theme"), "light", "the theme switch persists Light");
assert.equal(document.querySelector("#theme").getAttribute("aria-checked"), "true");
assert.equal(document.querySelector('#mode-seg [data-mode="light"]').getAttribute("aria-checked"), "true", "the theme switch syncs Appearance");

blockedStorage.add("cv-theme");
press('#mode-seg [data-mode="dark"]');
assert.equal(document.documentElement.dataset.theme, "dark", "the chosen theme stays active for the session");
assert.equal(storage.get("cv-theme"), "light", "refusal leaves the persisted preference alone");
assert.equal(document.querySelector('#mode-seg [data-mode="dark"]').getAttribute("aria-checked"), "true");
const modeRow = document.querySelector("#mode-seg").closest(".set-row");
assert.match(modeRow.querySelector('.set-err[role="alert"]').textContent, /this browser won't keep it after a reload/);
blockedStorage.delete("cv-theme");
press('#mode-seg [data-mode="dark"]');
assert.ok(!modeRow.querySelector(".set-err"), "the inline error clears after a successful write");
assert.equal(document.documentElement.dataset.theme, "dark");
const settings = document.querySelector("#settings");
const settingsClose = document.querySelector("#set-x");
Object.defineProperty(settingsClose, "tabIndex", { value: 0 });
fold.focus();
assert.equal(key("Tab").defaultPrevented, false, "desktop Settings leaves Tab to the browser");
key("Escape");
assert.equal(settings.hidden, true, "Escape closes the app's Settings layer");
await new Promise((resolve) => setImmediate(resolve));

setPhone(true);
const settingsOpener = document.querySelector("#set-phone");
settingsOpener.focus();
press("#set-phone");
assert.equal(settings.hidden, false, "the phone button opens Settings");
await new Promise((resolve) => setImmediate(resolve));
const home = document.querySelector("#home");
assert.equal(home.inert, true, "Settings holds the background inert");
fold.focus();
assert.equal(key("Tab").defaultPrevented, true, "phone Settings traps Tab");
assert.ok(settings.contains(document.activeElement), "Tab moves focus into Settings");
key("Escape");
assert.equal(settings.hidden, true);
assert.equal(home.inert, false, "closing Settings releases the background");
assert.ok(document.activeElement === settingsOpener, "closing Settings restores the phone opener");

press('#projects [data-go="p:demo"]');
assert.ok(document.querySelector("#since .sl"), "the project header paints Since through the active module");
const sinceProject = document.querySelector('#since [data-rec-got="p:demo"]');
sinceProject.focus();
await kernel.disable("xo.since");
assert.equal(document.querySelector("#since").hidden, true, "disabling Since hides its permanent host");
assert.equal(document.querySelector("#since").childElementCount, 0, "disabling Since clears its project controls");
assert.ok(document.activeElement === document.querySelector("#scroller"), "disabling Since returns project focus to the conversation");
assert.equal(kernel.live("xo.since"), 0);
storage.set("xo-seen", JSON.stringify({ home: lastHomeVisit - 86_400_000, "p:demo": lastHomeVisit - 86_400_000 }));
await kernel.enable("xo.since");
await new Promise(setImmediate);
flushFrames();
assert.equal(document.querySelectorAll('#since [data-rec-got="p:demo"]').length, 1, "enabling Since restores one project instance");
press("#nv-home");
const sinceHome = document.querySelector('#hm-since [data-rec-got="home"]');
assert.ok(sinceHome, "the enabled module paints a Home catch-up");
sinceHome.focus();
await kernel.disable("xo.since");
assert.equal(document.querySelector("#hm-since").childElementCount, 0, "disabling Since removes its Home controls");
assert.ok(document.activeElement === document.querySelector("#home"), "disabling Since returns focus to Home");
storage.set("xo-seen", JSON.stringify({ home: lastHomeVisit - 86_400_000, "p:demo": lastHomeVisit - 86_400_000 }));
await kernel.enable("xo.since");
await new Promise(setImmediate);
flushFrames();
assert.equal(document.querySelectorAll('#hm-since [data-rec-got="home"]').length, 1, "enabling Since restores one Home instance");
press("#nv-arts");
const gallery = document.querySelector("#arts");
const gallerySearch = gallery.querySelector("#arts-q");
assert.ok(gallerySearch, "the main Artifacts route paints its contributed page");
const firstArtifactsSignal = artifactsSignal;
gallerySearch.focus();
await kernel.disable("xo.artifacts");
assert.equal(firstArtifactsSignal?.aborted, true, "disabling Artifacts aborts the gallery read");
assert.equal(gallery.hidden, true, "disabling Artifacts hides its permanent gallery");
assert.equal(gallery.childElementCount, 0, "disabling Artifacts clears its gallery controls");
assert.ok(document.activeElement !== document.body && !gallery.contains(document.activeElement), "disabling the focused gallery restores focus");
assert.equal(kernel.places.get("search.provider", "artifacts"), undefined, "disabling Artifacts withdraws its Jump results");
assert.equal(kernel.live("xo.artifacts"), 0);
await kernel.enable("xo.artifacts");
await new Promise(setImmediate);
flushFrames();
assert.equal(gallery.querySelectorAll("#arts-q").length, 1, "enabling Artifacts restores one gallery");
press('#projects [data-go="p:demo"]');

export {
  key, app, settings, settingsOpener, shortcuts,
};
