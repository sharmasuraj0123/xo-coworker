// node modules/artifacts/tests/page.test.mjs: the Artifacts page on a DOM: stand-ins while it's read, then its count, its kinds and its projects; a kind or a search filters the whole set.
import assert from "node:assert/strict";
import { dom } from "../../../tests/lib/dom.mjs";

const { document } = await dom(`<section id="arts"></section>`);
globalThis.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} };
globalThis.ResizeObserver = class { observe() {} disconnect() {} };
const { createArtifactsPage } = await import("../page.js");

let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.stack); process.exitCode = 1; } };

const now = Date.now();
const made = [
  { key: "a", project: "demo", kind: "doc", name: "plan.md", path: "plan.md", title: null, threadTitle: "Planner", at: now - 1000, pinned: false },
  { key: "b", project: "demo", kind: "image", name: "shot.png", path: "shot.png", title: null, threadTitle: "Shooter", at: now - 2000, pinned: false },
  { key: "c", project: "site", kind: "doc", name: "notes.md", path: "notes.md", title: "Release notes", threadTitle: "Writer", at: now - 3000, pinned: false },
];
let pending = true;
const older = [];
const MS = { madePending: () => pending, madeOf: () => made, olderPages: () => older.push(1), projectsMade: () => [{ id: "demo", name: "Demo" }, { id: "site", name: "Site" }, { id: "idle", name: "Idle" }], olderLeft: () => false };
const PV = { nearY: new Map(), thumbs: new Map(), wantsText: () => false, loadThumbs() {}, loadTexts() {} };
const page = createArtifactsPage({ MS, PV, syncCards: (ul, items) => { ul.innerHTML = items.map((m) => `<li class="md-it" data-k="${m.key}"></li>`).join(""); }, PROJ: (p) => p, sk: { tile: () => `<li class="md-it is-sk"></li>`, bar: () => `<i class="sk"></i>` } });
const box = document.getElementById("arts");
const kinds = () => [...box.querySelectorAll("[data-arts-kind]")].map((b) => [b.dataset.artsKind, b.getAttribute("aria-checked")]);

t("while what was made is read: stand-ins in the gallery's shape, and nothing older is asked for", () => {
  page.render();
  assert.equal(page.box(), box);
  assert.ok(box.querySelector(".is-sk"), "stand-in cards");
  assert.ok(box.querySelector("#arts-sub .sk"), "a stand-in count");
  assert.equal(older.length, 0);
});
t("once read: the count, the kinds it has with All checked, the projects that made something, and older pages asked for", () => {
  pending = false;
  page.render();
  assert.equal(box.querySelector("#arts-sub").textContent, "3 things your threads made, newest first");
  assert.deepEqual(kinds(), [["all", "true"], ["doc", "false"], ["image", "false"]]);
  assert.deepEqual([...box.querySelectorAll("#arts-pj option")].map((o) => o.value), ["", "demo", "site"]);
  assert.equal(older.length, 1);
});
t("a kind chosen filters the whole set and shows pictures as pictures", () => {
  box.querySelector('[data-arts-kind="image"]').dispatchEvent(new window.Event("click", { bubbles: true }));
  assert.equal(box.querySelector('[data-arts-kind="image"]').getAttribute("aria-checked"), "true");
  assert.ok(box.classList.contains("is-pics"));
});
t("a search with no match says so; Esc in the field clears it", () => {
  box.querySelector('[data-arts-kind="all"]').dispatchEvent(new window.Event("click", { bubbles: true }));
  const q = box.querySelector("#arts-q");
  q.value = "zzz";
  q.dispatchEvent(new window.Event("input", { bubbles: true }));
  assert.equal(box.querySelector(".ar-none").textContent, "Nothing matches “zzz”.");
  const esc = new window.Event("keydown", { bubbles: true, cancelable: true });
  esc.key = "Escape";
  q.dispatchEvent(esc);
  assert.equal(q.value, "");
});
console.log(`\n${passed} passed`);
