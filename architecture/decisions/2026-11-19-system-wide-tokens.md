# Every visual change goes through shared tokens, app-wide

- **Decided:** 19 Nov 2026, by the owner.
- **Rule:** never fix one surface on its own.
  - Sizes, type, radii, motion and colours come from `core/ui/tokens.css`, and a change there applies everywhere.
  - There is one type scale.
- **Checked by:** the style rules of `node tools/check.mjs` (`tools/conformance/`).
