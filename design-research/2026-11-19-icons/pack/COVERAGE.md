# The owner's icon pack in the app: coverage

**Pack:** `assets/icons/xo/` (384 SVGs + manifest.json, exported from Figma, 19 Nov). Unzipped into its own new folder; nothing else was merged into it.

**Safety:** every file passes an allowlist, checked on every build. The allowed elements are svg, g, clipPath, rect, path, ellipse and circle. The allowed attributes are geometry and paint only. There are no scripts, no foreignObject, no event handlers, no entities and no external or data: references. All 384 files passed.

**One source:**
- `tools/xoicons/build.mjs` turns the pack into `js/xoicons.js`.
- `js/icon.js` provides `xi(name)`, which draws one icon.
- `ICON` in `js/ui.js` names the icons the app uses most.
- Every other set draws through them: the panel, Map, Files, viewer, lightbox, chat actions, steps, Launchpad, links, quick open, file types, project topics, stamps and the app icon.
- Not one hand-drawn `<svg>` icon is left in these modules (`tests/xoicons.test.mjs` checks this).

**What the build changes, and only this:**
- Figma's frame wrapper (clipPath + clip-path) is removed.
- The ink `rgb(29 29 31)` becomes `currentColor`.
- The XO mark's two inks become its `.x` / `.o` classes, so the themes colour it.
- Ellipses with rx = ry become circles.
- Numbers are kept to 3 decimals.

Icons are named by file. The manifest writes the filled ones as `home.fill`, but the files are named `home-fill.svg`.

**Size:** `--ic` is 16 by default, with `--ic-xs` 12, `--ic-sm` 14 and `--ic-lg` 20 (css/tokens.css). The rule has no specificity, so any slot's own size wins.

## Coverage against ICONS.md (158 IDs)

| Section | IDs | Now the owner's | No file in the pack | Not wired yet |
|---|---|---|---|---|
| A Places and the frame | 22 | 22 | 0 | 0 |
| B Arrows and chevrons | 9 | 9 | 0 | 0 |
| C Actions | 25 | 25 | 0 | 0 |
| D Things and kinds | 28 | 28 | 0 | 0 |
| E State marks | 18 | 6 (needs-you in the panel, the three effort marks, the two stamps) | 0 | 12 |
| F Keyboard keys | 9 | 0 | 0 | 9 |
| G App icon | 2 | 2 (the tab icon, and the tab's working line on its foot) | 0 | 0 |
| H Project topics | 31 | 31 (plus the cube) | 0 | 0 |
| I File types | 14 | 14 (11 plain kinds, archive, folder, open folder) | 0 | 0 |
| **Total** | **158** | **137** | **0** | **21** |

**Not wired yet (21):**
- **E (12):** state-working, state-idle, state-done, state-failed, state-stopped, state-resolved, state-held, state-paused, badge-working, step-doing, alert, undo-countdown.
  - Today these are drawn in CSS (`.g-*`, about 20 rules) at 8 px, and your marks carry a soft halo disc.
  - I can switch them in one CSS block (as masks), but at 8 px the inner mark is about 3 px.
  - They want to be shown at 12 px. That's a size change across every list, so it's your call.
- **F (9):** the ⌘ ⇧ ⌥ ↵ ↑ ↓ ← → ⌫ keys.
  - Most of them are in tooltips (`title` text), which can't hold an SVG.
  - They could show in the shortcut sheet and Settings › Keyboard.

**Extra files (228 beyond the inventory):** sections J–Q, such as bell, calendar, filled variants and more arrows.
- 4 are used now, as file kinds Pierre had no plain icon for: file-markdown, file-pdf, file-audio and file-video.
- The rest are in `js/xoicons.js`, ready to use by name.

## Flags (not silently adjusted)

1. **Off the 24 grid:**
   - `xo-mark` is 42×20 (aspect 2.1, against the old mark's 2.42), so it sits a little narrower in its slots.
   - The two stamps are 88×88; they're shown at 84 and 88, as before.
   - `favicon` and `favicon-progress` are 48×48; they're tab icons, used as drawn.
2. **Line weight:**
   - Your pen is 1.75 on the 24 grid, which draws at 1.17 px at 16 px.
   - The old "Plan F" rule (css/base.css) held hand-drawn lines at 1.5 px at every size.
   - I kept your drawing as drawn: it scales with the icon, and its round ends and joins stay. Holding it at 1.5 px instead is one CSS rule.
3. **Stop in the composer:**
   - Your stop is a 12 square on the 24 grid, so in the old 14 px slot it would be 7 px.
   - The slot is now `--ic-lg`, which makes it a 10 px square in the 40 disc.
4. **Stamps:** your two discs are translucent, so the stamp keeps its own opaque ground (`--stamp-bg`) under them. Otherwise the card would show through while it lands.
5. **Markdown files:** these now use your `file-markdown`, where Pierre's M↓ mark was before. The other projects' marks (TypeScript, React, Docker and so on) stay Pierre's.
6. **Needs you:** your `state-needs-you` is a dot with a halo, not the diamond. It is used for the panel's thread badge. The sidebar and lists keep the CSS diamond until E is wired.
7. **Map agent cursor:** it is now 16 px (was 18). Its tip is framed at (1, 1), as before.

## Screenshots

`before/` and `after/` here show the same seven places, at 1440×900 except the phone: project dark and light, the thread ⋯ menu, the folded sidebar, Artifacts, Settings in light, and the phone.
