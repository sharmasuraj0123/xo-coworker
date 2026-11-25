// @ts-check
import {
  document, window, assert, stream, encoder, flushFrames, setTimeout, setImmediate, catalogSignal,
  lateCatalog, clipboard,
} from "./environment.mjs";
import {
  press, renderMarkdown, kernel, copyMessage, touch,
} from "./startup-and-chats.mjs";
import {
  key,
} from "./navigation-and-overlays.mjs";
const picker = document.querySelector("#iq-pop");
const dropVeil = document.querySelector("#drop-veil");
const uploads = [];
globalThis.XMLHttpRequest = class {
  upload = {};
  open(/** @type {string} */ _method, /** @type {string} */ url) { this.url = url; }
  setRequestHeader() {}
  send() { uploads.push(this.url); }
  abort() { this.onabort?.(); }
};
function dropFile(/** @type {Element} */ target, /** @type {string} */ name) {
  const file = new File(["notes"], name, { type: "text/plain" });
  const dataTransfer = { types: ["Files"], files: [file] };
  const drag = (type) => target.dispatchEvent(Object.assign(new window.Event(type, { bubbles: true, cancelable: true }), { dataTransfer }));
  drag("dragenter");
  assert.equal(dropVeil.hidden, false, "dragging a file over the composer opens the shared veil");
  drag("drop");
  assert.equal(dropVeil.hidden, true, "a drop dismisses the veil");
}
function togglePicker(selector) {
  const chip = document.querySelector(selector);
  chip.focus();
  press(selector);
  assert.equal(picker.hidden, false);
  assert.equal(chip.getAttribute("aria-expanded"), "true");
  assert.ok(document.activeElement === picker);
  press(selector);
  assert.equal(picker.hidden, true);
  assert.equal(chip.getAttribute("aria-expanded"), "false");
  assert.ok(document.activeElement === chip);
}
togglePicker("#iq");
dropFile(document.querySelector("#say"), "main.txt");
assert.match(document.querySelector("#att-tray").textContent, /main\.txt/);
const runningTurn = {
  type: "turn.started", seq: 2, session_id: "boot-session", thread_ts: "boot-thread",
  chat_id: "project-chat", turn_id: "boot-turn", ts: new Date().toISOString(), data: { origin: "person" },
};
stream.enqueue(encoder.encode(`id: 2\nevent: turn.started\ndata: ${JSON.stringify(runningTurn)}\n\n`));
const runningSession = { type: "session", seq: 3, session_id: "boot-session", data: { status: "running" } };
stream.enqueue(encoder.encode(`id: 3\nevent: session\ndata: ${JSON.stringify(runningSession)}\n\n`));
press('#projects [data-go="p:catalog-test"]');
press("[data-stage-toggle]", 1, "touch");
press('#stage .ag-r[data-go="t:catalog-origin"]', 1, "touch");
flushFrames();
await new Promise((resolve) => setTimeout(resolve, 0));
await new Promise(setImmediate);
flushFrames();
assert.ok(catalogSignal && !catalogSignal.aborted, "opening the Claude thread warms its catalog without opening the picker");
press("#stage [data-stg-sections]", 1, "touch");
press('#stage .ag-r[data-go="t:cmsg_catalog_next"]', 1, "touch");
flushFrames();
await new Promise((resolve) => setTimeout(resolve, 0));
await new Promise(setImmediate);
flushFrames();
assert.doesNotMatch(renderMarkdown("[Next](#cmsg_catalog_next)"), /is-unknown/, "Markdown links resolve the mounted thread presentation");
const nextModelChip = document.querySelector("#tiq");
const typing = document.querySelector("#ttyping");
typing.insertAdjacentHTML("beforeend", '<span class="stale-typing"></span>');
delete typing.dataset.typingKey;
kernel.bus.emit("app:render");
flushFrames();
assert.ok(!typing.querySelector(".stale-typing"), "the live thread transcript refreshes its typing line");
assert.match(nextModelChip.textContent, /held-model/, "the next composer shows its own unresolved model");
lateCatalog.resolve(Response.json({ models: [{ id: "held-model", name: "Late Claude catalog" }] }));
await new Promise(setImmediate);
flushFrames();
assert.match(document.querySelector("#tiq").textContent, /held-model/, "retired catalog cannot rename the next composer model");
assert.equal(catalogSignal.aborted, true, "the composer transition aborts the retired catalog request");
press("[data-stage-toggle]", 1, "touch");
press('#projects [data-go="p:demo"]');
press("[data-stage-toggle]", 1, "touch");
const panelThread = '#stage .ag-r[data-go="t:boot-thread"]';
for (const [detail, pointerType, expected, downType] of [
  [1, "touch", "[data-page-heading]"], [1, "mouse", "#tsay"], [0, "", "#tsay"], [1, "", "[data-page-heading]", "touch"],
]) {
  if (downType) {
    const icon = document.querySelector(panelThread).firstElementChild;
    icon.dispatchEvent(Object.assign(new window.Event("pointerdown", { bubbles: true }), { pointerType: downType }));
  }
  press(panelThread, detail, pointerType);
  const heading = document.querySelector("#stage [data-page-heading]");
  assert.equal(heading.textContent, "Thread from the panel");
  assert.equal(heading.getAttribute("role"), "heading");
  assert.equal(heading.getAttribute("tabindex"), "-1");
  const input = downType ? "touch pointerdown followed by a click without pointerType" : pointerType || "keyboard";
  assert.ok(document.activeElement === document.querySelector("#stage " + expected), input);
  if (pointerType === "mouse") {
    togglePicker("#tiq");
    const reply = document.querySelector("#tsay");
    const replyNotice = document.querySelector("#tpherald");
    assert.equal(reply.getAttribute("aria-controls"), "tat-list");
    assert.equal(document.querySelector("#tat-list").getAttribute("role"), "listbox");
    assert.equal(document.querySelector("#ttarget").tagName, "BUTTON");
    assert.equal(replyNotice.getAttribute("aria-live"), "polite");
    assert.ok(reply.closest("#tpdock").contains(replyNotice));
    dropFile(replyNotice, "panel.txt");
    assert.match(document.querySelector("#tatt-tray").textContent, /panel\.txt/);
    assert.doesNotMatch(document.querySelector("#att-tray").textContent, /panel\.txt/);
    assert.deepEqual(uploads.map((url) => new URL(url, location.href).searchParams.get("name")), ["main.txt", "panel.txt"]);
    assert.ok(document.activeElement === reply, "the drop returns focus to its own reply");
    heading.focus();
    assert.equal(key("/").defaultPrevented, true);
    assert.ok(document.activeElement === reply, "Write targets the open panel conversation on a phone");
    assert.equal(key(".", { metaKey: true }).defaultPrevented, true);
    assert.equal(document.querySelector("#tiq").getAttribute("aria-expanded"), "true");
    assert.equal(document.querySelector("#iq").getAttribute("aria-expanded"), "false");
    key("Escape");

    const messages = document.querySelector("#stage #tmsgs");
    const interrupt = "#stage #tmsgs [data-interrupt]";
    for (let attempt = 0; attempt < 30 && !document.querySelector(interrupt); attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 10));
      flushFrames();
    }
    assert.ok(document.querySelector(interrupt), `the queued reply to a running turn offers Interrupt: ${messages.textContent}`);
    document.querySelector(interrupt).focus();
    press(interrupt);
    flushFrames();
    const undoInterrupt = "#tpherald [data-herald-undo]";
    assert.ok(document.querySelector(undoInterrupt), "Interrupt draws Undo in the panel notice line");
    assert.ok(document.activeElement === document.querySelector(undoInterrupt), "Interrupt focuses the panel's Undo");
    assert.ok(!document.querySelector("#herald [data-herald-undo]"), "the main notice line stays clear");
    press(undoInterrupt);
    flushFrames();
    assert.ok(!document.querySelector(undoInterrupt), "Undo clears the panel notice");
    assert.ok(document.activeElement === document.querySelector(interrupt) || document.activeElement === reply,
      "Undo returns to a control in the same thread conversation");

    const panelReview = {
      type: "review.opened", seq: 5, chat_id: "project-chat", thread_ts: "boot-thread",
      data: {
        id: "panel-review", kind: "permission", risk: "routine", thread_ts: "boot-thread", chat_id: "project-chat",
        title: "Read the project notes", detail: { command: "cat README.md" },
        options: [{ id: "once", decision: "allow", label: "Allow once", scope: "once" }],
      },
    };
    stream.enqueue(encoder.encode(`id: 5\nevent: review.opened\ndata: ${JSON.stringify(panelReview)}\n\n`));
    const allow = '#tptdock [data-act="allow"]';
    for (let attempt = 0; attempt < 30 && !document.querySelector(allow); attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 10));
      flushFrames();
    }
    const allowButton = document.querySelector(allow);
    assert.ok(allowButton, "the review opens in the thread's own decision dock");
    for (const host of ["#herald", "#tmsgs"]) {
      const action = document.createElement("button");
      action.dataset.decide = "panel-review";
      document.querySelector(host).append(action);
      action.click();
      assert.ok(!document.querySelector("#panel").hidden, host + " dispatches the shared decision action");
      press("#pn-x");
      await new Promise((resolve) => setTimeout(resolve, 0));
      action.remove();
    }
    const { READ_MS } = await import("../../modules/decisions/kit.js");
    await new Promise((resolve) => setTimeout(resolve, READ_MS));
    allowButton.focus();
    press(allow);
    const undoDecision = "#tptdock [data-dock-undo]";
    assert.ok(document.querySelector(undoDecision), "Allow leaves an Undo receipt in the thread dock");
    assert.ok(document.activeElement === document.querySelector(undoDecision), "the decision receipt gets focus");
    press(undoDecision);
    await Promise.resolve();
    await Promise.resolve();
    assert.ok(!document.querySelector(undoDecision), "app decision Undo immediately clears the panel receipt");
    assert.ok(document.querySelector(allow), "the original decision returns to the panel dock");
    stream.enqueue(encoder.encode('id: 6\nevent: review.decided\ndata: {"type":"review.decided","seq":6,"data":{"id":"panel-review"}}\n\n'));
    await new Promise(setImmediate);
    flushFrames();

    const panelMessage = document.createElement("div");
    panelMessage.className = "m-them";
    panelMessage.innerHTML = '<div class="mb"><div class="prose"><p>Panel reply</p></div></div>';
    messages.append(panelMessage);
    copyMessage(panelMessage.querySelector("p"));
    assert.equal(clipboard.at(-1), "Panel reply", "long-press Copy uses the panel conversation's words");
    panelMessage.remove();
    reply.value = "Kept while typing";
    reply.focus();
    messages.dispatchEvent(touch("touchstart", 50, 50));
    messages.dispatchEvent(touch("touchmove", 52, 100));
    assert.ok(document.activeElement !== reply, "a downward drag leaves the reply field");
    assert.equal(reply.value, "Kept while typing", "lowering the keyboard keeps the reply");
  }
  press("#stage [data-stg-sections]", detail, pointerType);
}
press(panelThread, 1, "touch");

export {
  panelThread, picker,
};
