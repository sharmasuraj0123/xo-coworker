// While a project is being created, what the dialog offers is what it does: Close, not Cancel, and ARIA states written as values.
import assert from "node:assert/strict";
import { sourcePaths, readSource } from "../../../tests/lib/sources.mjs";
import { createDialog } from "./create-fixture.mjs";

let passed = 0;
const t = async (name, fn) => { try { await fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.stack); process.exitCode = 1; } };

await t("an empty project on its way: Close, not Cancel; Create aria-disabled and aria-busy as values; both back after", async () => {
  const D = await createDialog();
  let fail;
  D.api.createProject = () => new Promise((_, no) => { fail = no; });
  D.type("#cp-name", "Billing API");
  await D.submit();
  assert.equal(D.$("#cp-cancel").textContent, "Close");
  assert.equal(D.$("#cp-submit").getAttribute("aria-disabled"), "true");
  assert.equal(D.$("#cp-submit").getAttribute("aria-busy"), "true");
  assert.equal(D.$("#cp-submit").disabled, false, "aria-disabled, not disabled: Create keeps focus while it works");
  fail(Object.assign(new Error("No room."), { status: 500 })); await D.settle();
  assert.equal(D.$("#cp-cancel").textContent, "Cancel");
  assert.equal(D.$("#cp-submit").hasAttribute("aria-disabled"), false);
  assert.equal(D.$("#cp-submit").hasAttribute("aria-busy"), false);
  assert.equal(D.$("#cp-err").textContent, "No room.");
});

await t("a clone on its way says Close too, and Cancel once it has ended", async () => {
  const D = await createDialog();
  await D.press('[data-mode="clone"]');
  D.type("#cp-repo", "acme/site");
  await D.submit();
  assert.equal(D.$("#cp-cancel").textContent, "Close");
  await D.answer({ state: "failed", error: { code: "timed_out" } });
  assert.equal(D.$("#cp-cancel").textContent, "Cancel");
  assert.equal(D.$("#cp-err").textContent, "The clone stalled, so it stopped. Try again.");
});

await t("no ARIA state is written as a bare attribute anywhere", () => {
  const bare = sourcePaths(".js").flatMap((f) => [...readSource(f).matchAll(/toggleAttribute\(\s*["']aria-[\w-]+["']/g)].map((m) => `${f}: ${m[0]}`));
  assert.deepEqual(bare, [], "toggleAttribute leaves an ARIA state empty");
});
await t("the sidebar's current place says aria-current=\"page\"", () => {
  assert.match(readSource("js/app.js"), /if \(b\.classList\.contains\("is-on"\)\) b\.setAttribute\("aria-current", "page"\); else b\.removeAttribute\("aria-current"\);/);
});
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
process.exit();
