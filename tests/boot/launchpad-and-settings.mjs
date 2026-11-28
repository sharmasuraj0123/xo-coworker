// @ts-check
import {
  setImmediate, flushFrames, document, assert, storage, lastHomeVisit, checkSettingsPreferences,
  checkConversationFileRoutes, stream, encoder, window, runtimeWrites, heldRuntimes, deferred,
  heldRuntimeReads, runtimeList, settingsReads, earlyWorktreeReads, githubSignal, artifactsSignal, shellSignal,
  setHeldRuntimes, setSettingsStarted,
} from "./environment.mjs";
import {
  press, kernel,
} from "./startup-and-chats.mjs";
import {
  key, settings, settingsOpener,
} from "./navigation-and-overlays.mjs";
press("#nv-lp");
await new Promise(setImmediate);
flushFrames();
const launchpadAction = document.querySelector('#lpp [data-lpp-open="demo"]');
assert.ok(launchpadAction, "the overview draws the real project action");
const launchpadOverview = launchpadAction.closest("#lpp");
const removeOverviewListener = launchpadOverview.removeEventListener;
let overviewRetirements = 0;
launchpadOverview.removeEventListener = function (type, ...args) {
  if (type === "click") overviewRetirements++;
  return removeOverviewListener.call(this, type, ...args);
};
press('#lpp [data-lpp-open="demo"]');
const launchpadDialog = document.querySelector("#lq");
assert.equal(launchpadDialog.open, true, "the overview's action opens the production Launchpad dialog");
launchpadDialog.querySelector("[data-lq-close]").click();
press("#nv-home");

assert.ok(JSON.parse(storage.get("xo-seen")).home > lastHomeVisit, "Home records its visit in the app's Since store");
await checkSettingsPreferences(kernel, press);
await checkConversationFileRoutes(kernel, press, flushFrames, key, (path) => {
  const data = { project_id: "demo", kind: "create", path };
  stream.enqueue(encoder.encode(`event: file.version\ndata: ${JSON.stringify({ type: "file.version", data })}\n\n`));
});
{
  const timers = new Map();
  const realSet = globalThis.setTimeout, realClear = globalThis.clearTimeout;
  const runtimeHost = settings.querySelector('[data-page="runtimes"] .set-live');
  const remove = runtimeHost.removeEventListener;
  const removed = [];
  runtimeHost.removeEventListener = function (type, ...args) {
    removed.push(type);
    return remove.call(this, type, ...args);
  };
  globalThis.setTimeout = (fn, ms, ...args) => {
    const id = realSet(fn, ms, ...args);
    if (ms === 30_000) timers.set(id, () => { realClear(id); timers.delete(id); fn(...args); });
    return id;
  };
  globalThis.clearTimeout = (id) => { timers.delete(id); realClear(id); };
  const runtimePref = () => runtimeHost.querySelector("[data-rtd-pref]");
  const enter = () => new Promise(setImmediate);
  const writePref = (value) => {
    runtimePref().value = value;
    runtimePref().dispatchEvent(new window.Event("input", { bubbles: true }));
    runtimePref().dispatchEvent(new window.Event("focusout", { bubbles: true }));
  };
  try {
    settingsOpener.focus();
    press("#set-phone");
    press('#settings [data-set="runtimes"]');
    await enter();
    assert.equal(runtimeHost.querySelectorAll(".rt-card").length, 2, "boot mounts the real Runtimes page");
    assert.equal(timers.size, 1, "the real Settings page schedules one 30-second refresh");
    writePref("Use Codex for tests");
    await enter();
    assert.equal(runtimeWrites.length, 1);
    assert.equal(runtimeWrites[0].body.preferences, "Use Codex for tests");
    writePref("Retired draft");
    runtimePref().focus();
    await kernel.disable("xo.settings");
    assert.equal(kernel.live("xo.settings"), 0);
    assert.equal(runtimeHost.childElementCount, 0, "disabling Settings clears the actual Runtimes host");
    assert.equal(timers.size, 0, "disabling Settings cancels its queued refresh");
    assert.deepEqual(removed.filter((type) => ["click", "change", "input", "focusout"].includes(type)).sort(),
      ["change", "click", "focusout", "input"], "the retired controller removes all four delegated handlers");
    assert.ok(document.activeElement === settingsOpener, "disabling Runtimes returns focus to the Settings opener");
    assert.equal(runtimeWrites[0].signal.aborted, false, "an accepted preference write survives Settings retirement");

    assert.ok((await kernel.enable("xo.settings")).active.includes("xo.settings"));
    press("#set-phone");
    await enter();
    assert.equal(runtimeHost.querySelectorAll(".rt-card").length, 2, "re-enabling Settings mounts one Runtimes view");
    assert.notEqual(runtimePref().value, "Retired draft");
    runtimeWrites[0].response.resolve(runtimeWrites[0].body);
    await enter();
    await enter();
    assert.equal(runtimePref().value, "Use Codex for tests", "the new owner renders the accepted shared policy");
    assert.equal(runtimeHost.querySelector(".rt-saved"), null, "the retired controller paints no saved receipt");
    assert.equal(runtimeHost.querySelector('[data-rtd-fallback]').hasAttribute("aria-busy"), false);
    assert.equal(runtimeWrites.length, 1, "a retired preference draft never produces a second write");

    assert.equal(timers.size, 1);
    setHeldRuntimes(deferred());
    timers.values().next().value();
    await enter();
    assert.equal(heldRuntimeReads, 1, "the pending refresh reached Storm's real runtime route");
    await kernel.disable("xo.settings");
    const late = heldRuntimes;
    setHeldRuntimes(undefined);
    late.resolve(Response.json(runtimeList));
    await enter();
    assert.equal(runtimeHost.childElementCount, 0, "a refresh that settles after retirement paints nothing");
    assert.equal(timers.size, 0, "a refresh that settles after retirement schedules nothing");
    assert.ok((await kernel.enable("xo.settings")).active.includes("xo.settings"));
  } finally {
    runtimeHost.removeEventListener = remove;
    globalThis.setTimeout = realSet;
    globalThis.clearTimeout = realClear;
  }
}
setSettingsStarted(true);
press("#set-phone");
press('#settings [data-set="rules"]');
press('#settings [data-set="worktrees"]');
await new Promise(setImmediate);
const rules = settingsReads.get("rules");
const worktrees = settingsReads.get("worktrees");
assert.ok(rules && worktrees, "Settings opens Rules and Worktrees through the app");
assert.equal(earlyWorktreeReads.length, 0, "restoring a prior Home visit reads no worktree list: each thread carries its git state");
assert.ok(githubSignal, "the visible panel checks for the project's GitHub remote");
assert.ok(artifactsSignal, "the app reads project artifacts");
assert.ok(shellSignal, "the mounted Shells dock starts a cancellable status read");

export {
  launchpadAction, launchpadDialog, rules, worktrees, overviewRetirements,
  launchpadOverview, removeOverviewListener,
};
