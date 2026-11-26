// On the Workspace, Changes' place in the panel is a Terminal holding the Workspace shell; elsewhere it is Changes.
import assert from "node:assert/strict";
import { stageFixture } from "./lib/stage-fixture.mjs";

const calls = [];
const shell = (on, host, where) => calls.push(on ? [true, host?.className, where] : [false]);
let ready = true;
const fx = await stageFixture({ place: (v) => v === "ws" || v.startsWith("p:"), shell, shellReady: () => ready });
const { panel, stage, visit } = fx;
const title = () => stage.querySelector('[data-fr="changes"] .fr-w').textContent;
const shown = () => !stage.querySelector('[data-fr="changes"]').hidden;

visit("p:one");
panel.open();
assert.equal(title(), "Changes");
assert.deepEqual(calls, [], "a project's panel opens no shell");

visit("ws");
assert.equal(title(), "Terminal");
assert.equal(shown(), true);
assert.deepEqual(calls.at(-1), [true, "fr-term", "ws"], "the Workspace shell mounts in the Terminal frame");
assert.equal(panel.isShell, true);
assert.equal(stage.querySelector("[data-stg-shell]").hidden, true, "no second shell button over the Terminal");
assert.equal(stage.querySelector('[data-fr="changes"]').classList.contains("is-grow"), true, "the Terminal takes the room");

panel.shellOff();
assert.deepEqual(calls.at(-1), [false]);
assert.match(stage.querySelector(".fr-term").innerHTML, /data-term-open/, "a closed shell leaves a way to open it again");
panel.sync();
assert.deepEqual(calls.at(-1), [false], "a closed shell is not reopened by a repaint");
stage.querySelector("[data-term-open]").click();
assert.deepEqual(calls.at(-1), [true, "fr-term", "ws"]);

visit("p:one");
assert.deepEqual(calls.at(-1), [false], "leaving the Workspace takes the shell out of the panel");
assert.equal(title(), "Changes");
assert.equal(panel.isShell, false);
assert.equal(stage.querySelector("[data-stg-shell]").hidden, false);

visit("ws");
panel.close();
assert.deepEqual(calls.at(-1), [false], "closing the panel takes the shell out");

ready = false;
panel.open();
assert.equal(shown(), false, "with shells off the Workspace has no Terminal frame");
console.log("panel-ws-terminal: ok");
