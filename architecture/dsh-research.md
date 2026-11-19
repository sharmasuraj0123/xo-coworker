# What XO can take from the DeepSeek Harness (dsh) to scale

Research, 2026-11-19. Nothing was built. The owner asked: *"deeply research deepseek-harness … what can we take away from them to scale our xo-coworker further and add more systems and features"*, and then *"research their codebase style as well"*.

- **Sources:** all 49 pages of the DeepWiki for `deepseek-ai/deepseek-harness`, read in full (845 KB, fetched through DeepWiki's public read endpoint on 19 Nov). Also a shallow clone of the repo, read only and never run (§5), and the earlier note of 3 Nov (`research/deepseek-harness.md` in thread 82a5cb's worktree), which covered dsh's surfaces and Web UI at feature level. That ground is not repeated here.
- **dsh today:** `dsh-v0.2.2-rc.5`, published 2026-11-18. It is MIT-licensed and iterates every few days, with breaking changes announced in versioned upgrade guides.
- **XO today:** read from `/opt/xo-space` (read only) and this repo at `08e42fd`.
- **A caution about the wiki:** DeepWiki is machine-generated. Pages 3.6 (compaction), 4.5 (SSH), 7.3 (workflows) and 7.5 (inspector) cite little real code, and 4.3 contradicts itself on Linux sandbox order. Those pages are marked *thin* where they are used below.

---

## 1. The one thing to understand first

**dsh is a harness: it runs the model loop itself.** It calls the LLM, executes tools, compacts context and stores the session. **XO sits one layer up.** It runs other harnesses (Claude Code, Codex, Antigravity) as sessions and coordinates many of them: a coordinator, threads in worktrees, asks, jobs, records.

So about half of dsh is work XO should *not* do, because the CLIs XO hosts already do it (see §3). The other half is about running many agents and a UI around them, and that half is very relevant.

The comparison also flatters XO's backend. On several systems xo-space is already at or beyond dsh:

| System | dsh | XO today |
|---|---|---|
| Durable log + replay | Append-only `SessionEvent` log, format v4, JSONL/SQLite, projections | `~/.quirq/engine/xo.db`: `events` with seq, replay pages that fold turns identically (`storm/stream/replay.py`), schema v6 with migrations, a daily retention prune, boot recovery |
| Auditable records | Not described | Hash-chained `ledger` over intents, goals, tasks, results, timers and leases, with `verify` (`storm/records/`) |
| Sub-agent tree | `ctx.subagents`, settlement injected into the parent | `runs` table, run tree per session, live counters, transcript, stop one (`storm/runs/`). Threads report through `report`/`submit_result` and the coordinator's `<since-last-turn>` digest |
| Wrapping Claude Code / Codex | `subagent-claude-code`, `subagent-codex` | A runtime contract (`adapters/contract.py`, 67 types, additive versioning), three runtimes, conformance tests against fake CLIs |
| Stopping work | Per-turn AbortController, dispose ladder | `control/`: halt = interrupt, release, then a pidfd sweep of every process carrying the session's marker |
| Approvals | `tools/pre-execute` allow/deny/ask | `storm/review/`: shlex-based policy that refuses what it can't read, tiers, rules and protected paths, plus a bypass corpus |
| Usage and cost | Token counts only, no cost | Per-turn `usage`, `cost_usd`, `wall_ms`, `steps`, `tool_calls`, `peak_rss_kb`; account pools from the advisory |
| Memory pressure | Not described | Memory guard on cgroup headroom and PSI before each new CLI process (`storm/engine/memory.py`) |
| Schedules | `after/at/every` reminders | Timers, jobs, leases and wakes on events (`storm/timers.py`, `storm/jobs/`) |
| Browser trust fence | Host/Origin/sec-fetch then cookie | `serve.py`: Host check (421), same-origin (403), secret routes never forwarded |

The gaps are mostly in **three places**:

- **the frontend's structure:** how features plug into the UI;
- **the thread lifecycle and search** the owner sees;
- **isolation and test machinery.**

---

## 2. Ranked: what to take

Ranking weighs user value against size, and favours what unblocks the owner's current asks: the threads redesign, a scalable left panel, a Shell button on the right, and working search.

Sizes: **S** = a thread in 1–2 days · **M** = about a week · **L** = several weeks.

### 1. A slot registry for the UI: features plug in, the shell stays small
- **In dsh:** every UI feature is its own package that *registers* into named slots. A generated, typed catalog (`cordis-client-runner/src/client/slot-catalog.ts`) gives each slot a cardinality and a scope:
  - cardinalities: `single`, `list`, `keyed` or `chain`;
  - scopes: `root`, `session` or `session-maybe`.

  Examples:
  - The chat is one entry in the `conversation.view` list.
  - Approvals and questions take over the composer by being the top entry in the `conversation.composer` *chain*, and dispose to give the composer back.
  - Tool cards are `keyed` by tool name, with a generic fallback.
  - Session-row actions, settings sections and onboarding steps are slots too.
  - The right sidebar is a generic dock kit (tabs, floating windows, edge recovery) seeded with default tabs. (Wiki 6.0–6.4.)
- **XO now:** `js/app.js` is 4,279 lines and wires most surfaces by hand. The right panel's frames (`js/stage.js`), the sidebar entries and the composer's above-row are fixed lists. Shape (`js/shape.js`) can hide things by flag but can't add them.
- **Gap:** there is no registration point, so every new panel or button edits the shell. That is where regressions and "sloppy" diffs come from.
- **User value:** the owner's asks become *adding entries*, not rewiring the app:
  - threads in the right panel;
  - a Shell button there;
  - a left rail that collapses and has room for more options;
  - icon-only Settings.

  New features stop breaking old ones, and the left panel scales because its top is a list anyone can register into.
- **Size:** M for the registry plus three slots: right-panel frames, left-rail entries, composer chain. Then migrate surfaces one at a time.
- **Lands in:** frontend.
- **Concrete numbers the design thread can borrow from dsh's left sidebar:**
  - 260 px wide;
  - collapse in two steps: freeze the width and fade the content over 150 ms, then snap to a 56 px icon rail with a 36 px control column, so text never reflows mid-animation.

### 2. A thread lifecycle and a list that scales: archive, delete, branch from here, real search
- **In dsh:**
  - **Row actions:** rename, fork and archive on every session row, plus slots for more.
  - **Branching:** fork copies the log up to an inclusive event, closes any open turn, and writes error results for tool calls left dangling, so the copy starts consistent (wiki 3.3).
  - **Archiving:** with Forge, archiving reclaims clean, unreferenced worktrees but keeps the branch (7.5).
  - **The list scales without virtualisation:**
    - each group shows 5 rows;
    - the count rises automatically to cover running, unread or needs-you rows, up to 50;
    - "Last updated" order counts only the person's prompts and steers, so the list doesn't reshuffle while agents work (6.2).
  - **Search is hybrid:** title matches appear instantly in the browser, and a 250 ms-debounced server search adds content matches with snippets. The server side uses SQLite FTS5 over the event corpus (3.3, 6.2).
- **XO now:**
  - A thread can be resolved; there was no delete route when this was written (update, 19 Nov 14:39: xo-space added thread delete — soft, undoable, branch kept — in `storm/chats/deletion.py`, `DELETE /api/chat/chats/{chat_id}/threads/{ts}`) (`routers/cowork_agent/storm/chats.py`).
  - `continue_thread` moves work to a new thread on another runtime (`storm/chats/continuation.py`).
  - The runtime contract already carries `fork` and `fork_at` (`storm/engine/session.py`).
  - "All threads" filters by state and title. There is no server-side search of what was said.
- **Gap:**
  - delete and archive, with worktree cleanup that keeps the branch;
  - "Branch from here" on a message;
  - full-text search across threads;
  - list rules that keep what needs you visible.
- **User value:**
  - Find anything said in any thread.
  - Clear out dead threads without losing their code.
  - Try a different approach from any point without re-briefing.

  This is the Claude-style thread menu the owner showed (Rename, Pin, Resolve, Delete) plus search that works.
- **Size:** M (search: FTS5 table and route, S–M; archive/delete: S–M; branch from here: M, since the contract has the field).
- **Lands in:** both.

### 3. UI tests that run in minutes: recorded runs, seeded history, text snapshots
- **In dsh** (8.1–8.2):
  - **Seeded history:** browser tests boot the *real* app on port 0 with a temporary data folder. History is seeded through the real persistence API, so most UI suites render from a log with **no model calls**.
  - **Replay:** live turns replay recorded model traffic, and a test fails if any recorded response goes unused. Background model chores (title generation, instructions) are switched off so they can't race the replay.
  - **Waiting:** each test waits on the host's turn-end signal, then until `[data-streaming]` is gone. Fixed sleeps and `networkidle` are banned.
  - **Assertions:** they compare **accessibility-tree text goldens** (`*.expected.md`), not pixels. These are theme- and DPR-independent, and the diffs can be reviewed.
- **XO now:** browser suites take 20–40+ minutes and Chromium dies around 20 minutes in. The owner has paused browser tests until asked. xo-space already has fake CLIs and golden surfaces (`tests/fakes/`, `tests/test_frozen_surfaces.py`), but the frontend's browser lane doesn't use seeded stores or text goldens.
- **Gap:** a fast, deterministic UI lane.
- **User value:** changes get checked in minutes without exhausting the machine, and fewer regressions reach the owner. That is the honest fix for "sloppy".
- **Size:** M (a seeded `xo.db` fixture plus the fake CLI, a settle barrier, an ARIA-snapshot helper, then port suites one at a time).
- **Lands in:** frontend, using xo-space's existing fakes.

### 4. Hard walls around each thread: OS sandbox and process containment
- **In dsh** (4.2–4.3):
  - **The sandbox is an argv wrapper:** `confine(argv, policy)` with modes `read-only`, `workspace-write` and `danger-full-access`.
    - On Linux it uses bubblewrap, or the native `landlock-run`, which exits 125 when the *sandbox* failed so that is never confused with the command failing.
    - Setup probes fail closed.
    - An approval seam lets the person widen access and the agent retry.
  - **Containment:** every job runs in a transient systemd user scope (a cgroup), so killing it kills its whole tree.
  - **Output:** kept as a tail buffer plus a private spill file (dir 0700, files 0600) that turns itself off on disk errors instead of crashing the host.
  - **Not covered by dsh either:** network access is not restricted, and secrets get only environment scrubbing.
- **XO now:**
  - No session runs inside a sandbox. Both adapters report it: Claude's support table says `permissions.sandbox` is unsupported because it "needs bubblewrap", and the Codex wire treats the bubblewrap warning as expected (`adapters/claude_code/runtime/support.py:198`, `adapters/codex/runtime/wire.py:123`).
  - Safety rests on the policy reader (`storm/review/`), which is careful but is still parsing text.
  - Processes are swept only at halt.
- **Gap:** nothing at the kernel level stops a thread from writing outside its worktree, or a dev server it started from outliving it.
- **User value:**
  - Threads can run longer without asking, because the wall is real.
  - One thread can't damage another's worktree or the project folder.
  - Orphaned servers stop eating memory, which is tight on this box (browser runs have already OOM'd it).
- **Size:** M for the cheap path: install bubblewrap in the image and switch on the CLIs' *own* sandboxes (`workspace-write`), which both CLIs support natively. Add a systemd scope per thread, and sweep when a thread resolves. L for an XO-owned confine layer.
- **Lands in:** xo-space (plus image).

### 5. A run inspector: one table per thread of what happened, how long and what it cost
- **In dsh** (6.3): the Trajectory tab turns the log into a turn-aware, **virtualised** table.
  - Row kinds: user, context, compacted, message, tool and subtool.
  - Selecting a row opens a split inspector with raw JSON, timing, diff and schema.
  - It stays cheap on long sessions because folding and search run only on the visible window, while counters cover the whole session.
  - Each request also logs its exact resolved model and config (`request/header`), so replay is stable (3.1).
- **XO now:** the data is mostly there:
  - `turns` rows have `usage`, `cost_usd`, `wall_ms`, `wait_person_ms`, `steps`, `tool_calls`, `peak_rss_kb` and `rate_limit`;
  - raw turn logs are kept for 14 days;
  - run transcripts and an OpenTelemetry exporter exist.

  The UI folds work into blocks (`js/turnview.js`) but has no ledger view.
- **Gap:** a screen that answers "why was this thread slow or expensive, and what exactly did it run with". Each turn's resolved model and effort should be on the record too.
- **User value:**
  - You can see where the time and money went.
  - Comparing runtimes becomes fair.
  - Debugging a bad thread takes minutes.
- **Size:** M.
- **Lands in:** both (a small read route; mostly frontend).

### 6. Speed budgets that catch slow growth
- **In dsh** (8.4): benchmarks run on built code, with a fresh process per sample and forced GC around heap readings. Budgets are **medians**. Examples:
  - opening a 127,400-event session: about 550 ms on first open (with migration), 63 ms after;
  - long-session browser run: 1,125 ms to open, 2,750 ms to the first reply;
  - conversation fold: 40 ms.

  There is also a **scaling-ratio budget**: the fold may grow at most 3.125× from small to large history, which catches O(n²) slips that are fast on small inputs.
- **XO now:** `tests/design-budget.test.mjs` holds CSS to the scale. No speed budget exists for opening a long thread, folding turns or streaming, and the chat's scroll and anchoring have regressed before.
- **Gap:** speed is not a gate.
- **User value:** the app stays fast as threads and projects get long.
- **Size:** S–M.
- **Lands in:** frontend (plus a replay-page budget in xo-space).

### 7. Agent presets: named agent types the owner can reuse
- **In dsh** (6.4): a preset is a folder with `agent.cordis.yml` (tools, skills, prompts, model). It is immutable once a session is bound to it. You duplicate one to make your own, a chip on the new-session screen picks it, and a default is kept per user.
- **XO now:** role presets are core-owned (`storm/presets/`: coordinator, thread, plain chat). The intel chip picks runtime, model and effort. Agent folders such as `.agents/skills/reviewer` exist in xo-space but aren't a user-facing choice.
- **Gap:** the owner can't save "Claude grader", "designer" or "reviewer" as a type with its own brief, skills and model, and pick it when a thread starts.
- **User value:** brief once, reuse forever, with consistent quality across threads.
- **Size:** M.
- **Lands in:** both.

### 8. Skills and commands you can see and call: a Customize page and `/` in the composer
- **In dsh** (7.2):
  - Skills come from several sources (filesystem, runtime, bundled), merged by rank. Each says whether the model can call it, the person can call it, or both.
  - `/name` at the start of a message calls a skill deterministically, and the composer suggests from a cached `skills/list`.
  - The catalog the model saw is written into the session log, so it is part of history.
  - Plugins are listed with per-row toggles that persist as config diffs.
- **XO now:** `skill_catalog.py` and `skill_installer.py` install skills server-side. The composer has no `/` commands, and there is no screen to browse or toggle skills (the owner pointed at Claude's Customize › Skills page).
- **Gap:** discovery and invocation.
- **User value:** the owner can see what XO can do and call it by name.
- **Size:** M.
- **Lands in:** both.

### 9. Contracts checked between frontend and backend
- **In dsh** (5.2): Typert generates the client's typed RPC proxies from decorated host methods, so drift is a build error.
- **XO now:** about 247 FastAPI routes, called from hand-written `js/api.js` and `js/storm.js`. xo-space freezes some surfaces with goldens, but nothing checks that every call the UI makes still exists with the same method and fields.
- **Gap:** API drift shows up as a button that silently does nothing.
- **User value:** fewer "it just stopped working" bugs after a backend change.
- **Size:** S for the cheap version: a test that reads xo-space's OpenAPI and fails when a path or method `api.js` uses is missing. M for generated JSDoc types.
- **Lands in:** both.

### 10. A DAG of work: tasks with dependencies, shown as a run board
- **In dsh** (7.5, experimental):
  - **Agent Teams:** a Lead session spawns named teammates, all recorded in the Lead's log so the team survives crashes.
  - **The shared task board:** every edit is compare-and-set on a revision, dependencies are a DAG validated on write, and deleted tasks keep tombstones.
  - **Messages:** queued durably, then steered into the running teammate.
  - **The workflow run panel:** phases auto-expand when a member is active or failing, and clicking a member opens that session.
- **XO now:** goals, tasks and results records, project todos, and `wake_me` on `task_done`. There is no declared "B waits for A", and no board view of a plan across threads.
- **Gap:** plans that span threads are implicit in the coordinator's head.
- **User value:** the owner sees a multi-thread plan as one board (what's blocked on what), and the coordinator can't start B before A lands.
- **Size:** M.
- **Lands in:** both.

### 11. Drive XO from outside: a headless CLI, an SDK and ACP
- **In dsh** (2.2, 7.1, 7.4): one install boots as several *profiles*:
  - `web`;
  - `headless`, one task with NDJSON events out;
  - `sdk`, JSON-RPC on stdio, with a Python wheel that embeds the runtime;
  - `acp`, the Agent Client Protocol that editors such as Zed and JetBrains speak.
- **XO now:** the HTTP API and the agents' `xo_comms` MCP. There is no supported way to start a thread from a script, a CI job or an editor.
- **Gap:** an outside surface.
- **User value:** "start a thread from CI when a test fails", or "ask XO's coordinator from your editor".
- **Size:** M for a thin `xo` CLI over the existing routes. L for ACP.
- **Lands in:** xo-space.

### 12. dsh itself as a fourth runtime, for DeepSeek models
- **In dsh:** ACP is a standard, multi-session protocol with model and effort options and one-shot permissions. The 3 Nov note found it the best adapter path.
- **XO now:** adding an agent means dropping two folders (`adapters/<name>/`, `config/agents/<name>/`).
- **Gap:** no DeepSeek or OpenAI-compatible runtime.
- **User value:** a cheaper model for bulk or simple threads, chosen per thread.
- **Size:** M.
- **Lands in:** xo-space.
- **Caveats:**
  - dsh is a preview with breaking changes, so the adapter would need pinning.
  - Over ACP it streams per committed step, not per token, and drops plans, todos and ask-user questions, so XO's question cards wouldn't work there.

### 13. Smaller things worth lifting when nearby work is open
- **Composer takeover as a priority chain** (6.1). XO already puts a thread's decision above its composer; making it a chain slot (item 1) removes the special cases.
- **Elapsed-time context** (7.3). dsh writes "time since the last message" into each step. XO's wakes carry `current-time`, but not how long the agent slept.
- **MCP tool sync** (7.2): fetch, then swap, so a server's tool list never shows half-updated; names capped at 64 characters with a hash suffix; reconnect backoff from 500 ms to 30 s. This matters if users add their own MCP servers next to Composio.
- **A watchdog for the CLI child's stream.** dsh's LLM adapter has an idle timeout (`streamIdleTimeoutMs`), and its ACP child is disposed EOF → 6 s → SIGTERM → 3 s → SIGKILL. Worth checking that each XO runtime has an equivalent for a hung CLI.

---

## 3. What not to copy, and why

| Don't copy | Why |
|---|---|
| **The Cordis framework and "everything is a plugin" as an architecture** | It is a TypeScript DI and fiber system. XO is Python on the backend and vanilla ES modules with no build on the front. Adopting it would mean a rewrite, and xo-space already has its seam: the capability loader plus the runtime contract. Take the *idea* (slots in the UI, item 1), not the framework. |
| **Owning the agent loop**: LLM adapters, retries, compaction, spill, `run_code`/PTC, the tool waterfall | The CLIs XO hosts do all of this and improve it every week. Re-implementing it would fight Claude Code and Codex instead of riding them. XO's job is one layer up. |
| **Agents changing their own harness** (dsh's `plugin_manager` tool) | It conflicts with XO's authority model, where agents ask and the owner decides (`create_job` is an ask for the same reason). |
| **Installing plugins from npm or git at runtime** | This is a supply-chain risk on a box that holds the owner's keys. XO's skill catalog runs fixed argv commands from a server-side list, which is the safer shape. |
| **Per-turn todos that reset on every turn** (`todo_write`) | They are a working scratchpad. XO's todos are a project backlog the owner reads, a different and more useful thing. |
| **Bilingual doc triplets and the translation merge driver** | There is no second-language audience. The cost is high and constant. |
| **100% per-file coverage as a gate** | On a UI codebase it breeds tests written for the number. Keep the useful half: a reporter that prints the exact uncovered `path:line`, and one file listing exemptions. |
| **Electron desktop app, Computer Use (macOS/Windows), the WebWorker runtime, Windows ACL sandbox** | XO runs as a hosted Linux workspace in a browser. None of these fit. |
| **LiveShare's relay protocol, for now** | Sharing a live thread read-only is a real future feature. Its protocol is worth keeping for reference: two token types, view/write × open/selected, a fork flag and an expiry. It needs relay infrastructure and a security review, and the owner has said nothing leaves the machine. Later, not now. |
| **Read-before-write version guards for agents' file writes** | dsh needs this because many agents can share one folder. XO gives each thread its own worktree, and the person-vs-agent case is already handled by versioned saves and the merge view (`services/project_files/`). |
| **Release-family npm publishing machinery** | XO publishes no packages. |

---

## 4. Suggested order

Two tracks run at once:

1. **Owner-facing now:**
   - item 1, slots, limited to the left rail, the right panel and the composer chain, because it carries the threads redesign;
   - item 2, archive, delete, search and branch;
   - item 8, Customize and `/`.
2. **Safety and speed:**
   - item 3, fast UI tests;
   - item 4, the cheap path: bubblewrap plus the CLIs' native sandboxes, and a cgroup per thread;
   - item 6, speed budgets.

Items 5, 7, 9 and 10 follow. Items 11 and 12 come when the owner wants XO reachable from outside, or wants a cheaper model.

---

## 5. Their codebase style, and what our repos should adopt

Read from a shallow clone of `master` at `2e39e704` (0.2.2-rc.5). It was never run, installed or built. Full evidence, with paths and snippets, is in `notes/STYLE.md`.

### What their code looks like

- **Small units, hard boundaries.**
  - 391 packages under `packages/<group>/<pkg>/`. Each package has `src/`, `tests/` and a README, and `src/types.ts` holds types only.
  - Median source file: **91 lines** (p90 409). The large files are mostly generated catalogs and locale tables.
  - Median top-level function: 8 lines.
  - Each feature splits by role. For goals: `goal` (service and event fold), `tool-goal` (model tools), `command-goal` (`/goal`) and `ui-goal` (the bar).
- **Features plug in, nothing is edited in place.**
  - A host feature declares a service on `ctx`, takes a config schema with defaults, and is switched on by one YAML row in a bundle, with a comment saying why it sits there.
  - A UI feature (for example the right sidebar's Files tab, 185 lines of assembly) registers its tab, slot, strings and shortcut, each inside a named `ctx.effect` so it can be removed cleanly.
- **UI state.**
  - React 18.
  - Stores hold only *viewing* state (selection, drafts, panel widths). Business data never goes into a store.
  - Notifications are batched to a microtask or a frame, and there is one subscription bridge for the whole app.
  - CSS Modules use `--dsw-*` tokens. A spec rejects literal colours, `:hover` outside `@media (hover: hover)`, and a border paired with a shadow.
  - Hard-coded UI text fails a gate.
- **Rules are code, not prose.** About 389 `verify-*`/`gen-*` scripts, each with a spec, enforce dependency layers, export shapes, README skeletons, doc links and generated catalogs.
- **Debt can shrink but never grow.** Baseline files freeze legacy debt per file with a fingerprint: 477 files with `as unknown` casts are frozen, and empty `catch` blocks are down to zero.
- **Types and lint.**
  - TypeScript runs `strict` plus `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`.
  - oxlint is type-aware. Every rule is opted in by name, and every exception gives its reason ("Lost promises in the agent loop are the repository's highest-value linted bug class").
  - `jscpd` fails the build on duplicated code.
- **Tests outweigh code.**
  - 2,918 spec files, 408 e2e files and 128 recorded session scenarios.
  - Rules: "Mock only the expensive or non-deterministic boundary (LLM adapter, network, clock); keep everything downstream real". "A spec that passes only when run alone is a defect in the spec". "Every registry gets an HMR-safety test".
- **Docs as contracts.**
  - Every package README has the same skeleton: Summary, Source map, Model Experience (what the model sees and its token cost) and Known Limitations.
  - 406 dated decision notes in `.agents/notes/{proposed,implemented,rejected,archived}/`, plus numbered postmortems.
  - Doc length budgets: `AGENTS.md` is capped at 2,080.
- **Fast local checks, full checks in CI.** Pre-commit lints staged files and runs `git diff --cached --check`; pre-push typechecks. "Keep these local checkpoints fast; CI owns the full repository-wide gate matrix."

### Where we stand (measured, read only)

| | dsh | xo-coworker | xo-space |
|---|---|---|---|
| Median source file | 91 lines | 194 (`js/app.js` 4,279; `css/app.css` 3,116) | 145 (`launchpad.py` 2,750; `storm/engine/engine.py` 2,429) |
| Type checking | strict TS | none (0 of 77 files `@ts-check`, though 1,083 JSDoc blocks exist) | none (no mypy or pyright) |
| Linter | oxlint, type-aware | none | none (no ruff) |
| One test command | yes (`run-gates.ts` modes, same in CI) | no: the README lists 14 commands for 142 test files | yes (pytest in CI) |
| CI | 35 workflows | none | yes: compileall, pytest, route parity |
| Git hooks | lefthook, worktree-local | none | — |
| Architecture rules as tests | ~389 gate scripts | `design-budget.test.mjs` (CSS scale) | `test_command_executor.py`, `test_swarm_api.py`, route parity |
| Silent error swallowing | baseline at zero | 1 empty `catch` | ~30 `except Exception:` followed directly by `pass` |
| Module docs | README skeleton for every package | good README file table; module header comments | 482 of 490 modules have a docstring; no per-package README |

xo-space is in better shape than the frontend. The frontend's problem is mostly **no gates at all**: nothing stops a file from growing, a test from being skipped, or a typo from shipping.

### What our repos should adopt, cheapest first

1. **One test command for the frontend that fails on any failure.** Add `tests/run.mjs`: run every `tests/*.test.mjs`, check each exit code, and exit non-zero on any failure. Our memory already records that a test file can print "N passed" and still fail. (S, frontend.)
2. **A plain pre-commit hook.** `.githooks/pre-commit` runs `git diff --cached --check`, the design-budget test and the runner from step 1, switched on with `git config core.hooksPath .githooks`. It needs no install and takes seconds. (S, both.)
3. **A small linter with chosen rules, failing only on new findings.**
   - Backend: `ruff` with `E9,F,B,BLE`, the last for blind excepts, behind a baseline.
   - Frontend: `oxlint` with `no-unused-vars` and `no-undef`.
   - Each rule gets a one-line reason, as dsh does. (S, both.)
4. **Ratchets for debt.**
   - A test that freezes the count of `except …: pass` per file.
   - A file-size ratchet: no file over 1,000 lines may grow, and no new file may pass 800.
   - This is what stops `app.js` getting bigger while it is split. (S, both.)
5. **Type-check the frontend without adding a build.** Add `jsconfig.json` with `checkJs` and `// @ts-check` on pure modules first (`shape.js`, `follow.js`, the turn store), checked with `tsc --noEmit`. The page stays build-free. (S to start, M over time.)
6. **Split `js/app.js` along the slot registry (§2 item 1).** Each region the README already names becomes a module that registers itself. This is the same change as the UI-scaling work, so it is done once, not twice. (M, frontend.)
7. **Turn the stated boundaries into tests.**
   - Backend: `ast`-based import tests for the placement rules already in `AGENTS.md` (`services/connections` never imports the inbox; `services/` never imports `routers/`).
   - Frontend: pure modules import nothing that touches the DOM. (S, both.)
8. **Mock only the model boundary.** Record three real SSE streams (a tool turn, a needs-you ask, a usage-limit stop) and replay them through `storm.js` and the turn renderer. This pairs with §2 item 3. (S–M, frontend.)
9. **Dated decision notes in the repo.** `docs/decisions/YYYY-MM-DD-slug.md` for the owner's standing calls (follow.js owns scroll, stone vs glass, no push), linked from the code they govern. Today these live in commit subjects and agent memory. (S, both.)
10. **A README per backend package with a fixed skeleton** (Summary, Source map, Known limitations), starting with `services/cowork_agent/storm/`. Move the matching section of the 1,163-line `DEVELOPING.md` into it. (S per package, xo-space.)

**Not worth copying here:** the ~389-script gate setup, 100% per-file coverage, bilingual doc pairing, and the 208-script `package.json`. They suit a public, 391-package monorepo with many outside contributors, not two repos worked by agents for one owner.

---

## Sources

- DeepWiki, deepseek-ai/deepseek-harness: https://deepwiki.com/deepseek-ai/deepseek-harness/1-overview (all pages 1–10, read in full through `https://mcp.deepwiki.com/mcp` `read_wiki_contents`, 2026-11-19). Section numbers above (e.g. "6.2") are the wiki's pages.
- Repo: https://github.com/deepseek-ai/deepseek-harness (default branch `master`; last push 2026-11-18; latest tag `dsh-v0.2.2-rc.5`), shallow clone read on 2026-11-19.
- Earlier XO note: `research/deepseek-harness.md` (2026-11-03), in worktree `thread-cmsg_82a5cb4f5f484c6c`.
- XO: `/opt/xo-space` (`DEVELOPING.md` §3.5, §9; `services/cowork_agent/adapters/contract.py`; `storm/{store,records,runs,jobs,control,review,engine,chats,stream}`; `services/{advisory,terminal,project_files}`) and this repo (`README.md`, `js/*.js`, `tests/`).
- Working digests, one per wiki part with the wiki's line citations, plus the code-style study: `notes/{A..F}.md`, `notes/STYLE.md` beside this file.
