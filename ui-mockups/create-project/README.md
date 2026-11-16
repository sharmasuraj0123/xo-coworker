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

## Craft audit (2026-11-04)

Audited 2762e03, then applied three CSS refinements. The mobile date and action now occupy
a grid row with 12px before the greeting (previously 1px). The light sidebar pill now uses
an inset 1px, 7% black ring, matching Find without the former outward ring and lift shadow.
The light Home button also retains its shared press fill: previously the light elevation
rule overrode it, making held press indistinguishable from hover. No other sidebar controls were changed.

Measured dark and light at 1440, 390 and 320px: pill/Projects centre delta 0px;
pill/Find right-edge delta 0px throughout. The phone greeting gap is 12px in both themes
at both phone widths. Desktop header geometry is unchanged.

All 48 control/state combinations were captured: rest, hover, keyboard focus-visible,
and held pointer press. Both controls retain 2px focus outlines; Home presses through
the shared inset fill, and the sidebar pill scales to .96. No writes were attempted or
projects created. The browser blocked non-GET/HEAD requests and released presses outside
the controls, avoiding activation.

Evidence: `craft-audit/measurements.json` and screenshots in `craft-audit/`.
Reproduce against the preview with this worktree's stylesheet substituted in the browser
(preserving stylesheet order, without modifying the preview worktree):

```sh
OVERLAY=1 XO_URL=http://127.0.0.1:3400 node ui-mockups/create-project/tools/craft-audit.cjs /tmp/create-project-audit
```
