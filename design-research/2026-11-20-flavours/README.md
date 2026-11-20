# Flavours of Cowork: colour themes on STONE GLASS

Research and proposal only. Nothing has been built. Based on release/2026-11-19 at e6f3d32a, which is what :3000 serves.

## 1. Do we have a defined colour system? Mostly, yes, with two gaps that block flavours

**What's solid**

- `css/tokens.css` is the only palette. Colours are named by role, never by value:
  - surfaces: `--sunken --canvas --surface --float --fill-1…4`
  - lines: `--line-faint … --line-hover`
  - text: `--ink --ink-2…5 --on-ink`
  - accent: `--accent --accent-fill --accent-ink --accent-hover --accent-press`
  - status: `--err --warn --info --violet`, plus the three lights `--go --work --need --danger`
  - interaction: `--hover-fill --press-fill --focus`
  - depth: `--e2 --lift-*`
- Quiet tints are mixed from these with `color-mix()` (`--accent-subtle`, `--need-tint`, …), so they follow the theme without new values.
- The CSS uses about 8,000 `var(--…)` references, against about 320 literal colours outside tokens.css.
- **Dark** is the `:root` block. **Light** is `:root[data-theme="light"]`, which overrides the same role names.
- There are two other theme blocks:
  - an inverse block (`.toast`, `.lbx`, which stay dark inside light mode);
  - a `prefers-contrast: more` block.
- **No flash on load is already solved.** An inline script in the `<head>` of `index.html` (line 8) sets `data-theme` from `localStorage["cv-theme"]` before first paint. `applyTheme()` (js/app.js:116) then updates:
  - the diff theme;
  - `<meta name="color-scheme">`;
  - `<meta name="theme-color">`, read from `--canvas`.
- **The coordinator:**
  - `--coord: var(--violet)`;
  - `--coord-ink` and `--coord-ring` are mixed from it;
  - tests/coord-colour.test.mjs locks both.
- **Runtime marks** are vendor SVGs in js/vendor/agent-marks:
  - Claude: `#D97757`;
  - Antigravity: Google's four colours;
  - OpenAI: a mask in `currentColor`, so it already follows ink.
- **Contrast passes today.** I computed WCAG ratios from the token values:

| pair | dark | light |
|---|---|---|
| ink on canvas | 14.1 | 16.7 |
| ink-3 (meta) on surface | 5.4 | 7.2 |
| ink-4 (quiet) on surface | 4.8 | 5.3 |
| accent text on sunken | 10.5 | 4.70 |
| warn on sunken | 9.3 | 4.80 |
| ink-5 (placeholder) | 3.6 | 3.3 to 3.7 (only meant for placeholder text) |

Light's accent and warn on the sunken side are close to the 4.5 line. Any flavour that warms or tints the side will push them under it, so contrast checks have to be automatic.

**Gap 1: light mode is half tokens, half overrides.** Outside tokens.css there are **161 `[data-theme="light"]` rules**, and **104 of them hard-code a colour**:

| file | light rules | with literal colours |
|---|---|---|
| light.css | 60 | 37 |
| app.css | 42 | 30 |
| panel.css | 24 | 18 |
| launchpad.css | 11 | 2 |
| side.css | 6 | 5 |
| others | 18 | 12 |

Examples:
- `.nr-ic { background: #FFFFFF }`
- `.th-track { background: #E2E2E2 }`
- the Map's paper `#FAFAFA` with `#DDDDDD` dots
- `.dl-del { color: #9B1C22 }`

Some are duplicated and partly shadowed. app.css still has warm greys for the Map (`#FBFBFA`, `#DCDCDA`), but light.css loads after it and overrides them with neutral ones.

A flavour can only change tokens. Every one of these rules would keep its plain grey or white under any flavour. This is the main work before flavours are possible.

**Gap 2: palettes outside CSS.**
- `side.css` has its own parallel palette: `--sb-side`, `--sb-g17 … --sb-g45`, with separate dark and light values.
- `js/map.js`:
  - has its own agent palette (`#4C8DFF #A472FF #FF6FAE …`);
  - colours the coordinator `#7ED957`, which is green, while every other view uses violet. That's already an inconsistency.
- `js/shells/term.js` has two hard-coded 16-colour ANSI sets. It reads `--canvas` and `--ink`, but not the hues.
- `js/app.js:2913` paints the favicon/progress SVG with literal hex values.
- `js/diffthemes.js` is generated from the code tokens, but only for `xo-dark` and `xo-light`.
- `js/fileicons.js` and `js/rich.js` (Mermaid) read tokens, with fallbacks.

**Verdict:** the system is real and well named. Dark is fully token-driven. Light isn't yet: about 100 rules bypass the tokens, and a few JS palettes do too. Flavours are the right reason to finish that work.

## 2. How the industry does it

| system | what it does | what to borrow |
|---|---|---|
| **GitHub Primer** | Two separate axes on `<html>`: `data-color-mode="auto\|light\|dark"`, plus `data-light-theme` / `data-dark-theme` that pick a variant for each mode (light, light_high_contrast, light_colorblind, dark, dark_dimmed, dark_high_contrast…). Components only use functional tokens (`fgColor-muted`, `bgColor-accent-emphasis`), and those sit on primitives. | **Mode and flavour as separate axes**, and a user can pick a flavour for each mode. Functional tokens only. |
| **Radix Colors** | Each hue is a 12-step scale with a fixed job per step: 1–2 app backgrounds, 3–5 component backgrounds, 6–8 borders, 9–10 solid fills and hover, 11–12 text. Each scale has a light twin and a dark twin. | Map our roles onto **fixed steps of a generated scale**, so a new hue fills every role in one go. |
| **Linear** | Every theme, including the default light and dark, is generated in **LCH** from three inputs: **base, accent, contrast**. Contrast is its own control, which gives high-contrast themes for free. | Generate a flavour from a few inputs in a perceptual colour space, instead of hand-writing about 60 values. |
| **VS Code** | A theme is a JSON file of colour ids plus a `uiTheme` base (`vs`, `vs-dark`, `hc-black`). Any key the theme leaves out falls back to the base. | A flavour is a **partial override on top of a mode**. Anything it leaves out stays as Stone. |
| **Claude apps** | Light, dark and match-system as the mode. Claude Code's terminal adds colour-blind-friendly and ANSI-only variants. | Make **system** a first-class mode. Treat accessibility variants as flavours. |

Common ground: components never see primitives; mode and flavour are separate; themes are data, not CSS rules; there's a contrast gate; and the theme is set before first paint.

## 3. Recommendation for XO

**Two attributes on `<html>`: `data-theme` (mode, as today) and `data-flavour`. Each flavour is a small, generated, checked set of role-token overrides for each mode.**

1. **Axes.** Keep `data-theme="dark|light"`. Renaming it would touch 161 selectors for nothing.
   - Add a `system` choice that resolves to dark or light through `matchMedia("(prefers-color-scheme: light)")`.
   - Add `data-flavour="stone|…"`. Stone is today's palette, the default, and changes nothing.
2. **Where a flavour lives.**
   - Store: a new `css/flavours.css`, loaded right after tokens.css. That keeps "one place for the palette": tokens.css owns the roles, flavours.css only re-values them.
   - Write each flavour as two blocks:
     - dark: `:root[data-flavour="x"]{…}`
     - light: `:root[data-theme="light"][data-flavour="x"]{…}`
   - A flavour may only set role tokens: neutrals, lines, ink, and the accent set. It never sets a selector-level rule.
3. **What a flavour may change, and what it may not.**
   - **May change:** the neutral family (surfaces, fills, lines, ink tint) and the accent.
   - **Stays fixed:** the *meaning* colours, i.e. the go/work/need/danger lights, `--coord` violet, and the XO mark's green "O" (`--mark-o`). A flavour may re-tune their lightness for contrast but never swaps their hue, so green still means done and amber still means needs you everywhere.
   - **Runtime marks stay as they are.** They're the vendors' own signs. OpenAI's already follows ink.
4. **Generate, don't hand-write (Linear's pattern).**
   - Add `tools/flavours/build.mjs`, the same pattern as `tools/diffview/theme.mjs`.
   - Its inputs per flavour: neutral hue and chroma, accent hue, and an optional contrast level.
   - It writes OKLCH ramps out to hex steps, mapped onto our roles (canvas, surface, …, line-hover, ink-5), and writes flavours.css plus the diff themes for each flavour.
   - The output is static CSS, so nothing is computed at runtime and there's no flash.
5. **Contrast gate.** Add `tests/flavours.test.mjs`, a unit test run in Node with no browser.
   - It checks every flavour in both modes:
     - ink, ink-2, ink-3 and ink-4 ≥ 4.5:1 on canvas, surface, float and sunken;
     - accent, warn, info, violet and err-ink text ≥ 4.5:1 on those same surfaces;
     - accent-ink on accent-fill ≥ 4.5:1;
     - focus ring ≥ 3:1 against canvas;
     - hover-fill ≥ 1.15:1 against rest.
   - The build fails if any pair fails.
   - `prefers-contrast: more` keeps working on top of a flavour.
6. **No flash.**
   - Extend the existing inline head script to also read `cv-flavour` and resolve `system`.
   - `applyTheme()` already re-reads `--canvas` into theme-color, so the browser's bars follow.
   - Things drawn in JS (terminal, diff, Mermaid, file icons) already react to `data-theme` through a MutationObserver or `applyTheme`. They'd watch `data-flavour` too.
7. **Picker.** Add a "Flavour" row in Settings: swatches, each drawn from that flavour's own canvas, surface and accent. The sidebar's light/dark switch stays as it is.
8. **Glass stays removed.** A flavour carries no translucency or blur.

## 4. Work before the first flavour (phase 0)

This is the debt from §1. It has to go first, or a flavour leaves parts of the UI in plain grey. Each step goes through shared tokens, app-wide.

1. Turn the 104 literal light rules into role tokens. Add a role only where none fits (for example `--knob`, `--track`, `--paper` for the Map), giving it a value in both modes. Delete the shadowed warm duplicates in app.css. In my estimate, this removes most of light.css.
2. Fold side.css's `--sb-*` palette into the shared roles.
3. JS palettes, after a closer look, are left as they are:
   - the Map's agent colours are identity colours, like the chart palette (`--viz-*`), so a flavour shouldn't change them;
   - the Map's green coordinator is a question for the owner, since the violet is kept to threads on purpose;
   - the terminal already takes `--canvas` and `--ink`, and its ANSI hues are status hues;
   - the favicon is the app icon, which is the XO brand.
4. **Not touched:** panel.css (24 light rules) belongs to the right-panel audit. I'll pass the list to that audit instead of editing it.

Phase 0 should change nothing visible in Stone dark or light. That's its test: before/after token dumps match, and the unit tests pass.

## 5. Starter flavours (STONE GLASS's own, to be tuned together)

- **Stone** (default): today's neutral.
- **Sand:** a warm neutral (hue ~70°, low chroma), green accent kept.
- **Slate:** a cool neutral (hue ~250°), green accent kept.
- **Contrast:** Stone with Linear-style raised contrast, as an accessibility flavour.

An accent other than XO green is possible in the same system. I'd still hold it back: green is the brand's "O" and also means "go", so moving it needs a decision about `--go`.

## 6. Order of work (after the owner says OK)

| step | what | browser |
|---|---|---|
| A | phase 0 token clean-up, Stone unchanged | none, unit tests only |
| B | `data-flavour`, flavours.css, generator, contrast test, head script and `system` mode | none |
| C | Settings picker and the first two flavours | one small screenshot set at the end, under the lease |

## 7. Phase 0 as done

- Every opaque colour in a light-mode rule outside panel.css is now a role token. What's left is translucent black/white (shadows, edges), which carries no hue.
- Dead rules are deleted: the Map's warm-grey copies in app.css, `.next`'s light background, and the light `.th-knob` colour.
- New role tokens, each with a value in both modes:
  - switches: `--knob --knob-go --track --switch-on`
  - fields: `--field-bg --field-line --field-line-focus`
  - the Map: `--map-dot`
  - words in a status hue: `--warn-text --need-text --add-text --del-text --danger-text`
- The sidebar's frozen `--sb-*` palette moved, unchanged, from side.css into tokens.css.
- Stone is unchanged, except these light-mode nudges to the nearest role:

| where | was | now | shift |
|---|---|---|---|
| Send icon on green | #141414 | #1A1A1A | 6/255 |
| Map node hover edge | #ABABAB | #BDBDBD | 18/255, the one visible change |
| composer focus edge, button hover, Map dots, folder, tag, separator, tool hover, destructive card edge | | | 1–3/255 each, invisible |
