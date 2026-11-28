// A clone's Stop lives in its progress row; when the row goes, focus that was on Stop lands on Create, never on the page.
import assert from "node:assert/strict";
import { createDialog } from "./create-fixture.mjs";
import { same } from "../../../tests/lib/dom.mjs";

let passed = 0;
const t = async (name, fn) => { try { await fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.stack); process.exitCode = 1; } };
async function cloning() {
  const D = await createDialog();
  await D.press('[data-mode="clone"]');
  D.type("#cp-repo", "acme/site");
  await D.submit();
  await D.answer({ state: "running", phase: "receiving", percent: 10 });
  return D;
}

await t("Stop is inside the progress row, shown while a clone runs", async () => {
  const D = await cloning();
  same(D.$("#cp-stop").closest("#cp-prog"), D.$("#cp-prog"));
  assert.equal(D.$("#cp-prog").hidden, false);
  assert.equal(D.$("#cp-stop").hidden, false);
});

await t("Stop asks with aria-disabled and aria-busy, never disabled, so focus stays on it", async () => {
  const D = await cloning();
  let answer;
  D.api.cancelClone = () => new Promise((ok) => { answer = ok; });
  D.$("#cp-stop").focus();
  await D.press("#cp-stop");
  assert.equal(D.$("#cp-stop").getAttribute("aria-disabled"), "true");
  assert.equal(D.$("#cp-stop").getAttribute("aria-busy"), "true");
  assert.equal(D.$("#cp-stop").disabled, false);
  same(document.activeElement, D.$("#cp-stop"));
  answer({});
});

await t("stopped: the row hides, and focus that was on Stop lands on Create, the control that starts it again", async () => {
  const D = await cloning();
  D.$("#cp-stop").focus();
  await D.press("#cp-stop");
  await D.answer({ state: "cancelled" });
  assert.equal(D.$("#cp-prog").hidden, true);
  same(document.activeElement, D.$("#cp-submit"));
  assert.equal(D.said.at(-1), "Stopped cloning. Nothing was kept.");
});

await t("a refused Stop leaves you on Stop, ready to try again, and says why", async () => {
  const D = await cloning();
  D.api.cancelClone = async () => { throw Object.assign(new Error("Busy."), { status: 500 }); };
  D.$("#cp-stop").focus();
  await D.press("#cp-stop");
  assert.equal(D.$("#cp-stop").hasAttribute("aria-disabled"), false);
  assert.equal(D.$("#cp-stop").hasAttribute("aria-busy"), false);
  same(document.activeElement, D.$("#cp-stop"));
  assert.equal(D.$("#cp-err").textContent, "Couldn't stop it: Busy.");
});

await t("a clone that fails while focus is on Stop: focus lands on Create, not on the page", async () => {
  const D = await cloning();
  D.$("#cp-stop").focus();
  await D.answer({ state: "failed", error: { code: "timed_out" } });
  assert.equal(D.$("#cp-prog").hidden, true);
  same(document.activeElement, D.$("#cp-submit"));
});
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
process.exit();
