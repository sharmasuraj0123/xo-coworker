import assert from "node:assert/strict";
import test from "node:test";
import { createFailureSurface } from "../failure.js";

test("one burst presents plain words and counted, bounded details", () => {
  const frames = [], notices = [];
  let time = 0;
  const surface = createFailureSurface(notice => notices.push(notice), fn => frames.push(fn), () => time);
  for (let i = 0; i < 100; i++) surface.report("Cannot read 'x'", "xo.map");
  assert.equal(frames.length, 1);
  frames.shift()();
  assert.deepEqual(notices[0], { text: "Map couldn’t start. (100 reports)", details: "xo.map: Cannot read 'x' (×100)" });
  for (let i = 0; i < 20; i++) surface.report("Read " + i, "Application error");
  frames.shift()();
  assert.equal(notices[1].text, "Something went wrong in the app. (120 reports)");
  assert.equal(notices[1].details.split("\n").length, 9);
  assert.match(notices[1].details, /13 additional reports$/);
  time += 30000;
  surface.report(null, "Startup failed");
  frames.shift()();
  assert.deepEqual(notices[2], { text: "Something went wrong in the app.", details: "Startup failed: No further details were provided." });
});

test("cancelled operations and browser layout notifications stay quiet", () => {
  const notices = [];
  const surface = createFailureSurface(notice => notices.push(notice), fn => fn());
  surface.report(new DOMException("Request cancelled", "AbortError"), "Application error");
  surface.report({ name: "AbortError", message: "Navigation" }, "Application error");
  surface.report("ResizeObserver loop limit exceeded", "Application error");
  surface.report("ResizeObserver loop completed with undelivered notifications.", "Application error");
  assert.equal(notices.length, 0);
  surface.report("ResizeObserver callback failed", "Application error");
  assert.equal(notices.length, 1);
});

test("one broken listener on many topics retains a bounded stack and one diagnostic slot", () => {
  let notice;
  const surface = createFailureSurface(next => { notice = next; }, fn => fn());
  const fault = new Error("Read failed");
  fault.stack = "Error: Read failed\n    at render\n" + "x".repeat(4000);
  for (let i = 0; i < 30; i++) surface.report(fault, { module: "bus", phase: "listener", subject: "topic-" + i });
  assert.equal(notice.text, "Something went wrong in the app. (30 reports)");
  assert.equal(notice.details, "bus / listener / topic-0: Read failed (×30)\n" + fault.stack.slice(0, 2048));
});
