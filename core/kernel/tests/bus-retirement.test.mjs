import assert from "node:assert/strict";
import { createBus } from "../bus.js";

const bus = createBus();
const first = bus.on("app:render", () => assert.fail("retired listener"));
first();
let calls = 0;
const next = bus.on("app:render", () => calls++);
first();
bus.emit("app:render");
assert.equal(calls, 1);
next();
bus.emit("app:render");
assert.equal(calls, 1);
