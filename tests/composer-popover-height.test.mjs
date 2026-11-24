import assert from "node:assert/strict";
import { createScope } from "../core/kernel/scope.js";
import { createMentionList } from "../modules/conversation/mention-input.js";
import { decls, rules } from "./lib/cascade.mjs";
import { dom, same } from "./lib/dom.mjs";

const { document, window } = await dom(`<div>${[0, 1].map(() =>
  '<form><textarea></textarea><ul class="at-list" role="listbox" hidden></ul></form>').join("")}</div>`);
const composers = [...document.querySelectorAll("form")].map((form, index) => {
  const say = form.querySelector("textarea");
  say.setSelectionRange = (start, end) => Object.assign(say, { selectionStart: start, selectionEnd: end });
  form.getBoundingClientRect = () => ({ top: 350 - 100 * index });
  const at = form.querySelector("ul");
  at.scrollTop = 0;
  Object.defineProperty(at, "clientHeight", { value: 20 });
  return { main: index === 0, form, say, at };
});
const [main] = composers;
Object.defineProperties(window.HTMLElement.prototype, {
  offsetTop: { get() { return this.dataset?.pid === "beta" ? 30 : 0; } },
  offsetHeight: { get() { return 10; } },
});
const saved = [];
const mentions = createMentionList({
  MK: main, world: { state: { threads: [] } },
  projects: () => [{ id: "alpha", name: "Alpha" }, { id: "beta", name: "Beta" }],
  projectIcon: () => "", isBusy: () => false,
  saveDraft: (composer) => saved.push(composer.say.value),
  updateComposer: (composer) => mentions.render(composer),
});
function key(name, composer) {
  const event = new window.Event("keydown", { cancelable: true, bubbles: true });
  Object.assign(event, { key: name });
  return mentions.keys(event, composer);
}

const scope = createScope();
for (const [index, composer] of composers.entries()) {
  mentions.wire(composer, scope);
  composer.say.value = "@";
  composer.say.setSelectionRange(1, 1);
  mentions.render(composer);
  assert.equal(composer.at.style.getPropertyValue("--at-room"), `${350 - 100 * index}px`);
  assert.equal(key("ArrowDown", composer), true);
  assert.equal(composer.at.scrollTop, 20, "The list scrolls its own selected row into view");
  assert.equal(composer.say.getAttribute("aria-activedescendant"), composer.at.lastElementChild.id);
  assert.equal(key("Escape", composer), true);
  mentions.render(composer);
  assert.equal(composer.at.hidden, true, "Escape keeps the list closed at the same caret");
  mentions.aim(composer);
  assert.equal(composer.at.hidden, false);
  same(document.activeElement, composer.say);
  const beta = composer.at.lastElementChild;
  beta.dispatchEvent(new window.Event("pointermove", { bubbles: true }));
  assert.equal(composer.say.getAttribute("aria-activedescendant"), beta.id);
  assert.equal(key("Enter", composer), true);
  assert.equal(composer.say.value, "@beta ");
  assert.equal(composer.at.hidden, true);
}
assert.deepEqual(saved, ["@beta ", "@beta "]);
scope.dispose();

const styles = rules(new URL("./lib/cascade.mjs", import.meta.url));
const properties = (selector) => Object.fromEntries(styles.filter(({ sel }) => sel === selector)
  .flatMap(({ d }) => decls(d)).map(({ p, v }) => [p, v]));
const at = properties(".at-list");
const iq = properties(".iq-list");
assert.equal(at["overflow-y"], "auto");
assert.equal(iq["overflow-y"], "auto");
assert.equal(at["overscroll-behavior"], "contain");
assert.ok(at["max-height"].includes(iq["max-height"]));
assert.ok(at["max-height"].includes("var(--at-room,100dvh)"));
