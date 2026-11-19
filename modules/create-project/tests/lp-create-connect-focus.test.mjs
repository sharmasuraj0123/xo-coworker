// Connect GitHub lives in GitHub's line and in a failed clone's message; focus on either goes where Connect leads.
import assert from "node:assert/strict";
import { createDialog } from "./create-fixture.mjs";
import { same } from "../../../tests/lib/dom.mjs";

let passed = 0;
const t = async (name, fn) => { try { await fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.stack); process.exitCode = 1; } };
const CODE = { status: "code", user_code: "ABCD-1234", verification_uri: "https://github.com/login/device", session_id: "s1" };
/** A private repo's clone failed while GitHub isn't connected: its message offers Connect. */
async function refused() {
  const D = await createDialog();
  await D.press('[data-mode="clone"]');
  D.type("#cp-repo", "acme/private");
  await D.submit();
  await D.answer({ state: "failed", error: { code: "repo_not_found_or_private" } });
  return D;
}
const errConnect = (D) => D.$('#cp-err [data-cp="connect"]');
const ghConnect = (D) => D.$('#cp-gh [data-cp="connect"]');

await t("a failed clone's message offers Connect GitHub, the second place Connect lives", async () => {
  const D = await refused();
  assert.equal(D.$("#cp-err").textContent, "This repo is private, or doesn't exist. Connect GitHub");
  assert.equal(errConnect(D).textContent, "Connect GitHub");
  assert.ok(ghConnect(D), "and GitHub's own line has one");
});

await t("connected from the message's Connect: the message goes, and focus lands on the repository", async () => {
  const D = await refused();
  errConnect(D).focus();
  await D.press('#cp-err [data-cp="connect"]');
  assert.equal(D.$("#cp-err").hidden, true);
  same(document.activeElement, D.$("#cp-repo"));
  assert.equal(D.said.at(-1), "GitHub connected as ann.");
});

await t("a code, from either Connect: focus lands on Copy", async () => {
  for (const which of ["#cp-err", "#cp-gh"]) {
    const D = await refused();
    D.api.githubConnect = async () => CODE;
    D.$(`${which} [data-cp="connect"]`).focus();
    await D.press(`${which} [data-cp="connect"]`);
    same(document.activeElement, D.$('#cp-gh [data-cp="copy"]'), which);
  }
});

await t("a failure: the Connect you're on keeps focus, and GitHub's line offers Try again", async () => {
  const D = await refused();
  D.api.githubConnect = async () => { throw new Error("GitHub said no."); };
  errConnect(D).focus();
  await D.press('#cp-err [data-cp="connect"]');
  same(document.activeElement, errConnect(D), "still on the message's Connect");
  assert.equal(ghConnect(D).textContent, "Try again");
  const G = await refused();
  G.api.githubConnect = async () => { throw new Error("GitHub said no."); };
  const b = ghConnect(G);
  b.focus();
  await G.press('#cp-gh [data-cp="connect"]');
  same(document.activeElement, b, "the line's Connect is the same node, now Try again, and keeps focus");
  assert.equal(b.textContent, "Try again");
});

await t("focus that moved on while connecting stays where it went", async () => {
  const D = await refused();
  let answer;
  D.api.githubConnect = () => new Promise((ok) => { answer = ok; });
  errConnect(D).focus();
  await D.press('#cp-err [data-cp="connect"]');
  D.$("#cp-name").focus();
  answer({ status: "connected", username: "ann" }); await D.settle();
  same(document.activeElement, D.$("#cp-name"));
});
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
process.exit();
