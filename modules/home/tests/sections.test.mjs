// node modules/home/tests/sections.test.mjs: Home draws each home.section entry into its element, in the place's order, mounting it once.
import assert from "node:assert/strict";
import { createKernel } from "../../../core/kernel/index.js";
import { definePlaces } from "../../../shell/places.js";
import { createHomeSections } from "../sections.js";
import { createScope } from "../../../core/kernel/scope.js";
import { dom } from "../../../tests/lib/dom.mjs";

await dom("");

let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.stack); process.exitCode = 1; } };

/** A body holding elements by id, in the order given; querySelector answers `:scope > #id`. */
const bodyOf = (ids) => {
  const els = new Map(ids.map((id) => [id, { id, html: "", made: 0 }]));
  return { els, querySelector: (sel) => els.get(/^:scope > #(.+)$/.exec(sel)?.[1]) || null };
};
t("sections draw in the place's order, whatever the body's; one without an element is passed over; no body draws nothing", () => {
  const kernel = createKernel();
  definePlaces(kernel);
  const calls = [];
  const drawSections = createHomeSections(kernel.places, createScope(), () => {});
  for (const [id, order] of [["hm-b", 20], ["hm-a", 10], ["hm-c", 30]]) kernel.places.contribute("home.section", { id, order, mount() {}, render: (el, c) => { calls.push(id); el.html = c.needs.length; } }, "test");
  const body = bodyOf(["hm-b", "hm-a"]);
  drawSections(body, { needs: [1, 2], patch: () => false });
  assert.deepEqual(calls, ["hm-a", "hm-b"]);
  assert.equal(body.els.get("hm-a").html, 2);
  drawSections(null, { needs: [], patch: () => false });
  assert.deepEqual(calls, ["hm-a", "hm-b"]);
});
t("each element is mounted once, however often Home draws", () => {
  const kernel = createKernel();
  definePlaces(kernel);
  let mounts = 0, renders = 0;
  const drawSections = createHomeSections(kernel.places, createScope(), () => {});
  kernel.places.contribute("home.section", { id: "hm-x", mount() { mounts++; }, render() { renders++; } }, "test");
  const body = bodyOf(["hm-x"]);
  for (let i = 0; i < 3; i++) drawSections(body, { needs: [], patch: () => false });
  assert.equal(mounts, 1);
  assert.equal(renders, 3);
});
t("the place refuses a section without mount", () => {
  const kernel = createKernel();
  definePlaces(kernel);
  assert.throws(() => kernel.places.contribute("home.section", { id: "hm-y", render() {} }, "test"), /mount must be a function/);
});
t("withdrawal clears only the owned host and remounts a replacement entry", () => {
  const kernel = createKernel();
  definePlaces(kernel);
  const scope = createScope();
  const home = document.createElement("section");
  home.id = "home";
  home.tabIndex = -1;
  home.innerHTML = '<div id="hm-x"></div><div id="static">Keep me</div>';
  document.body.append(home);
  const host = home.querySelector("#hm-x");
  let scheduled = 0, mounts = 0, cleanups = 0;
  const draw = createHomeSections(kernel.places, scope, () => { scheduled++; });
  const entry = {
    id: "hm-x",
    mount(el) {
      mounts++;
      el.innerHTML = "<button>Owned control</button>";
      return () => { cleanups++; };
    },
    render() {},
  };
  const undo = kernel.places.contribute("home.section", entry, "test");
  draw(home, { needs: [], patch: () => false });
  host.querySelector("button").focus();
  undo();
  assert.equal(host.childElementCount, 0);
  assert.equal(home.querySelector("#static").textContent, "Keep me");
  assert.ok(document.activeElement === home);
  assert.deepEqual([mounts, cleanups, scheduled], [1, 1, 2]);
  kernel.places.contribute("home.section", entry, "test");
  draw(home, { needs: [], patch: () => false });
  assert.equal(host.querySelectorAll("button").length, 1);
  scope.dispose();
  assert.deepEqual([mounts, cleanups, scope.size, host.childElementCount], [2, 2, 0, 0]);
  home.remove();
});
t("a failed cleanup reports once and retires both hosts on withdrawal and scope disposal", () => {
  for (const withdrawal of [true, false]) {
    const { places } = createKernel();
    const undefine = places.define({ id: "home.section", kind: "list", scope: "app", description: "Home sections" });
    const reports = [];
    const scope = createScope({ warn: (...args) => reports.push(args) });
    const home = document.createElement("main");
    home.innerHTML = '<div id="hm-safe"></div><div id="hm-throw"></div>';
    const retired = [];
    let scheduled = 0;
    const draw = createHomeSections(places, scope, () => { scheduled++; });
    const error = new Error("mount cleanup failed");
    const first = ["hm-throw", "hm-safe"];
    for (const id of withdrawal ? first : first.toReversed()) places.contribute("home.section", {
      id,
      mount(host) {
        host.textContent = "Mounted";
        return () => {
          retired.push(id);
          if (id === "hm-throw") throw error;
        };
      },
      render() {},
    }, "test");
    draw(home, { needs: [], patch: () => false });
    assert.equal(home.textContent, "MountedMounted");
    if (withdrawal) undefine();
    else scope.dispose();
    assert.deepEqual(retired, first, "the second cleanup follows the throwing one");
    assert.equal(home.textContent, "");
    assert.deepEqual(reports, [["undo failed:", error]]);
    assert.equal(scheduled, withdrawal ? 3 : 2, "withdrawal still schedules a render");
    scope.dispose();
    assert.equal(scope.size, 0);
    assert.equal(reports.length, 1);
  }
});
console.log(`\n${passed} passed`);
