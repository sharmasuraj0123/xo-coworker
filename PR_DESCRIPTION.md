# xo-coworker: the November rebuild, paid usage controls, Launchpad repo confirmation

**Base:** `main` on GitHub (310af71, 2 Nov 2026, "Merge pull request #38 … feat/viewer-download")
**Head:** `release/2026-11-13`, the build live on :3000 since 13 Nov 15:59Z 
**Size:** 840 commits, 473 files, +46.8k / −2.2k lines. Of those lines, about 23k are app JS/CSS, 18k are tests, 2k are vendored libraries and 2.7k are tools and mockups.

## In one paragraph

This branch is xo-coworker as it runs on :3000 from 13 Nov. On top of the earlier live build (dcf5c72) it adds a starting view for empty project chats, paid usage settings, Launchpad's repository confirmation, a phone fix for hold-to-confirm buttons, a fix that keeps XO's tool names out of the conversation and says when a turn paused, and untracking `design-research/`. Since GitHub's main was cut on 2 Nov, XO has changed in several ways:
- It has a right-hand control panel (Agents, Map, Changes).
- It can show, review and edit files in place, with real diffs.
- It can start a project from GitHub and deploy it to Launchpad.
- Its interface moved onto one design system (the "LG UI": role colours, 24/32/40 control heights, motion tokens, one grid). Every control passed a graded check for size, states, focus and both themes.

Almost every change answers either something the owner asked for or a problem a grader or QA pass found. The commit subjects record which, often with the owner's timestamp.

---

## 1. The newest work (13 Nov)

### An empty project chat says what it can start (753567f)
**What.** An empty project chat opens on *What should get done in <project>?* with four rows, set midway between the header and the composer:
- *Make something new*
- *Fix or change something*
- *Explain how this project works*
- *Do something on a schedule*

A press starts the message in the composer for you to finish; it never sends. Once the composer has words, the rows step aside. Clearing the composer brings them back with the same soft fade (026eb2c). Before that fix they popped back in whole after 200 ms: the hide rule's delayed visibility ran in reverse, so the fade played while they were still hidden (the owner, 13 Nov 18:26Z). Threads and the Workspace keep their one-line note. Only `js/app.js` and `css/app.css` change.

**Why.** An empty project showed one small grey line at the top ("No messages yet. Tell this project's coordinator what you'd like done.") above a large blank area. That looked broken, and it didn't say what the coordinator can do. The owner asked for a clean starting view like other chat apps', "nothing too much" (13 Nov 15:05Z).

**A project just made or cloned opens on its starts too (5500c4e).** Before this fix, XO's own first line in a new project (for example "fabric-chat cloned from quirq-ai/fabric-chat · plan and memory added") counted as a conversation. So a cloned or newly created project never showed the starting view. Now a chat counts as empty until someone has said something: a stored message, or your own on its way. The starts sit after XO's lines, in the room between them and the composer. A new browser case, START, covers a clone and a new project in all four cells (the owner, 13 Nov 17:40Z).

### Two small layout fixes (13 Nov evening)
- **Launchpad's *Change* stays on its line (a10c1b5).** On a narrow panel, the Machine and Environment lines dropped *Change* onto a row of its own. Label, value and *Change* now share one grid, so *Change* sits at the end of the line, level with its label, however the value wraps. This includes a phone's taller tap height. A new four-cell case, LP45, covers it, with mock scenarios `live-machine` and `live-machine-noenv` (the owner, 13 Nov 18:01Z).
- **A short thread or file link stays inside its bubble on a phone (96de17a).** Links were kept on one line whatever the width, so at 390 px a 29-character title ran past the bubble's edge. A link is now at most as wide as the line:
  - it moves to the next line whole;
  - only when it is wider than the line does it wrap between words, each line a whole capsule;
  - a file name longer than the line breaks rather than spilling out (the owner, 13 Nov 18:03Z).

### Paid usage: Never / Ask me / Always allow (8b95b64, 583a933)
**What.** Settings › Runtimes gains a *Paid usage* section. It has one mode for the Space and one row per agent account: *Same as all*, *Never*, *Ask me* or *Always allow*. A change saves at once and shows Saving, Saved, or the refusal beside the row. The runtime card and the account row show an *On paid usage* badge while paid usage is actually being spent.

When an account reaches its plan limit under *Ask me*, the question shows:
- the account and how much of the window was used
- when the window resets, in the owner's clock
- the credits left, and how far *Continue* reaches (24 h on an API key)

The question appears on the panel's card and as Home's next move. Under *Never*, the composer says the thread is *Paused before paid usage*. All reading of the paid-usage wire format lives in one module, `js/paid.js`, with its view in `js/paidview.js`.

**Why.** The owner set the rule on 13 Nov:
- *Never* always stops before paid usage.
- *Ask* always stops and asks; it continues only once allowed.
- *Always allow* never asks.

Before this, the mode could only be changed through the API, and the UI couldn't tell "paused for money" from "stuck". It also still read a retired field (`paid_continue_until`).

**Pairs with xo-space.** This needs xo-space's final contract: `GET /api/chat/intent` pools (mode, source, state, reason), the ask card's detail fields, and `always` / `null` (follow the Space). That backend is xo-space branch `xo/thread-244fad`, now live on :5002. Merge the two together, or xo-space first.

### Cited authors (583a933)
**What.** A message relayed into a thread shows under its true author. An agent's cited proposal is the agent's, never shown as the owner's words.
**Why.** Relayed text could look as if the owner had written it. That is a trust problem for anything that acts on "the owner said".

### Launchpad: confirm the repository before pushing to it (f6a5661)
**What.** xo-space can stop a deploy with `confirm_repo` (xo-space 5897204, 7608315). Launchpad then shows a decision naming the repo in `launchpad.json` and the folder's git origin.
- *Deploy to <repo>* redeploys with the same form and exactly that `use_repo`.
- *Not this repository* closes the decision.

The check's warnings (for example, "a repo that isn't yours") are shown before Deploy is pressed.
**Why.** A cloned project's `launchpad.json` can name someone else's repository. Without the check, a deploy would push your code there, or fail confusingly. The owner asked for the UI to match xo-space's flow (13 Nov 07:42Z).

### A passed-on message sits where it was passed on (dcf5c72, already on :3000)
**What.** A message relayed into a thread is placed at the time and sequence of its hop, not when it was first written. The row says *passed on at HH:MM*, and its tooltip keeps the original time.
**Why.** The owner saw a forwarded message appear *above* what they had already typed (13 Nov 12:21Z). Ordering by write time put it back in the past.

### Hold-to-confirm on phones: one buzz, at the end (caaa9b8)
**What.** Hold-to-confirm buttons (*Hold to stop*, *Hold to remove*) do two things on touch:
- They cancel the browser's own long-press behaviour: the ~0.5 s vibration, the text selection and the callout.
- They give one 24 ms buzz when the 1.2 s hold completes.

**Why.** On Android Chrome the phone buzzed about halfway through the hold, so it felt as if the action had already fired. This is not yet confirmed on a physical device; please check it on a phone after deploy.

### No XO tool names in the conversation (0e311ce)
**What.**
- **A turn the agent ended itself reads as finished, as "Nothing to add".** This is a turn where the agent called `no_reply_needed`, kept writing, and was cut off by XO. It no longer shows a *■ Stopped after "`no_reply_needed` on `xo_comms`"* line, or the words the agent wrote after choosing to say nothing.
- **A turn someone really stopped** says where it stopped, in words.
- **Every XO comms tool has plain words** (ask, report, submit_result, lease, …), with a plain fallback for any new tool. This applies in the rows, the headers, the typing line and the Map.

The change is in `js/turnview.js`, `js/blocks.js`, `js/comms.js`, `js/storm.js` and `js/map.js`, with 4 new cases in `tests/turnview.test.mjs`.

**Why.** On 13 Nov 14:36Z the owner saw raw *"no reply needed" … "xo_comms"* text in a conversation, and it was gone after a refresh. The cause: some agents ended their turn with `no_reply_needed` and then kept writing, so XO cut the turn short. Our turn view printed that cut as a technical stop line, followed by the cut-off text. The fix was checked read-only against the real xo-space thread where it happened, in all four cells.

### A turn that paused says so (9d31c94)
**What.**
- **A paused turn says what it's waiting for.** When an agent ends its own turn after setting a wake, the turn's end reads *Paused to wait for the browser*, or until a time, a thread, or its usage limit. Before, it showed nothing or *Stopped*.
- **A busy shared resource isn't a failure.** A lease held by another session reads *The browser was in use* and stays in the turn's fold with a clock mark, not a red failure.

**Why.** After the fix above, a turn that paused for a shared browser seemed to end abruptly with no reason. The owner asked (13 Nov 15:16Z): "why does it stop so abruptly!?" Waiting for a shared resource is normal, so it shouldn't read as an error.

---

## 2. Repository hygiene: `design-research/` is no longer tracked (db06f98)

**This branch's history was rewritten so that GitHub never receives the screenshots.** Locally, the commits before db06f98 added and changed about 197 MB of `design-research/` files. Pushed as they were, all of that would have gone into GitHub's history for good. So before pushing, every commit's `design-research/` was set back to how GitHub's main already has it, keeping only the four test files below. The code in every commit is unchanged. Commit IDs are new as a result: the IDs in this description are the pushed ones, but IDs quoted *inside* commit messages refer to the original local commits.

**What.** 1,419 files under `design-research/` (161 MB, 160.7 MB of it PNG screenshots) are removed from tracking and the folder is git-ignored. The files stay on disk where they are.

Four small files stay tracked because the tests load them:

| File | Loaded by |
|---|---|
| `design-research/2026-11-lg/controls-ids.json` | `tests/stale-pass.test.mjs` |
| `design-research/2026-11-lg/tools/controls-md.cjs` | `tests/stale-pass.test.mjs` |
| `design-research/2026-11-vision/launchpad/tools/mockspace.cjs` | `tests/browser/harness.cjs`, the Launchpad mock |
| `design-research/2026-11-lg/lp-shell/world.cjs` | `tests/browser/lpshell.test.cjs` |

**Why.** The owner asked on 12 Nov for the design-decisions folder to be out of tracking: "it's way too large". A first version untracked everything. That broke `stale-pass` (exit 1) and the browser harness (module not found) in any fresh clone, so those four files were kept.

**Notes for the reviewer:**
- **History is unchanged.** The 161 MB is still in git history; this stops the working tree and future diffs from carrying it. Shrinking the history would need a rewrite, which is out of scope.
- **Checking out this branch deletes the folder from that checkout.** Git removes files that leave tracking when a checkout moves onto this commit. Any checkout that has `design-research/` on disk and switches or fast-forwards onto this branch will lose those files from disk, apart from the four kept files. The local main checkout (`/home/coder/xo-coworker`, 161 MB there) is one of them. **Copy the folder aside before merging locally**, then copy it back: it's ignored from then on. The deployed app (`/opt/xo-cowork/frontend`) isn't a git checkout and has no `design-research/`, so it isn't affected.
- **The grading ledgers go with it.** They were committed under `design-research/` (CONTROLS.md, REPORT.md, LAUNCHPAD-SHELL.md) and are no longer in the repo. The tests that pin their rows still run.
- **To drop this part of the PR,** revert db06f98; nothing else depends on it.

---

## 3. Everything since 2 Nov, by area

### Design system (the "LG UI")
- **One token scale, then one theme.** On 3 Nov every stylesheet moved onto one scale: 8 type sizes, 3 weights, a radius scale, one elevation and one motion curve (8b83eec, 236a154). The 3 Nov critique had found sizes, radii and hovers drifting from file to file.
  - From 8 Nov, `tokens.css` holds both themes with colours named by role. It replaced a 39-step grey ramp named by hex value, per-component palettes and three stacked light-theme definitions, of which only one ever rendered (2876195).
- **Three control heights: 24 / 32 / 40.** There were 13 heights and 4 radii for the same jobs (e9d358e, a1cd7c8). A census then moved 51 off-scale desktop controls onto the scale (f0ef3dc, eddc0c1). Rows sit on 8 px steps. The owner ruled on 11 Nov that phone rows are 40 or 48 and compact density is 24 (a5cdced).
- **Motion tokens.** Every timing reads a token, and floating things share one appear animation. This removed 46 hard-coded durations and the overshoots on Send and the done stamp (9b67fec, ba64441).
- **One conversation grid, one 2 px focus ring, one z-scale.** The composer had sat 14 px off the messages with the panel open (aa98b0a, c50e7fe, 9e7404e).
- **States anyone can see.**
  - Every control presses visibly, as a single fill change with no halo or inner shadow (owner, 11 Nov 08:19Z; fc0685a, 6184e2d).
  - Hover lifts secondary text so it keeps 4.5:1 contrast (685e1f0).
  - Chosen controls still hover (52e6a6b).
  - Picture tiles get a veil chosen against the picture's tone (4f20da4).
- **Focus rings are never clipped.** Scrollers leave `--ring-room` and bars draw their rings inset (fd17a04, 9590733). Bordered fields show focus on their own edge, and message and search boxes draw no ring while you type (owner, 11 Nov; 707706e).
- **Concentric corners**, checked by a measuring tool (068e1a8, 3e7f03c).
- **One working signal.** A working arc in the app's blue replaces blinking and blue dots. Its shimmer follows the clock, so a redraw doesn't restart it (b76351d, cbd1111).
- **Budget tests** fail any size, weight, radius, curve, shadow, height or ring that isn't from the scale (`tests/design-budget.test.mjs`, `ctl-scale`, `hover-census`, `press-reach`).

### Conversation and chat
- **Bubbles.** The final style is XO green with tails, and every reply is in a bubble. The owner picked it after six rounds of exploration; the style switcher is gone (f156eae, b40c8c3).
- **Scroll is owned in one place, `js/follow.js`.** A chat opens at the latest message and follows new content while you're there. A status change never throws a reader to the bottom, older pages land above what you're reading, and a width change isn't treated as your scroll (555e18b, ba8196d, ef100c1). Why: repeated QA reports of bumps and snaps.
- **A calm working turn.** No 16 or 48 px jump when a turn starts or ends, and mid-turn text shows above the working bubble (08718bd, 5c67e05).
- **Opening a thread is faster.** It no longer downloads the whole project's history, and its first page, turns and notes draw together (2ae71fe, 4e84885).
- **Honest receipts.** *Received by XO*, then *Passed to <thread>*, instead of a permanent *Sent ✓* (5553990, fb15576). Refused sends say *Not sent*, and every send is judged by its real destination (89d600d, 0835fd0). *Copied* appears only after the copy worked (8c837c3).
- **Agent tool calls read as words**, such as *Talking to the xo-space coordinator…* (`js/comms.js`, 9903c95).
- **Coordinator status (12 Nov).** The busy dot, the typing line and Stop all follow the newest live coordinator session (`coordinatorOf()` in `storm.js`). A replaced session left "queued" had kept the chat busy and become Stop's target (666d570).
- **Smaller fixes:**
  - Pictures and links render inline.
  - Links wrap.
  - A model change queued for the next turn shows on the picker's chip.
  - Escape during IME composition no longer leaves the thread.
  - A thread with no plan shows no checklist bar.

### Right panel: Agents, Map, Changes
- **One resizable right panel**, the "Agentic Control Pane", with Agents, Map and Changes as stacked frames that show whole rows only (38b9d30, 9d55185, 47d871e).
- **The Map.** The folder is drawn as a diagram or a graph, with agents as cursors. Follow keeps your zoom and the agent in view. Pressing a tiny box zooms in first, and a second press opens it (cda5db1, edeb1b9, b838e19).

### Files, diffs and editing (Pierre)
- **Vendored `@pierre/diffs` 1.6.4** (Apache-2.0), pinned and hashed, with an XO theme built from the tokens. Highlighting runs in a worker so the page doesn't freeze (6870976, 1382a6b).
- **Changes in the panel**, with long lists drawn 100 rows at a time. Picking a file in a 500-file list redraws two rows, not all 500 (82ed639, 58a4883). Non-git projects, missing worktrees and `.xo/` are handled as Space answers them.
- **The full-file view (owner's Layout A).** The file takes the middle and the chat docks beside it. ⌘L *Ask about these lines* puts the lines into the chat's composer; on a phone the chat is a sheet (617eae2, acc7607).
- **Edit, Save, Undo** against Space's edit API, with `base_version` and a merge view (`js/merge.js`). Files that run code ask first. `serve.py` adds the writer key only on the save and undo routes (f65260d, 0b88593).
- **Drafts and New file**; "/" and "?" typed in the editor stay in the file (cb40e74, 09fc2bc).
- **The file you're reading never changes under you.** *Updated · Show* offers the new version (497fadb).
- **Changed images show Before and Now**, not "Binary file" (owner, 6 Nov; 59258d7).
- **Sandboxed HTML preview**, approved by the owner: the page's own scripts run without same-origin (70fcb0a).

### New project from GitHub
- **Start empty, or clone from GitHub** through Space's `POST /xo-projects`, connecting GitHub in place (31e094a).
- **Clone progress.** Shows the phase, %, size and Stop, with Space's error codes in plain words and *Waiting for GitHub* when git is silent (54da8c9, 55acdcb). The progressbar announces only a new phase (99ce75d).

### Launchpad deploy
- **Deploy from the panel**, on xo-space's deploy contract. The panel shows Space's reasons whole, no guessed domain, and app states in words (d2491a9, 11e0ad2, dfabc76).
- **A four-node system view** (Visitors → Address → App → Image), drawn only from what Space reports (40e1878).
- **Machine size and an optional disk** (1–20 GB; it can grow, never shrink) (8b62c35, b33d3eb).
- **Stop and Unlink** each use one notice that updates in place (owner's choice B), and a late answer never overwrites *stopped* (3cb515f, 1b3e9d4).
- **Folding is fast.** It no longer redraws the app: 26–162 ms of script became 3–7 ms (4b78999).
- **Repository confirmation.** See section 1.

### Home, sidebar, settings, runtimes
- **Artifacts** is a sidebar page of everything threads made, with search and filters (56c5947).
- **Home is separate from Workspace.** A message sent from Home takes you to its conversation (0caf409).
- **`<xo-select>`** replaces every native `<select>`, as an ARIA select-only combobox (e761a20).
- **Presets / Shape.** The UI adapts per person (Build software, Make content, Everything), stored on Storm (0bc803a).
- **Runtimes.**
  - A thread names its runtime.
  - Settings › Runtimes shows each runtime's health and usage.
  - A usage limit says until when and offers to move the waiting threads (ee90b3f, d0f83b2).
  - The composer's picker chooses runtime, then model, then effort (54d712b).
- **Settings say what's true.** *Saved* appears only on XO's answer; refusals show beside the control you used; failed shape saves are queued and resent (0dced8e, 608da17).

### Keyboard, focus, accessibility
- **Focus never falls to the page.** When a redraw removes the focused control, focus goes to a named successor, and the browser suite fails any drop (befdc4b, e577b0e).
- **Shared helpers:**
  - `pending.js`: a request answers once.
  - `keynav.js`: radio and menu keys.
  - `redraw.js`: redraw in place and keep focus.
  - `focusview.js`: focus moved by a script scrolls the nearest scroller only.

### Phone
- **One top bar per place** (design B), phones fit their edges, and the panel steps aside instead of squeezing the chat (90fd5d2, 1402796).
- **Touch targets.** Every control and field is at least 36 px, by one rule (owner, 9 Nov; 3dd0713). Hold-to-confirm buzzes once (section 1).

---

## 4. Tests

- **Unit tests.** 142 test files are new (GitHub's main had 7). Run each `node tests/<name>.test.mjs`; a file can print "N passed" and still exit non-zero, so check the exit code.
- **Browser tests** (`tests/browser/`, Playwright core with headless Chromium). They answer from a mock Space world (`harness.cjs`). Every case runs in four cells: dark and light, at 1440×900 and 390×844.
  - Suites: smoke, flows, lpshell, settings, conversation, coordinator-busy.
  - Sweeps include STATES (rest, hover and held for every control), RINGCLIP (clipped focus rings) and ROWS (row heights).

**Run on this branch (13 Nov), from a fresh clone:**
- **Unit tests:** all 139 `tests/*.test.mjs` files exit 0, as does `tests/serve.test.py`.
- **Browser suites:** every suite ran in all four cells (dark and light, at 1440×900 and 390×844), against the build that is live on :3000.

  | Suite | Result |
  |---|---|
  | smoke | 22 passed, exit 0 |
  | coordinator-busy | passed, exit 0 |
  | conversation | 193 passed, 0 failed, exit 0 |
  | lpshell (the whole Launchpad shell, including repository confirmation) | 204 passed, 0 failed, exit 0 |
  | settings | every case passed |
  | flows | every case passed except C030/S069, which fails the same way on `main` |

  - **settings** ran in three parts: the full run (141 passed), the paid usage and Runtimes save cases (48 passed), and a re-run of the 71 cases that lost their headless browser in the full run (72 passed). No assertion failed in any part.
  - **flows:** 1440 cells, 371 passed and 33 skipped; 390 dark, 183 passed and 9 skipped; 390 light, 183 passed and 9 skipped.
  - **C030/S069 is not a regression.** It fails identically on the base this branch was cut from (local main, aea856f). The Files Find box draws no outline ring while you type, which is the owner's 11 Nov ruling for search boxes. The test still expects a solid 2 px ring. It is left as a follow-up to reconcile, not changed here.
  - **Not covered by any browser test:** the phone hold buzz. It needs a check on a real phone.
- **Against the real Space:** 583a933 (paid usage, Launchpad) and the stray-text fix were each checked read-only against the real Space on :5002 by the threads that built them.

## 5. Not in this PR

- **Older local branches from 4–9 Nov.** Explorations, design notes, QA passes, and test variants superseded by later work. The owner decided on 13 Nov to leave them out.
- **The removal of `projectSince` and the Made panel.** Still a follow-up.
- **A total Artifacts count from the Space.** A per-browser cached count was tried and reverted (26ec506 → ffa68db); the owner wants the total to come from the Space.
- **Items xo-space accepted as low severity for its side** (tracked there, not here): symlink writes in made copies, forged "owner wrote" lines in coordinator summaries, and the Launchpad token wording in its docs.

## 6. Deploying

`deploy.sh` / `deploy-files.sh` copy the front end to `/opt/xo-cowork/frontend` (:3000). Nothing here changes how the app is served. `serve.py` only gains the writer key on the edit routes, which has been on :3000 since 5 Nov. Deploy the xo-space side first, or together, because paid usage and repo confirmation read its new fields.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
