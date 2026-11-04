# Where "Create XO Project" lives — four ideas (2026-11-04)

Mocked on :3400 (xo/stone-glass) in a read-only browser: `tools/variants.cjs` injects CSS/HTML at runtime,
blocks every non-GET request, and changes nothing on disk. Shots in `shots/` (`<variant>-<theme>.png`, plus `-side` crops).

History: the Home header pill (green tile + "Create XO Project", `.create`) shipped with Home and is still live on :3000.
On stone-glass, Plan F (428405c, audit H3) hid it once any project exists, leaving the 13px "+" on the Projects label
(e43dbc8, 2026-11-03). The 2026-10-21 version was a full-width sidebar row under the brand (4562d65).

| | Where | Sidebar change? | Read |
|---|---|---|---|
| A | Home header pill back, always (the one the owner liked) | no | strong, one place |
| B | The sidebar "+" becomes a small "+ New" pill on the Projects label | yes, small | readable from every view |
| C | Green square "+" beside Find a project | yes | loudest; competes with the selected row |
| D | "New project" in the Workspace title bar | no | only where you direct |

Recommendation: A + B. A restores the invitation on Home; B makes the always-there entry readable without adding a row.
