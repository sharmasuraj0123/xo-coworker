# The modular rebuild: approved

- **Decided:** 19 Nov 2026, by the owner, between 19:08 and 19:19Z.
- **What was decided:**
  - Build `architecture/PLAN.md` on the local branch `coworker/modular`, cut from `release/2026-11-19` at f006ec1.
  - Use parallel threads, which merge into `coworker/modular` through its owner thread.
  - **D1:** dev-only tools (TypeScript checking of JSDoc, oxlint). The app still runs from plain files with no build.
  - **D4:** move `ui-mockups/` and the tracked `design-research/` files out of the repo, to a design archive. The four files the tests need move into the test fixtures first.
- **Settled since:** D2, D3 and D5–D8, at 19:34Z (see 2026-11-19-plan-decisions-d2-d8.md).
