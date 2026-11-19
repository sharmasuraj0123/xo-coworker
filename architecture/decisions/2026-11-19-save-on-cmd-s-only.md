# Files save only on ⌘S

- **Decided:** 19 Nov 2026, about 11:42Z, by the owner.
- **Rule:** no autosave.
  - Drafts are kept locally (hot exit), but a file on disk changes only when the person presses ⌘S, or an agent writes it.
- **Watch out:** a few comments in `viewer.js`, `doceditor.js` and `docs.js` still say files "save themselves". They are stale; don't reintroduce autosave from them.
