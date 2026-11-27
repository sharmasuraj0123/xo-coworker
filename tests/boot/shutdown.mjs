// @ts-check
import {
  window, document, assert, setImmediate, outgoingPosts, stageLayoutObservers, mainFollowObservers,
  mainDecorationObservers, keyboardLayerObservers, heldStatusSignal, stormSignal,
  githubSignal, artifactsSignal, shellSignal, shellRelocationObservers, threadDockObservers,
  threadResolves, setTimeout, flushFrames, frames, shapeReads, stream, encoder, storage, createGithubSignal,
  createCloneSignal, lastHomeVisit, readFileSync, createCloneWrite, createGithubRead, initialShape,
  createClonePolls, shapeWrites, lateStatus, historyCalls, githubRead, connectorReplies,
  artifactsRead, shellStatus, audioAccess, setHeldStatusSignal, setPhone,
} from "./environment.mjs";
import {
  press, kernel, mainLatest, renderMarkdown, pictureMarkup, scrollPane, scrollContent,
} from "./startup-and-chats.mjs";
import {
  app, key, shortcuts, settings,
} from "./navigation-and-overlays.mjs";
import {
  mountedThreadObservers,
} from "./thread-and-runs.mjs";
import {
  launchpadAction, launchpadDialog, rules, worktrees, overviewRetirements, launchpadOverview,
  removeOverviewListener,
} from "./launchpad-and-settings.mjs";
const pagehide = (persisted) => window.dispatchEvent(Object.assign(new window.Event("pagehide"), { persisted }));
const failedFromStage = (/** @type {string} */ id) => {
  const button = `#stage .ag-r[data-go="t:${id}"]`;
  if (document.querySelector("#stage").hidden) press("[data-stage-toggle]");
  if (document.querySelector("#stage [data-stg-sections]")) press("#stage [data-stg-sections]");
  if (!document.querySelector(button)) {
    const done = document.querySelector('#stage [data-tg-fold="done"]');
    assert.ok(done, "Stage lists the project's finished and stopped threads");
    if (done.getAttribute("aria-expanded") === "false") done.click();
  }
  press(button, 1, "mouse", { metaKey: true });
  assert.equal(app.dataset.conv, `t:${id}`);
};
async function sendFromMain(/** @type {string} */ text) {
  const field = document.querySelector("#say");
  field.value = text;
  field.dispatchEvent(new window.Event("input", { bubbles: true }));
  field.closest("form").dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
  await new Promise(setImmediate);
  const post = outgoingPosts.get(text);
  assert.ok(post, `boot's composer sends "${text}"`);
  return post;
}
const shellDock = document.querySelector("#shd");
const shellGrip = shellDock.querySelector(".shd-grip");
const resizeShells = () => shellGrip.dispatchEvent(Object.assign(new window.Event("keydown", { cancelable: true }), { key: "ArrowUp" }));
assert.equal(resizeShells(), false, "the mounted Shells dock owns its keyboard resize");
const shellHeight = shellDock.style.getPropertyValue("--shd-h");
assert.equal(kernel.status("xo.settings"), "active");
const settingsOwners = ["xo.settings", "xo.rules", "xo.worktrees", "xo.routing"];
for (const id of settingsOwners) assert.ok(kernel.live(id) > 0, `${id} owns its Settings lifetime`);
for (const [id, place, host] of [
  ["map", "panel.frame", "#fr-body-map"],
  ["changes", "panel.frame", ".cx-host"],
  ["files", "panel.page", null],
]) {
  const owner = `xo.${id}`;
  assert.equal(kernel.places.get(place, id)?.owner, owner);
  await kernel.disable(owner);
  assert.equal(kernel.live(owner), 0);
  assert.equal(kernel.places.get(place, id), undefined);
  if (host) assert.equal(document.querySelector(host).childElementCount, 0, `${id} clears its permanent host`);
  assert.ok((await kernel.enable(owner)).active.includes(owner));
  assert.equal(kernel.places.entries(place).filter((entry) => entry.id === id).length, 1);
}
assert.equal(document.querySelectorAll(".cx-host .cx").length, 1, "Changes mounts exactly one replacement frame");
let filePickerClicks = 0;
document.querySelector("#att-input").addEventListener("click", () => { filePickerClicks++; });
press("#attach");
assert.equal(filePickerClicks, 1, "the mounted composer opens its file picker");
const mountedDockObservers = mountedThreadObservers();
assert.equal(stageLayoutObservers.size, 2, "Stage watches sidebar width and frame height independently");
assert.ok(document.querySelector("#conv > .mx-down") === mainLatest, "the boot decoration stays mounted");
assert.equal(mainFollowObservers.size, 1, "the main scroller owns one follow observer");
const mainDecoration = mainDecorationObservers.size;
assert.ok(mainDecoration > 0, "the mounted main decoration watches typing and messages");
assert.equal(keyboardLayerObservers.size, 1, "the keyboard layers observe modal visibility");
setHeldStatusSignal(null);
window.dispatchEvent(new window.Event("visibilitychange"));
await new Promise(setImmediate);
assert.ok(heldStatusSignal, "the mounted Storm starts a status read when visible again");
pagehide(true);
assert.equal(stormSignal.aborted || heldStatusSignal.aborted, false, "the page cache keeps the Storm stream and status read alive");
assert.equal(mainLatest.isConnected, true, "the page cache keeps the main conversation decoration");
assert.equal(mainDecorationObservers.size, mainDecoration);
assert.equal(mainFollowObservers.size, 1);
assert.equal(keyboardLayerObservers.size, 1);
launchpadAction.click();
assert.equal(launchpadDialog.open, true, "the page cache keeps Launchpad's overview and dialog active");
press("#attach");
assert.equal(filePickerClicks, 2, "the page cache keeps the composer control live");
assert.equal(rules.signal.aborted || worktrees.signal.aborted, false, "the page cache keeps both Settings readers live");
assert.equal(githubSignal.aborted, false, "the page cache keeps GitHub's read live");
assert.equal(artifactsSignal.aborted, false, "the page cache keeps the Artifacts read live");
assert.equal(shellSignal.aborted, false, "the page cache keeps the Shells poll live");
assert.equal(shellRelocationObservers.size, 1, "the page cache keeps the Stage Shells observer live");
assert.equal(threadDockObservers.size, mountedDockObservers.length);
assert.equal(stageLayoutObservers.size, 2, "the page cache keeps Stage layout observations");
assert.ok(mountedDockObservers.every((observer) => threadDockObservers.has(observer)), "the page cache keeps the mounted dock observations");
key("Escape");
press('#projects [data-go="p:demo"]');
failedFromStage("failed-thread");
const cachedPost = await sendFromMain("A cached reply");
const cachedBubble = [...document.querySelectorAll("#msgs .m-you")].find((row) => row.textContent.includes("A cached reply"));
assert.ok(cachedBubble?.hasAttribute("data-noswipe"), "the decorator still handles new messages after a persisted pagehide");
press('#top [data-resolve="failed-thread"]');
await new Promise(setImmediate);
assert.deepEqual(threadResolves.map(({ body }) => body), [{ resolved: true }]);
pagehide(true);
cachedPost.response.resolve(Response.json({ id: "cached-reply", seq: 40, text: "A cached reply" }));
await new Promise(setImmediate);
await new Promise((resolve) => setTimeout(resolve, 60));
flushFrames();
assert.equal(cachedPost.signal.aborted, false);
assert.match(document.querySelector("#live").textContent, /Sent to the thread/);
threadResolves[0].response.resolve(Response.json({ ts: threadResolves[0].thread, state: "resolved" }));
await new Promise(setImmediate);
await new Promise((resolve) => setTimeout(resolve, 60));
flushFrames();
assert.match(document.querySelector("#live").textContent, /Resolved Review the draft/);
assert.equal(document.querySelector('#top [data-resolve="failed-thread"]').dataset.to, "open");
assert.equal(threadResolves.length, 1, "the stopped thread needs only one Resolve");

press('#projects [data-go="p:demo"]');
failedFromStage("failed-late");
const latePost = await sendFromMain("An already issued reply");
const lateFailure = await sendFromMain("An already issued refusal");
press('#top [data-resolve="failed-late"]');
await new Promise(setImmediate);
assert.deepEqual(threadResolves.map(({ thread, body }) => [thread, body]), [
  ["failed-thread", { resolved: true }], ["failed-late", { resolved: true }],
]);
assert.ok(frames.size, "the live Resolve action has queued a render");
assert.equal(shapeReads, 1, "the real Shape read is still pending");
const shapeEvent = { data: { key: "ui.shape", value: { doc: { shape: 1, preset: "marketing" } } } };
stream.enqueue(encoder.encode(`event: settings\ndata: ${JSON.stringify(shapeEvent)}\n\n`));
await new Promise(setImmediate);
const storedShape = storage.get("cv-shape-mine");
const createForm = document.querySelector("#create-form");
assert.ok(createForm);
Object.assign(createForm, { reset() {} });
press("#side-add");
press('#cp-mode [data-mode="clone"]');
const cloneRepo = document.querySelector("#cp-repo");
assert.ok(cloneRepo instanceof window.HTMLInputElement);
cloneRepo.value = "example/fixture";
cloneRepo.dispatchEvent(new window.Event("input", { bubbles: true }));
createForm.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
await new Promise(setImmediate);
assert.equal(createGithubSignal?.aborted, false, "Create is reading GitHub before unload");
assert.equal(createCloneSignal?.aborted, false, "Create has sent the async clone write before unload");
const createProgress = document.querySelector("#cp-prog").innerHTML;
const createGithub = document.querySelector("#cp-gh").innerHTML;
storage.delete("xo-seen");
pagehide(false);
setPhone(true);
document.querySelector("#pb-menu").click();
assert.ok(!app.classList.contains("drawer"), "the retired phone drawer ignores its permanent menu button");
setPhone(false);
assert.ok(JSON.parse(storage.get("xo-seen") || "{}")["p:demo"] > lastHomeVisit, "Since records the active project before unload disposes it");
assert.equal(kernel.live("xo.thread-presentation"), 0);
assert.ok(kernel.modules().every(({ id }) => kernel.live(id) === 0), "permanent unload releases core and feature scopes");
assert.equal(createGithubSignal?.aborted, true, "real unload aborts Create's outstanding read");
assert.equal(createCloneSignal?.aborted, false, "real unload leaves the already issued clone write alone");
const cloneFixture = JSON.parse(readFileSync(new URL("../../core/platform/tests/fixtures/project-schedule-responses.json", import.meta.url)));
createCloneWrite.resolve(Response.json(cloneFixture.clone, { status: 202 }));
createGithubRead.resolve(Response.json({ status: "connected", username: "late-login" }));
initialShape.resolve(Response.json({ shape: null, version: "new" }));
await new Promise(setImmediate);
assert.equal(document.querySelector("#cp-prog").innerHTML, createProgress, "an accepted clone cannot publish progress after unload");
assert.equal(document.querySelector("#cp-gh").innerHTML, createGithub, "the retired GitHub read cannot redraw Create");
assert.equal(createClonePolls, 0, "an accepted clone cannot start polling after unload");
assert.equal(storage.get("cv-shape-mine"), storedShape, "a queued Shape event cannot write after permanent pagehide");
assert.deepEqual([shapeReads, shapeWrites], [1, 0], "the retired Shape event cannot start another request");
assert.equal(stormSignal.aborted && heldStatusSignal.aborted, true, "real unload retires the world and aborts its stream and held GET");
lateStatus.resolve(Response.json({ pools: [{ id: "retired-status" }] }));
assert.equal(mainLatest.isConnected, false, "unload destroys the booted main conversation decoration");
assert.equal(mainDecorationObservers.size, 0, "unload disconnects the main decoration observers");
assert.equal(mainFollowObservers.size, 0, "unload disconnects the main scroller's follower");
assert.equal(keyboardLayerObservers.size, 0, "unload disconnects the keyboard layer observer");
assert.doesNotMatch(renderMarkdown(pictureMarkup), /data-mx=/, "unload withdraws the conversation picture renderer");
const closeKeysButton = shortcuts.querySelector("[data-close]");
closeKeysButton.tabIndex = 0;
shortcuts.hidden = false;
closeKeysButton.click();
assert.equal(shortcuts.hidden, false, "retired Shortcuts releases its close button");
document.querySelector("#say").focus();
assert.equal(key("Tab").defaultPrevented, false, "the retired keyboard layers cannot trap Tab");
shortcuts.hidden = true;
const priorHistoryCalls = historyCalls.length;
window.history.replaceState(null, "");
window.dispatchEvent(new window.Event("popstate"));
assert.equal(historyCalls.length, priorHistoryCalls, "the retired Back listener cannot change browser history");
assert.equal(app.dataset.conv, "t:failed-late", "a retained popstate cannot leave the retired conversation");
const live = document.querySelector("#live");
const lastAnnouncement = live.textContent;
const lastNotice = document.querySelector("#herald").textContent;
app.dataset.conv = "unloaded";
flushFrames();
assert.equal(app.dataset.conv, "unloaded", "unload cancels a queued application render");
assert.equal(latePost.signal.aborted || lateFailure.signal.aborted || threadResolves[1].signal.aborted, false,
  "already-issued writes finish independently of the page lifetime");
latePost.response.resolve(Response.json({ id: "late-reply", seq: 41, text: "A late reply" }));
lateFailure.response.resolve(Response.json({ message: "Late refusal" }, { status: 503 }));
threadResolves[1].response.resolve(Response.json({ ts: threadResolves[1].thread, state: "resolved" }));
await new Promise(setImmediate);
await new Promise((resolve) => setTimeout(resolve, 1700));
flushFrames();
assert.equal(live.textContent, lastAnnouncement, "late writes do not announce in the retired app");
assert.equal(document.querySelector("#herald").textContent, lastNotice, "late writes do not replace a retired notice");
assert.equal(app.dataset.conv, "unloaded", "late writes do not render");
assert.equal(threadResolves.length, 2, "each Resolve write is sent exactly once");
assert.equal(overviewRetirements, 1, "unloading releases the Launchpad overview click listener");
launchpadOverview.removeEventListener = removeOverviewListener;
assert.equal(launchpadDialog.isConnected, false, "unloading removes the Launchpad dialog");
assert.equal(launchpadDialog.open, false);
launchpadAction.click();
assert.equal(launchpadDialog.open, false, "the retained overview cannot reopen its retired dialog");
press("#attach");
assert.equal(filePickerClicks, 2, "unloading releases the retained composer control");
for (const id of settingsOwners) assert.equal(kernel.live(id), 0, `${id} disposed through the app`);
assert.equal(rules.signal.aborted, true, "unloading aborts Rules through the app");
assert.equal(worktrees.signal.aborted, true, "unloading aborts Worktrees through the app");
assert.equal(kernel.live("xo.since"), 0, "unload removes the Since module effects");
assert.equal(kernel.places.get("home.section", "hm-since"), undefined, "unload removes Since from Home");
assert.equal(githubSignal.aborted, true, "unloading aborts GitHub through the app");
assert.equal(artifactsSignal.aborted, true, "unloading aborts Artifacts through the app");
assert.equal(kernel.live("xo.artifacts"), 0, "unload removes the Artifacts module effects");
assert.equal(kernel.live("xo.runs"), 0, "unload removes the Runs module effects");
assert.equal(shellSignal.aborted, true, "unloading aborts the Shells poll through the app");
assert.equal(shellRelocationObservers.size, 0, "unloading releases the Stage Shells observer");
assert.equal(threadDockObservers.size, 0, "unloading releases the mounted thread dock observations");
assert.equal(stageLayoutObservers.size, 0, "unloading releases both Stage layout observations");
assert.equal(resizeShells(), true, "the retained Shells grip has no listener after teardown");
assert.equal(shellDock.style.getPropertyValue("--shd-h"), shellHeight);
document.body.append(scrollPane);
scrollContent.focus();
flushFrames();
assert.equal(scrollPane.querySelectorAll(".region-ring").length, 0, "the unloaded app no longer draws a ring");
scrollPane.remove();
const rulesPage = settings.querySelector('[data-page="rules"]');
const worktreesPage = settings.querySelector('[data-page="worktrees"]');
const displayed = [rulesPage.textContent, worktreesPage.textContent];
rules.response.resolve(Response.json({ rules: [{ id: "late", sentence: "Late rule" }] }));
worktrees.response.resolve(Response.json({ worktrees: [] }));
const terminalReplies = JSON.parse(readFileSync(new URL("../../core/platform/tests/fixtures/terminal-responses.json", import.meta.url)));
githubRead.resolve(Response.json({ ...connectorReplies.issues, issues: [{ ...connectorReplies.issues.issues[0], title: "Late issue" }] }));
artifactsRead.resolve(Response.json({ made: [{ id: "late", name: "Late artifact", relative_path: "late.txt" }] }));
shellStatus.resolve(Response.json(terminalReplies.status));
await new Promise(setImmediate);
assert.deepEqual([rulesPage.textContent, worktreesPage.textContent], displayed, "pending replies leave the unloaded pages alone");
storage.delete("xo-seen");
pagehide(false);
assert.equal(storage.has("xo-seen"), false, "Since removes its visit listener after unload");
assert.deepEqual(audioAccess, [], "boot, conversation actions, decisions and shutdown leave audio APIs untouched");
assert.equal(storage.get("cv-sound"), "on", "the retired preference is harmless on an existing device");
