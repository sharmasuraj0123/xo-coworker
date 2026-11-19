# e2e: the fast UI lane

The real app runs in headless Chromium against a fake Space on a seeded store. Each case waits with a settle
barrier and asserts with ARIA text snapshots. The target is under 3 minutes for the whole lane.

```
node e2e/run.mjs              every case
node e2e/run.mjs send         only the cases whose "file › name" contains "send"
UPDATE=1 node e2e/run.mjs     write the goldens instead of comparing (review the diff before committing)
node e2e/tests/store.test.mjs node e2e/tests/aria.test.mjs   the lane's own unit tests (no browser)
```

- **Exit code:** 0 means every case passed, 1 means a case failed or the 3-minute budget ran out, and 2 means
  nothing ran (no Playwright or Chromium, or no case matches the filter). The exit code is the verdict; the
  printed lines are not.
- **Only on request.** `tools/check.mjs` and `tests/run.mjs` never start a browser. On this machine, hold the
  `headless-browser-suite` lease first, and run one browser suite at a time.

## How a case runs

1. **A fake Space** (`lib/space.mjs` over `lib/store.mjs`). One HTTP server on `127.0.0.1:0`:
   - it serves the repo's files as they are on disk;
   - it answers `/api` from the seed, using xo-space's row shapes;
   - it streams `/api/chat/stream` the way xo-space does. A snapshot frame comes first, so the app's boot isn't
     held for 4 s waiting for a first frame. After that come frames with ids, and a posted message comes back as
     its `message` frame. A reconnect with `Last-Event-ID` gets the frames it missed, and a heartbeat keeps a
     quiet stream open.

   Nothing is injected into the app's modules, and no `window.__t`. Any of these **fails the case**:
   - a read the seed doesn't answer (it gets a 404);
   - a write the seed doesn't answer (it gets a 405);
   - a body that isn't JSON (it gets a 400), or an error inside the fake Space itself.

   A request whose body never fully arrived is dropped, never answered as an empty write. `t.space.gate(path)`
   holds a path's answers until the returned function is called.
2. **The page.** One Chromium for the run and one context per case:
   - reduced motion, at DPR 1;
   - locale en-GB, time zone UTC;
   - `Date` fixed to the seed's `now`, so "6m ago" reads the same on every run. Timers still run in real time,
     so an undo window or a notice's timer runs its real length, and `Date`-based ages stay at zero.

   A page error fails the case, and so does focus that falls to the page because the control holding it went
   away.
3. **The settle barrier** (`lib/settle.mjs`). `t.settle()` waits until all of these hold at once:
   - no request is open: a fetch until its body is read, an event stream until its first event (a resume with
     `Last-Event-ID` until its headers), and anything the Space serves, so `import()`, workers and uploads too;
   - no timer under 10 s is waiting, unless it is a poll: one whose function or call site re-arms it from its
     own callback;
   - no animation-frame callback is waiting, and no worker owes a reply;
   - nothing has changed for 3 animation frames: no DOM change, and no request, timer or reply has just ended;
   - the fonts are loaded;
   - nothing is `[aria-busy="true"]`.

   It uses no sleeps, no `networkidle` and no `requestIdleCallback`. If the page doesn't settle, the error names
   what is still going on.
4. **ARIA snapshots** (`lib/aria.mjs`). `t.snap(name, locator?)` compares the accessibility tree's text with
   `snapshots/<spec>/<case>--<name>.aria.yml`. A mismatch fails the case with a line diff, and the case carries
   on, so one run shows every difference. The snapshots don't depend on the theme or the DPR. A full run (no
   filter) in which every case passed fails on a golden that no case uses; `UPDATE=1` removes it.

## Writing a case

```js
// e2e/specs/<area>.spec.mjs
export const cases = [{
  name: "the project opens on its conversation",
  seed: "basic",            // e2e/seeds/basic.json (or a seed object)
  viewport: "desktop",      // or "phone" (390×844), or {width, height}
  async run(t) {            // t: page, space, store, open(), settle(), snap(), fail()
    await t.open();
    await t.page.getByRole("link", { name: "demo" }).click();
    await t.settle();
    await t.snap("conversation", t.page.getByRole("main"));
  },
}];
```

- Drive the page the way a person does: roles and names, a click, a key. Don't reach into the app's state.
  Anything a case can only reach through internals is a gap in the app's accessibility worth fixing.
- Snapshot a region (`main`, a dialog, the panel), not the whole body, so that one change fails one golden.
- `t.store.writes` lists what the page sent. Assert on it when the behaviour is the request itself.

## Seeds

A seed is JSON in `seeds/`. It holds only what its cases need; everything else comes from the quiet Space
defined in `lib/store.mjs`. The keys are `now`, `chats`, `messages`, `threads`, `threadMessages`, `files`, and
`routes` (`"GET /api/…": body`, which wins over everything else). The rows are xo-space's own shapes; see
`tests/fixtures/storm-held-contract.json`. To replay a live turn, a case calls
`t.space.push(type, data, {chat_id, …})` with recorded frames, for example `tests/fixtures/plain-turn.sse`.

## Not here

- `fixtures/` and `worlds/` hold the mock worlds that tests/browser's suites use.
- tests/browser/ is the old lane. It takes 20–40+ minutes and pokes state from inside the page. Its suites move
  here one at a time, rewritten as cases in this form.
