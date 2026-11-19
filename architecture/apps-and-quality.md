# How dsh's plugins work, how XO apps would work, and how to make xo-coworker slop-free

Research, 2026-11-19. Nothing was built. This answers the owner's follow-up of 10:35: *"how do their plugins system work, suppose if i were to build apps for xo, then how would that work? … what can we learn from their work about development of such system? how can we make xo-coworker slop free and high quality."*

- **dsh facts** come from their real code: a read-only clone at `2e39e704` (0.2.2-rc.5), never run. The evidence, with paths and quotes, is in `notes/PLUGINS.md` and `notes/STYLE.md`.
- **The XO apps design** builds on the proposal of 4 Nov, `design-research/2026-11-vision/apps/{README,contract,platforms}.md` (in thread 3aa41dcf's worktree). Nothing from it has been built yet: xo-space has no app store or `/mcp/apps` route.

---

## 1. How dsh's plugins work, in plain words

**Everything in dsh is a plugin, including its core.** A plugin is a small module that says three things:

- **What it needs.** For example "I need the tools service and the goals service" (`inject`).
- **Its settings,** as a schema with defaults (`Config`).
- **What it adds when it starts** (`apply`). For example: register a tool, add a panel, listen to an event.

The framework underneath, **Cordis**, does the rest:

1. **Start when ready.** A plugin starts only once everything it needs exists. If one of those disappears, the plugin stops by itself, and it restarts when the need comes back.
2. **Undo everything.** Every registration is an *effect* with an undo. Stopping or disabling a plugin runs the undos in reverse order, so nothing is left behind. Each plugin's state is tracked: waiting, loading, active, failed, unloading, disposed (`vendor/cordis/src/fiber.ts:177`).
3. **Composition is a list in YAML.** A *bundle* is an npm package that ships a `cordis.patch.yml`: rows of "load this plugin, with this config". A *profile* (web, headless, sdk, acp) stacks bundles in order, and your own patch file goes on top. Disabling a plugin writes `disabled: true` into your patch file.
4. **UI is plugged into named places.** A plugin can ship a browser half. It registers React components into **slots**, the named places in the app. About 128 are listed in a generated catalog, each with a kind (one, a list, keyed, a priority chain) and a scope (app-wide or per session). The right panel's Files tab, for example, registers its tab, its tree, its strings and its keyboard shortcut, each as an undoable effect. It talks to its server half through typed remote calls.
5. **A Plugin Manager installs at runtime.** It installs, updates, enables and removes bundles from npm, git, a tarball or a folder, using pnpm. It checks version compatibility first, asks before running dependency install scripts, and hot-reloads. Sixteen core plugins can never be disabled, and the desktop app has a "disable all plugins" safe mode.

A minimal real plugin (`packages/goal/tool-goal/src/index.ts`, trimmed):

```ts
export const name = 'tool-goal'
export const inject = ['agents', 'goals', 'tools', 'systemPrompt']
export const Config = z.object({ blockedAfterConsecutiveRounds: z.number().min(1).default(3) })
export function apply(ctx, config) {
  ctx.tools.register(defineTool({ name: 'get_goal', /* … */ }))
}
```

### The part that matters most for XO: dsh plugins are trusted completely

An installed plugin runs **inside the main process, or the main page, with the same access as dsh itself**. That means all files, the network, credentials and every service. The "what it needs" list is a correctness check, not a security one, and shipped plugins read other services directly. There are no per-plugin permissions, no signing, no sandbox, and the plugin market's index is unsigned.

dsh says so itself:
- "These checks are not a sandbox against malicious package code" (`packages/boot/app-boot/README.md`).
- "Installed Host code runs outside the workspace sandbox" (`packages/boot/plugin-manager/src/tools.ts:109`).
- `SAFETY.md` warns that untrusted plugins "may damage the host computer … disclose data or credentials".

Two more costs show in the code:
- One plugin's unhandled error exits the whole host process (`installFailLoud`, `packages/boot/app-boot/src/index.ts`).
- Config values tagged `!!js` are evaluated as live JavaScript (`vendor/loader/src/config/utils.ts`).

This is fine for a developer tool where you install what you trust. **It is not a model for XO apps**, which may come from other people, run next to the owner's keys, and are used by people who will never read source code.

---

## 2. How "apps for XO" would work

The 4 Nov proposal already answers this, and dsh confirms its main choice. dsh shows what a plugin system looks like *without* a security boundary. The XO proposal puts that boundary in from the start.

**An XO app is a standard package with three parts. XO runs it at arm's length.**

| Part | What it is | Where it runs |
|---|---|---|
| **Manifest** | `plugin.json` (the Agent Plugins format) plus an `extensions["space.xo"]` block. It holds the id, version, the XO versions it supports, its permissions (each with a plain "why"), its surfaces (canvas, panel tab, inline card, evidence, `/` commands, settings) and its tools with a risk tier. | Read by xo-space at install |
| **Server** | An MCP server: the app's tools and its logic. | A separate process started by xo-space when needed and stopped when idle, with a scrubbed environment and only the secrets it was granted |
| **Views** | MCP Apps UI, small web pages. | Sandboxed frames that XO draws into its own slots. XO draws the frame, title, loading and errors; the app draws only its content. |

### A worked example: a "Revenue" app, start to finish

1. **Building it.** In a local folder you write:
   - a manifest that declares a panel tab "Revenue", an inline card, a `/revenue` command and a tool `revenue_summary` (routine risk, read-only);
   - the permissions `network: api.stripe.com` and `secrets: STRIPE_KEY`, each with its "why";
   - an MCP server with that one tool, and a small view page.

   `xo app check` validates it. In development mode, xo-space loads the folder directly.
2. **Installing it.** You see one sheet that lists, in plain words, what the app can touch: "Read your Stripe revenue (network to api.stripe.com), using your Stripe key". It offers **Allow** and **Choose myself** at equal weight. Grants are per project, held by xo-space and never stored in files, and you can take them back.
3. **Using it.**
   - **Agents:** in projects where Revenue is enabled, agents get `revenue_summary` as a tool, and every call goes through the same review and rules as any agent action.
   - **You:** `/revenue` in the composer; the Revenue tab in the right panel; the inline card where an agent used the tool.
   - **Interruptions:** the app can't ping you. It can only propose an ask, and asks are paced.
4. **When it breaks.** Every call has a timeout, the server restarts with backoff, and a view has a watchdog. A crash loop goes to Inbox, never Needs you, and never takes XO down.
5. **Removing it.** It stops, its surfaces disappear, and **your files stay**: an app's work lives in your project.

Its agent half also works in Claude Code and Codex, and its views also render in Claude and ChatGPT. That is the payoff of being standard, and XO's quirq plugin already proves it in ChatGPT.

---

## 3. What dsh teaches about building a system like this

### Take

1. **Build your own features on the same seam you give others.** dsh's core features are plugins: 391 packages, and the right panel's Files tab is one. That is why its slot catalog is real and well tested. XO should do the same: the UI slot registry (item 1 of the main README) *is* the internal half of the app contract. Port Files and Shells onto it first, then Design. A contract no first-party feature uses is a contract nobody has tested.
2. **Every registration has an undo, and a test proves it.** dsh's rule: "Every registry gets an HMR-safety test (dispose the contributing fiber, assert cleanup)". For XO, *install, then disable, then uninstall leaves zero trace* — no tab, no command, no tool, no listener, no process — and that is a test in the app kit.
3. **Start when ready.** A surface or tool appears only while what it depends on is running. In XO, an app's panel tab shows only while its server is healthy and the project grants it. Otherwise it shows XO's own error frame, never a blank one.
4. **A typed, generated catalog of places.** dsh generates its slot catalog: each slot with its kind, scope, current occupants and "replacement risk". XO should generate the list of surfaces (`xo:needs-you`, `xo:files`, `<app>:<surface>`) from the registry and check it in with a staleness check. Presets and app manifests can then be validated against it.
5. **Layered config you can print.** dsh's layers are base, then bundle, then profile, then you, and `--dump-config` prints the result. XO's preset precedence (yours > project > preset > app default) already matches this. Add a "show effective layout" view so nobody has to guess.
6. **Compatibility before load.** dsh checks `engines.dsh` before importing, with exact-version exemptions that never carry over to the next version. XO's `engines.xo` should work the same way, and a refusal should name what's unmet.
7. **A safe mode and a never-off core.** dsh has one switch that disables every third-party plugin, and 16 core plugins that can't be disabled. XO needs both: a kill switch (also remote, per the proposal) and a short list of `xo:*` surfaces no app can replace.
8. **Teach with a tutorial, test with a kit.** dsh has a seven-step tutorial, cookbooks per contribution type, test kits, and a rule that every product-visible plugin has a test that boots the *real* composition. It has **no scaffolding command**, and authors copy files by hand. XO should ship `xo app new` from day one, plus a test kit with a fake xo-space host and recorded sessions.
9. **A README skeleton per app.** In dsh every package README has Summary, Source map, *Model Experience* (exactly what the model sees and what it costs in tokens) and Known Limitations, and a gate checks it. Every XO app should declare what agents see and what it costs them.

### Avoid

1. **Plugins in the main process with full access.** This is dsh's biggest gap, and they say so themselves. XO's design keeps it out: separate processes, sandboxed frames, grants in xo-space, one checkpoint.
2. **Installing arbitrary code from npm or git at runtime.** XO: signed packages from a first-party registry, plus local folders in development mode. No install scripts at all.
3. **Config that runs code** (`!!js`). XO manifests and presets stay pure JSON, validated by schema.
4. **One app's crash taking down the host.** XO keeps each app in its own process with a watchdog.
5. **A huge shared surface.** dsh plugins see a `ctx` with services added by 196 files, so everything is coupled to one pre-1.0 version. XO apps get a **small, versioned host API** (files under granted paths, threads, artifacts, asks) and nothing else.
6. **Override-by-id that replaces a row's whole config.** XO presets merge by field, and moving one tab never resets the others.
7. **Hot reload without rollback.** If an app update fails, XO keeps the previous version running.

### The order

1. **Slots inside XO first.** This is the same work as the owner's redesign: threads in the right panel, the Shell button, the left rail.
2. Port Files and Shells onto the slots as `xo:*` surfaces.
3. Build app contract v0 in xo-space (app store, grants, supervisor, `/mcp/apps/<id>`, the bridge) and port the file viewer as the first app.
4. Build Design on the contract.
5. Freeze 1.0 after two apps ship.
6. Only then open to third parties: a separate-origin sandbox and review of every version.

Steps 1–2 are useful even if apps never ship.

---

## 4. Making xo-coworker slop-free

### What's actually causing it (measured on 19 Nov)

- **The rules live outside the repo.** xo-coworker has no `AGENTS.md` or `CLAUDE.md`. The owner's standing rules exist only in agent memory notes and in each coordinator brief, so every new thread is only as careful as its brief. xo-space has a good `AGENTS.md`, and it shows: it has CI, architecture tests and docstrings on 482 of 490 modules.
- **Two files everyone edits.** Since 1 Nov, `css/app.css` was changed in 189 commits and `js/app.js` in 182 (4,279 lines). Parallel threads in parallel worktrees meet in the same file, so regressions and merge fixes follow.
- **Rework.** About 85 of 874 commit subjects since 1 Nov name a regression or redo ("again", "still", "no longer"). Many cite the owner's own report, which means **the owner is the test suite**.
- **No gates.** No linter, no type check, no git hooks, no CI. The README lists 14 separate commands for 142 test files, so a skipped or failing file goes unnoticed. Browser suites take 20–40 minutes and are paused. The one real gate, `tests/design-budget.test.mjs`, works well: it fails the moment a stylesheet uses a size, weight, radius or curve outside the scale.
- **"Done" means the agent said so.** There is no required evidence, and exploration leftovers have reached `:3000` before; the owner called that careless on 5 Nov.

The surface signs are clean: 0 `console.log`, 0 TODO/FIXME. The slop isn't sloppiness at the keyboard. It is **missing structure**. Many agents work fast in parallel, with nothing mechanical holding the line.

### The fix: rules, gates, structure, evidence

**Week 1: small, mechanical, no build added (each about a day or less)**

1. **`AGENTS.md` in the repo, kept short.** dsh caps theirs at 2,080 characters with a gate. It holds the owner's standing rules: no push, no exploration leftovers on `:3000`, follow.js owns scroll, stone and glass, no browser runs unless asked, check exit codes. Each rule links to a decision note in `docs/decisions/YYYY-MM-DD-slug.md`. Then every thread starts from the same rules, not from a brief.
2. **One test command.** `node tests/run.mjs` runs every test file, checks every exit code and fails on any failure. The README points to it and nothing else.
3. **A pre-commit hook.** `.githooks/pre-commit` runs `git diff --cached --check`, the design budget and `tests/run.mjs`, switched on with `git config core.hooksPath .githooks`. It takes seconds and needs no install.
4. **A leftovers check.** A test that fails when a merge to a release branch carries a test flag, a switcher, a demo page or an `?x=` debug parameter. This turns the 5 Nov rule into a machine check.
5. **Ratchets.**
   - No file over 1,000 lines may grow, and no new file may pass 800.
   - Empty `catch` blocks are frozen at today's count, which is 1.

   This stops `app.js` and `app.css` growing while they are split.
6. **Every owner-reported bug gets a failing test first.** Write the test, then the fix, and name the test after the report. Rework then can't come back unseen.

**Weeks 2–3: structure (about a week each)**

7. **The slot registry, and split `app.js` and `app.css` along it** (main README item 1). Each region becomes a module that registers itself. Parallel threads then touch different files, which removes the single biggest source of collisions.
8. **A fast UI lane** (main README item 3).
   - **Seeded history:** a seeded store and the fake CLI, with no model calls.
   - **Waiting:** wait for turn-end and `[data-streaming]` to clear; no fixed sleeps.
   - **Assertions:** text snapshots of the accessibility tree, not screenshots.

   Target: under 3 minutes, so it can run on every change without the owner asking.
9. **Type-check without a build.** `jsconfig.json` with `checkJs`, plus `// @ts-check` on pure modules first (`shape.js`, `follow.js`, the turn store). Run `tsc --noEmit` in the hook. The page stays build-free.
10. **A small linter.** oxlint with a few named rules, each with a one-line reason as dsh does: `no-unused-vars`, `no-undef`, later `no-floating-promises`. It fails only on new findings.

**Always: evidence before it reaches the owner**

11. **A definition of done, posted with every result:**
    - the test command's output;
    - the changed screens as a fixed before/after pair in both themes;
    - a line saying what was *not* checked.
12. **An independent review before merge.** A second agent reviews the diff and screenshots without the author's reasoning: `/code-review`, or the read-only Claude reviewer from our memory notes. The coordinator merges only when both pass.
13. **Extend the design budget the way dsh's theme spec works.** Reject literal colours outside `tokens.css`, `:hover` outside `@media (hover: hover)`, and a border paired with a shadow. Visual consistency is then checked by machine, not by the owner's eye.

**Not worth copying for our size:** dsh's ~389 gate scripts, 100% per-file coverage, bilingual docs, and 35 CI workflows. Steps 1–6 give most of the value for very little cost.

---

## 5. Overhaul everything at once, or move to modules step by step?

The owner asked on 19 Nov at 10:47: *"would it help if we completely overhauled the structure … super modular, and adding apps becomes as easy as it can get"*.

**The goal is right. A rewrite in one go is the wrong way to get there.** Move to the modular structure step by step, while the app keeps working.

### Why not one big rewrite

- **The app stays live the whole time.** `:3000` serves the owner every day, and threads keep landing changes. A rewrite means either freezing features for weeks or building two apps in parallel.
- **The current code holds many small decisions.** There have been 874 commits since 1 Nov, and many of them are fixes the owner asked for: scroll anchoring, press handling while live data redraws, link wrapping on a phone, and more. A rewrite drops them silently, and the owner finds them again one by one.
- **There is no safety net yet.** The browser suites take 20–40 minutes and are paused, so nothing would catch what a rewrite breaks.

### What step by step looks like

1. **Safety net first** (week 1): the quality steps in §4, plus the fast UI lane, so a moved piece that breaks gets caught in minutes.
2. **A small kernel** (about a week):
   - a registry of places (slots), each with a kind (one, list, keyed, priority chain) and a scope (app-wide or per conversation);
   - every registration returns its undo;
   - a generated catalog of the places;
   - a test that switching a module off leaves nothing behind.

   It is plain ES modules, with no framework and no build.
3. **Move one region at a time.** Each region becomes a folder under `js/modules/<name>/`, with its JS, its CSS and its tests. It registers itself into the kernel's places, and `app.js` and `app.css` shrink with each move. Order:
   1. the right panel (Threads, Files, Shell, Map), which is also the owner's redesign;
   2. the left rail and its top;
   3. the composer and the things that take it over (asks, decisions);
   4. Settings sections;
   5. conversation blocks.

   Each move is its own small change, reviewed against the fast UI lane. Features keep shipping in between.
4. **Our own modules are apps without the sandbox.** When the right panel's Files tab is a module with a manifest, giving the same shape to an outside app is mostly new plumbing (manifest check, server supervisor, sandboxed frame), not a new structure.
5. **Then the app contract** (§2), once two of our own modules have proved the places.

The end state is a shell of a few hundred lines that boots the kernel and loads the modules. Everything the owner sees is a module or an app, and every module has its own folder, tests and owner.

Rough time: 4–6 weeks of steady work alongside normal features, compared with 6–10 weeks of freeze for a rewrite, plus the regressions after it.

### "As easy as it can get" for app authors, without making it unsafe

dsh made plugins easy by trusting them completely. XO should make them easy through **tools**:

- `xo app new` writes a working app: manifest, one tool, one panel view and a test.
- Development mode loads the folder and reloads on save.
- `xo app check` explains every problem in plain words.
- A test kit fakes xo-space.
- A tutorial walks through building the Revenue example.

**The author writes a manifest, one tool and one view. Everything else (frames, theme, errors, permissions, review) XO does for them.** That is easier than dsh, where authors copy files by hand, and it keeps the owner's keys out of reach.

---

## Sources

- dsh code (read only, never run): `vendor/cordis/src/{context,fiber,events,registry,service}.ts`, `vendor/loader/src/config/utils.ts`, `packages/boot/{app-boot,plugin-manager}`, `packages/client/ui-sidebar-files/src/client/index.ts`, `packages/extensions/cordis-client-runner/src/client/slot-catalog.ts`, `packages/goal/tool-goal/src/index.ts`, `SAFETY.md`, `docs/cordis-tutorial/`, `docs/cookbook/`. The full evidence is in `notes/PLUGINS.md`.
- XO apps proposal (4 Nov): `design-research/2026-11-vision/apps/README.md`, `contract.md` (§1.2 manifest, §12 backend asks), `platforms.md`.
- Measurements: `git log --since=2026-11-01` on this repo at `08e42fd`; `/opt/xo-space` read only; `notes/STYLE.md`.
