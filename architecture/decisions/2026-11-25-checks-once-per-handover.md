# Fast checks while working, the full check once per handover

- **Decided:** 25 Nov 2026, by the owner: the process rules had become paranoia and slowed shipping; keep good engineering, drop the ceremony.
- **Rule:**
  - While working: the fast check (pre-commit) and the tests you touched.
  - The full check runs once, on the tip handed over for merge or deploy; never per commit or phase.
  - A bug fix has a behaviour test that fails without the fix; no ritual of breaking it on purpose.
  - File, function and line sizes guide ownership; only function and line length are checked, on new code.
  - A baseline may rise when the commit says why; a lower or raised baseline is a note, not a failure.
  - The modularization ledger is retired; `architecture/modular/LEDGER.md` is a frozen record.
- **Kept:** one heavy job at a time on the 8 GiB box, under a lease.
