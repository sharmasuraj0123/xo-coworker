# No browser test runs unless the owner asks

- **Decided:** 19 Nov 2026, by the owner.
- **Rule:**
  - Unit tests are fine at any time (`node tests/run.mjs`).
  - Browser suites run only when the owner asks, usually before a push or deploy.
  - Otherwise, one small final screenshot set.
