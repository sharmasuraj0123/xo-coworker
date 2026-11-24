// @ts-check
import assert from "node:assert/strict";
import { createMapAgents } from "../agents.js";
import { createMapHead } from "../head.js";

const world = { state: { threads: [], projects: [] }, act: {}, project: () => ({ name: "Operations & support" }) };
const { agentOf, doingLine, verbOf } = createMapAgents({ world, isBusy: () => false, stepLineHtml: (line) => line });
const head = createMapHead(world, doingLine, verbOf);
const thread = { id: "one", title: "<Debug>", project: "project", state: "working", branch: "test&verify", held: { for: "memory" } };
const agent = agentOf(thread);
const branch = head({ kind: "thread", t: thread, fold: { project: "project", base: ".xo/worktrees/work" } }, [agent]);
assert.match(branch, /id="mp-h">&lt;Debug&gt;<\/h2>/);
assert.match(branch, /test&amp;verify<\/code>.*its own worktree/);
assert.match(branch, /st-wait.*Waiting for memory to free up/);
const project = head({ kind: "project", pid: "project" }, [agent]);
assert.match(project, /Operations &amp; support/);
assert.match(project, /1 agent at work/);
assert.match(project, /data-mp-focus="one".*waiting/);
