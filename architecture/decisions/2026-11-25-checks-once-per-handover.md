# Fast checks while working, the full check once per handover

- **Decided:** 25 Nov 2026, by the owner: the process rules had become paranoia and slowed shipping; keep good engineering, drop the ceremony.
- **Rule:**
  - The repo's docs hold development practice only, nothing tied to one machine.
  - While working: the fast check (pre-commit) and the tests you touched.
  - The full check runs once, before a merge or deploy; never per commit or phase.
  - A bug fix has a behaviour test that fails without the fix; no ritual of breaking it on purpose.
  - File size is a prompt to look for a second owner, not a gate.
  - A baseline may rise when the commit says why; a lower or raised baseline is a note, not a failure.
  - The modularization ledger is retired; `architecture/modular/LEDGER.md` is a frozen record.
