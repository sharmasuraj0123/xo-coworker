import assert from "node:assert/strict";
import test from "node:test";
import { createScope } from "../core/kernel/scope.js";
import { dom } from "./lib/dom.mjs";

test("the live phone viewer leaves horizontal drags inside CodeMirror to the editor", async () => {
  const { document, window } = await dom(`
    <main id="main"><div id="conv"></div></main><div id="dock"></div>
    <div id="side"></div><div id="side-scrim"></div><div id="settings"></div>
    <section id="viewer"><header>File</header><div id="editor"></div></section>
    <div id="pn-stage"></div><div id="pn-foot"></div><div id="all-list"></div>
    <div id="scroller"><div id="msgs"></div></div><div id="runs-card"></div>
  `);
  Object.assign(globalThis, {
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
    getSelection: () => null,
    MutationObserver: window.MutationObserver,
    requestAnimationFrame: () => 1,
    cancelAnimationFrame() {},
    innerWidth: 400,
  });
  window.requestAnimationFrame = requestAnimationFrame;
  window.cancelAnimationFrame = cancelAnimationFrame;
  document.getSelection = () => null;
  document.hasFocus = () => false;
  const { mount } = await import("../modules/files/editor.js");
  const { wireGestures } = await import("../shell/gestures.js");
  const viewer = document.querySelector("#viewer");
  const editor = await mount(document.querySelector("#editor"), {
    docs: { textOf: () => "File contents", attach() {} },
    doc: { state: "readonly" },
    name: "notes.txt",
  });
  const scope = createScope();
  try {
    wireGestures({
      phone: () => true,
      viewerOpen: () => true,
      sheets: [],
    }, () => "", scope);
    const touch = (target, type, clientX) => {
      const event = new window.Event(type, { bubbles: true, cancelable: true });
      const points = [{ identifier: 1, clientX, clientY: 30 }];
      Object.defineProperties(event, { touches: { value: points }, targetTouches: { value: points }, changedTouches: { value: points } });
      target.dispatchEvent(event);
      return event.defaultPrevented;
    };
    const line = editor.view.contentDOM.querySelector(".cm-line");
    touch(line, "touchstart", 40);
    assert.equal(touch(line, "touchmove", 100), false, "the shell leaves the editor's drag alone");
    assert.equal(viewer.style.transform, "");
    touch(line, "touchcancel", 100);
    const header = viewer.querySelector("header");
    touch(header, "touchstart", 40);
    assert.equal(touch(header, "touchmove", 100), true, "viewer chrome still starts a navigation swipe");
    assert.equal(viewer.style.transform, "translateX(60px)");
    touch(header, "touchcancel", 100);
    assert.equal(viewer.style.transform, "");
  } finally {
    scope.dispose();
    editor.destroy();
  }
});
