# 6 · CSS, tests, tools, assets and root files (snapshot /tmp/xo-6c73139 = 6c73139)

Scope: css/ (18 files, 6,841 lines), tests/ (168 entries + browser/lib/fixtures), tools/*, assets/icons (385), fonts/, presets/, root files, tracked ui-mockups/ and design-research/.
Method: read-only grep/wc/python over the snapshot; "tracked" taken from `git ls-tree -r 6c73139` in the real repo (the snapshot itself is not a git checkout, but its file list equals the tree at 6c73139).

---------------------------------------------------------------------------------------------------

## Part A · Stylesheets

### How CSS loads (index.html lines 15-42) — the cascade order is load-bearing

`base.css` (which `@import`s `tokens.css`) → `js/vendor/xterm/xterm.css` → `app.css` → `light.css` → `foundation.css` → `panel.css` → `diffs.css` → `launchpad.css` → `links.css` → `artifacts.css` → `dropdown.css` → `media.css` → `shape.css` → `side.css` → `msgx.css` → `rich.css` → `docs.css` → `phone.css` (last, "settles every earlier phone rule").
One more sheet is injected at runtime: `js/rich.js:91` adds a `<link>` to vendor `katex.min.css` on first math. No CSS is loaded by any other JS module; no inline `style=` attributes in index.html. Two inline boot scripts in index.html:8 and :11 set `<html data-theme>` (localStorage `cv-theme`) and `data-msgx="bubbles"`/`data-msgx-tails` (localStorage `cv-bubbles`) before first paint — every theme/bubbles selector in CSS depends on these.

Everything is global: every sheet styles classes from many features, and later sheets deliberately override earlier ones by source order (foundation "loads last" comment is stale: panel…phone load after it). In a module world with per-module CSS loaded in registration order, this order must be reproduced or the overrides converted to explicit layers (`@layer tokens, base, components, modules, overrides, phone`). That is the single biggest CSS migration risk.

### Custom properties, whole-folder view

- Defined in tokens.css: 195 properties (the only sanctioned scale). Other sheets define local/component properties: app 48, panel 17, side 16, rich 15, foundation 12, msgx 10, launchpad 7, shape 7, media 6, diffs 25 (Pierre `--diffs-*` hooks), artifacts 2, base 1, light 1, phone 1.
- Re-defined in more than one sheet (overrides by cascade or context): `--ink-3`/`--ink-4` (tokens, app, artifacts, foundation, rich — contextual re-inking), `--measure` (tokens, app, panel), `--ic` (tokens, app, launchpad), `--side-w` (app:8, side), `--col-w`/`--col-x`/`--hg`/`--dock-h`/`--gn-*` (app + panel), `--vw`/`--mw`/`--ring-in` (app + foundation), `--st` (app, msgx, rich), `--tb-line` (app, phone), `--cbar-fade` (tokens, app), `--d-hover` (tokens, base), `--code-bg` (tokens, diffs), `--halo` (tokens, launchpad), and density overrides in shape.css of `--h-row --h-ctl --fs-read --lh-read --fs-lg --fs-xl --lh-15` (compact density = a token layer, correct design).
- Set from JS only (no CSS definition; must stay in the owning module's contract): app `--dw --dx --dy --p --u`; artifacts `--wt`; launchpad `--ghosts`; media `--mx-g --mx-ih --mx-iw --mx-r --mx-tint --mx-w` (js/media.js); msgx `--herald-room --mx-drag --mx-pull --mx-wave`; panel `--ag-rows --dg-s --fc --fi-d --fi-l --tw`; rich `--at --dg-w --i --k --n --yw` and `--c` (js/rich.js:255); side `--pop-x --pop-y`. `--lnw` (panel.css:171) is set by nobody and always takes its `3ch` fallback.
- Defined and never used by CSS or JS (dead tokens): `--d-loop --danger-line --e1 --ease-out --edge --fs-xl(base) --lh-16 --need-line --need-tint --need-tint-2 --row-h --s-10 --tr-13 --tr-15 --viz-2…8 (used only by JS string `var(--viz-${i})`, so actually live) --z-dock`. Real dead set: `--d-loop --danger-line --e1 --ease-out --edge --lh-16 --need-line --need-tint --need-tint-2 --row-h --s-10 --tr-13 --tr-15 --z-dock`.
- Second palette outside tokens.css: side.css:4-9 freezes the sidebar's own `--sb-*` palette (owner rule, "ask before any change"); rich.css:183-184 defines the chart palette `--viz-1…8` for both themes; app.css:583-598 defines the code-colour tokens `--code-ink --code-kw …`; light.css and app.css:10-21 still hard-code light hex values per component. All four belong in core/ui tokens (as named sub-palettes), not in feature sheets.

### Token type/size scale added today (2026-11-19, css/tokens.css)

Commits on 19 Nov touching tokens.css (from `git log 6c73139 -- css/tokens.css`): 402ad77a `--halo/--cell-in` ("no state is ever a square"); b4f581e2 and 7105fb8c "one type scale" (tokens.css:95-107: read 16/24 `--fs-read/--lh-read`, ui 14/20 `--fs-md/--lh-14`, label 13/20 `--fs-base/--lh-13`, meta 12/16 `--fs-sm/--lh-12`, heads 20/28·28/36·40/44, weights 400/500/600, "no local sizes"); c0b2d75a `--measure` (column less `--s-12`, min 480); 3914600b `--cap-mid` (icon centres on cap height); adbb1fae `--halo-row`; 7d17db18 places (`--float-inset --h-phonebar --rail-w --grip-w --grab-w --grab-h --side-rail-w`); e89d1610 size scale (`--h-sm 24 --h-ctl 32 --h-lg 40 --h-bar 56 --h-row 40/48/56 --h-touch 36 --h-hit 44 --tile 32/36/44`); 08adcbd3 `--gap-icon --dock-gap --cbar-fade`; ff218127 `--mark-sm`; f4790342 `--coord-ink --coord-ring`. Notes: `--fs-xs` and `--fs-sm` are both 12, `--fs-lg` and `--fs-xl` both 15 (aliases kept for old call sites); `--r-xs` = `--r-sm` = 6. The "one scale" rule is enforced by tests (design-budget, ctl-scale, app-ctl-scale, type-scale-style tests; see Part B), which read the CSS files by path — those tests must move with the token file.

Proposed home: tokens.css → **core/ui/tokens.css** unchanged, plus the sub-palettes pulled in (sidebar `--sb-*`, code `--code-*`, chart `--viz-*`, light-theme component hexes). base.css → **core/ui/foundation**.

---

### css/tokens.css (245 lines)
- Purpose: the design system's single token file: both themes (`:root` dark 26-90ish, `:root[data-theme=light]` ~165-200), inverse surfaces for `.toast,.lbx` in light, high-contrast media, mixed status tints, phone overrides of `--h-row` and `--cbar-fade` (last 2 lines), and the two `@font-face` rules for Geist/Geist Mono (lines 10-11, `../fonts/geist/*.woff2`).
- Defines 195 properties; uses 24 (only its own). Selectors outside :root: `.toast` and `.lbx` (inverse-surface block) — a component reference inside the token file.
- Imported by: base.css:3 (`@import url("./tokens.css")`). Read by tests via path (tests/lib/tokens.mjs and many css tests).
- Smells: component names (`.toast,.lbx`) in the token file; alias tokens with identical values; dead tokens listed above.
- Proposed home: core/ui/tokens.css (+ fonts into core/ui/fonts). Move the `.toast,.lbx` inverse block into a `.theme-inverse` utility class in core/ui so modules opt in.

### css/base.css (52 lines)
- Purpose: reset + body type, `[hidden]`, the one focus ring (`:focus-visible`), `scroll-margin` for ring room, "every control answers" press/hover transitions (19-30), icon stroke rules (31-52: hand-drawn line icons and the owner's xoicons pack `js/xoicons.js` keep their own pen), `.sr-only`, reduced-motion contract.
- Cross-feature selectors: `xo-select` (dropdown), `.side` (sidebar), `.xo-mark` (brand).
- Proposed home: core/ui/foundation.css (reset, focus, motion contract, icon strokes). Move the `.side`/`.xo-mark` lines to shell sidebar CSS.

### css/app.css (3,149 lines) — region map, whole file, no gaps

| Lines | Region (selectors) | Proposed home |
|---|---|---|
| 1-9 | header comment; `:root{--side-w:264px;--pw;--dock-h:150px}` (layout vars) | shell (layout tokens) |
| 10-21 | light-theme per-component hex overrides: body, `.send`, `.next`, `.prow.needs`, `.hr-t`, `.dl-add/.dl-del`, `.c-facts`, `.facts`, `.th-knob`, `.xo-mark` | split: each to its module's light block; or core/ui tokens as role colours |
| 22-30 | globals: `::selection`, `html,body{overflow:clip}`, body bg, `code`, `.muted`, button tap/disabled | core/ui foundation |
| 31-53 | state glyphs `.g`, `.g-working/idle/needs_reply/done/failed/stopped/resolved/held`, `.badge`, `.tcard` working | core/ui (status glyph component; used by sidebar, cards, links, Now chips, header) |
| 54-66 | effort label `.eff .dial`, speaker colours `.e-glance/.e-decide/.e-think`, `.risk` | decisions (risk) + composer (effort) |
| 67-73 | coordinator suggestion `.c-sug` | decisions |
| 74-76 | `.app` grid | shell |
| 77-191 | sidebar: `.side .side-top .theme .th-track/.th-knob` (theme toggle), `.brand .xo-mark .side-x .help .side-foot .sh-tog .sh-n` (shells toggle), `.gear` (settings), `.side-find .sf-ic #pf-in .sf-n .pf-none` (project filter), `.nav .nrow .nr-*` (nav rows), `.side-label .side-plus` (+ New), `.projects .prow .pr-*` with `@property --pr-a` orbit, needs-you accent, `@keyframes wash` | shell/sidebar (`.sh-tog` → shells' sidebar.entry; `.theme` → settings/appearance contribution) |
| 192-217 | main geometry: `.main`, one geometry for the main area (197-217), `.panel-open/.stage-open/.viewer-open` modifiers, `.phonebar` | shell |
| 218-330 | Home: `.home .hm .hm-top .hm-hd .hm-date .hm-h`, Create XO Project `.create .cr-s`, labels `.hm-lbl`, next move card `.next .nx-*` (orbit `@property --nx-a`, in/out keyframes), `.then .ti-*`, `.hm-quiet`, `.calm` | modules/home; `.next` card's look shared with decisions (decision.card) |
| 331-471 | conversation frame + headers: `.conv`, `.top` (project & thread header), `.top-end .top-back .top-who .tw-ic .tw-t`, `.pj-s .pj-need .pj-home .wsh-home .all-btn .tw-h .ck-br .tw-mini .tw-xo`, `.st-working`, container queries `@container top`, checklist `.thead .ckbar .ck-row .ck-tog .ck-segs .sg .ck-n .ck-now .ck-m .ck-chev .ck-b .ck-list .ck .ck-done/doing/todo` (seg-fill/seg-pop), `.scroller .column` + col-up/col-r/col-l keyframes | conversation (frame, scroller) + shell header host; header pieces: projects (`.pj-*`), threads (`.tw-*`, checklist `.ck*`) |
| 472-498 | Workspace overview head `.ws-head .wsh .wsh-*`, `.day`, `.msgs` | home/workspace (projects) |
| 499-617 | messages: `.m .m-you .bubble .meta .sent .tk .spin .meta-btn .route-row .m-them .av .av-t .av-gap .mb .mh .prose`; code blocks `.md-code .md-copy`, tables `.md-table`; code colour tokens (583-598 `:root{--code-*}`); highlighter `.hl .tk-*` (599-617) | conversation (message blocks); code tokens + `.hl/.tk-*` → core/ui (shared with Files viewer) |
| 618-660 | thread cards inline `.tcard .tc-open .tc-top .tc-st .st-* .tc-segs .tc-now .tc-foot .tc-go .tc-dec .tc-next` | threads (conversation.block "thread-card") |
| 661-672 | event line `.ev .ev-ic .ev-back .ev-stop .ev-t` | conversation |
| 673-687 | typing/working `.typing .av-w .ty-b .shimmer .dots .elapsed` + shimmer/bounce/breathe | conversation |
| 688-793 | dock + composer: `.dock .cbar .herald .stage-covers .hr .hr-t/-s/-dot/-ic/-go/-calm/-ev` (notices line), `.composer .cref .cref-x .composer-field .composer-row .target .send` (+fire), Stop, `.at-list .at-ic .at-s` (@-mention list), `.tdock` (thread decision docked) | composer; `.hr*` herald → conversation/notices; `.tdock` → decisions (composer.above slot) |
| 794-899 | Intelligence chip + popover `.iq .iq-l/-t/-a/-e/-sep/-cur/-next/-nk/-nw .iq-pop .iq-h .iq-truth .iq-now .iq-list .iq-row .iq-route .iq-rl .iq-sec .iq-more* .iq-f .iq-back .iq-done .iq-err .iq-mv*`; then 887-899 the shared float/sheet/rise keyframes (`float-in/out(-down/-up)`, `sheet-in/out`, `rise-in`) | composer/model-picker (new module "intelligence"); keyframes → core/ui motion |
| 900-925 | since you were away `.since .sl-*` (900-919); return pill `.mx-return` (920-925) | conversation |
| 926-994 | decision buttons `.b .b-l .b-allow .b-done .b-back .b-go .b-ghost .b-opt .o-pv/.o-s/.o-l .c-btns .b-sm`, hold-to-confirm `.b-hold .hold-*` (settle/nope), `.c-note*` | decisions (but `.b-hold` is used by worktrees/settings too → core/ui hold button) |
| 995-1222 | global decision panel `.panel .pn-*`, rail `.rs .rail-gap`, card `.card .card-in .c-body .c-top .c-where .c-h .c-line .c-facts .facts`, details `.dis .dt-*`, `.chg .dl-add/.dl-del .r-destructive .ev-msgs .ev-br .full .fm*`, actions `.c-act .c-opts .c-low .b-later .b-open`, teach `.teach-*  .sw`, `.c-hint`, thread card wide layout 1133-1165 (`.dock-more .dm-p`), stamps 1166-1196 (`.stamp*`, ci-* keyframes), done 1197-1207, vigilance `.vig` 1208-1214, `.confirm .cf-p` 1215-1222 | modules/decisions |
| 1223-1240 | toast `.toast-wrap .toast .t-ic .t-back .t-m .t-undo .t-ring` | core/ui toast |
| 1241-1282 | Home's last line: `.hm-body #hm-body .nx-est .c-est .in-panel .handled .hd* .mini .cw*` | modules/home |
| 1283-1307 | thread's own card fold: `.dock-hide .dock-fold .df-* .tp-done*` | decisions |
| 1308-1320 | intelligence-change records `.ev-rec .ev-undo .m-iq .tc-cw .hr-undo .hr-ic.k-ping` | conversation (event blocks) / intelligence |
| 1321-1409 | dialogs and sheets: `.dlg .dlg-head .dlg-ic .field .dlg-err .dlg-foot .btn .btn-pri .sheet .sheet-card .sheet-h .x`; inside, create-project parts `.cp-note .cp-code .cp-link .cp-mode .cpm-ic .cp-in .cp-prog .cp-bar .cp-row .cp-what .cp-phase .cp-facts .cp-t .cp-stop .cp-hint` (1338-1383) | core/ui dialog/sheet/button/field; `.cp-*` → modules/create-project |
| 1410-1457 | All threads sheet `.all-card .all-tools .all-q .all-f .all-list .ar-list .ar .ar-t/-tl/-s/-a/-done/-fold/-db/-di/-none` | modules/threads |
| 1455-1469 | ⌘K palette `.jump-field .jump-card .jump-list .j-ic .j-n .j-s .j-none` (overlaps previous range at 1455-1457) | modules/search (quickopen) |
| 1470-1477 | keys help `.keys-card .keys-cols .keys` | core/platform keys (help sheet) or settings |
| 1478-1549 | settings page `.help .settings .set-top .set-body .set-nav .sn-ic .set-page .set-ph .set-intro .set-empty .set-row .set-sec .set-l`; Keyboard `.kp-t .kg .kl .kr* .kp-f`; `.switch` (1538-1543); 1544-1549 a reduced-motion/phone tail for `.hm .hm-lbl .next` | modules/settings; `.switch` → core/ui |
| 1550-1559 | laptop media (761-1180): `--side-w:248px`, `.then-i .ti-p .card` | shell + home + decisions (split per module) |
| 1560-1684 | phone media (≤760): `--pw:100%`, `.app .side .side-scrim .main .phonebar .pb-*`, home, `.top .all-btn .pj-s .thead .ck-*`, `.scroller .ws-head .wsh-*`, `.cbar .herald .composer .dock .target .bubble .av .hr-s`, `.card .dock-hide .conv`, panel as sheet (sheet-up/down), `.pn-* .c-body .c-act .b .tcard .tc-*`, `.keys-cols`, settings, `.sheet .ar .help .nx-* .iq .b-opt .hd-row0`, `.pd` | cross-feature: split into each module's own `@media (max-width:760px)` block (phone layout in shell) |
| 1685-1746 | live wiring: `.rt-go .route-row .m-card .m-note`, empty-project starts `.m-start .st-h .st-list #composer .st-o .st-ic`, `.day`, `.hist-more`, history skeleton `.hist-skel .hs-*` (hs-in/hs-breathe), `.ev-sys .ev-asked`, `.target` variants, `.hr-conn` (connection line) | conversation (+ projects for `.m-start`) |
| 1747-1843 | storm turns: `.m-turn .turn .tb-h .tb-hi .tb-ht .tb-n .tb-chev .tb .tb-spin .tb-act .tb-steps .tb-rows .tb-rh/-ri/-rl/-rp .tb-m .tb-row .tb-rb .tb-cmd .tb-out .tb-note .tb-plan-l .tb-narr .tb-text .tb-files .tb-fh/-fl/-file/-fi/-fn/-fm .tb-end .tb-work .tb-wh .tb-wn .tb-rail .tb-bad .tb-chg .tb-cf*`, `[data-density]` variant, paused `.g-paused .st-paused` | conversation (turn renderer; conversation.block kinds) |
| 1844-1894 | thread header: `.tw-label .tw-rt .ar-r`, agent marks `.agm .agm-claude/-antigravity/-openai .agm-n`, `.tw-acts .tw-act .tw-more .tw-menu`, rename `.tw-in .tw-in-l .ar-l`, `.hr-conn`, `.top` tails | threads (header.action) ; `.agm` → core/ui (agent marks, used by sidebar/panel/threads) |
| 1895-1924 | storm review items in the decision kit: `.o-d .c-qs .c-q* .c-name .c-iwhy .teach-scope .dt-facts .chg` | decisions |
| 1925-2001 | sub-agents / runs: `.rn-strip .rn-it .rn-chip .rn-log .runs-card .rn-h/-back/-stopall/-body/-k/-list/-row/-open/-main/-t/-m/-s/-stop/-none/-stops/-stopping/-said*/-top/-path/-st/-run/-sum/-foot .rt-in .rt-k .rt-call` + phone | new module **runs** (sub-agents), or threads |
| 2002-2073 | settings for storm: `.set-live .set-sec .set-lead .set-note .set-err .set-choices .set-choice .sc-* .set-form .set-fa .set-confirm .btn-danger`, rules `.rl-*`, worktrees `.wt-* .wt-hold`; 2071-2073 live intelligence popover note | modules/settings (sections: routing, rules, worktrees); `.btn-danger` → core/ui |
| 2074-2092 | Chats (plain chats U1): `.ch-list .ch-row .ch-main .ch-t .ch-m .ch-a .ch-calm .tg-ch .cs-pop .cs-f .cs-modes .ch-confirm`, `.target` | modules/chats (new; or conversation "chat" kind) |
| 2093-2122 | phone 36 px floor for `.side-x .target .tc-dec .dock-hide .tb-h .m-turn .hr .rn-chip #say .kr-k`; phone failure row `.hr-ev`; Send now toggle `.tg-now .tg-now-on` | split per module; `.tg-now` → composer |
| 2123-2215 | shared files: card on a turn `.tb-file .tb-fb .tb-ft .tb-fo`; the viewer `.viewer .vw-top .vw-ic .vw-t .vw-sub .vw-acts .vw-btn .vw-x .vw-seg .vw-body .vw-md .vw-frame .vw-img .vw-narrow .vw-code .vw-ln .vw-src .vw-cut* .vw-more .vw-empty .vw-path .vw-path-copy` (+ `:root{--vw}` 2140) | modules/files (viewer) ; `.tb-file` → conversation block contributed by files |
| 2216-2252 | "Light, not costume": 2221-2228 two `:root{(1100px …)}` rules whose property name is missing (invalid CSS, dropped by the parser: dead), `.settings` bg, decision card state line `.card::before`, thread header state line `.top[data-state]::before` + `sl-sweep`, instrument type `.md-code .vw-code .ck-n .pn-count .tc-st .nr-n .pr-w`, `.settings .set-top` | split: decisions, threads header, core/ui; delete 2221-2228 |
| 2253-2329 | files on a message: `.attach .att-tray .att .att-ic/-t/-n/-m/-err/-b/-tx/-bar .att-note`, composer measurements, `.drop-veil`, reactions `.m-reacts .m-react*`, `.m-files`, `.vw-pdf`, phone tails | composer (attachments) ; `.m-reacts/.m-files` → conversation ; `.vw-pdf` → files |
| 2330-2450 | shells: `.app/.side/.main/.top-end` with shells, `.sh-btn`, dock `.shd .shd-grip .shd-bar .shd-tabs .shd-tabw .shd-tab .shd-tab-list .shd-tn .shd-c .shd-tx .shd-dot .shd-acts .shd-where .shd-act .shd-ic .shd-in .shd-body .shd-confirm .shd-ca .shd-term .shd-x .shd-note`, list `.shd-list .shl-*`, phone sheet 2429-2450 | modules/shells |
| 2451-2492 | touch gestures: `.conv.is-swiped`, long-press menu `.lp-menu`, swipe `.ar-list .ar-undo`, phone `.m-you`, dragged `.side .sheet-card .panel .shd-bar .shd` | core/platform gestures (+ core/ui menu); `.ar-undo` → threads |
| 2493-2626 | project record: since you left `.since .syl .syl-*` (2493-2536), Made sheet `.all-btn.is-made .made-card .md-h .md-tools .md-body .md-gh .md-grid .md-it .md-open .md-th .md-ic .md-ext .md-meta .md-from .md-pin .md-recent` (2537-2588), skeleton `.sk .hm-sk` + sk-breathe (2589-2601), light/phone tails (2602-2626) | modules/artifacts (Made) + projects (since-you-left record) ; `.sk` → core/ui skeleton |
| 2627-2845 | Map: `:root{--mw}`, `.map-btn .map .map-full .mp-head .map-host .mp-top .mp-hic .mp-t .mp-sub .mp-br .mp-sep .mp-x .mp-full .mp-now .mp-nl .mp-legend .mp-who`, canvas `.dg .dg-world .dg-edges .dg-nodes .dg-n .dg-ic .dg-t .dg-ch .dg-dot .dg-mk .m-new .m-edited .m-deleted` (dg-hit), graph `.k-graph .gn .gn-d .gn-l` (gn-hit), cursors `.dg-curs .dg-cur .dg-arrow .dg-tag .dg-more` (dg-ping), tools `.dg-tools .dg-mode .dg-sep .dg-key`, Live·File switch `.stage-tabs .st-file .st-tab .st-x .viewer .map` (2815-2830), narrow float (2831-2845) | modules/map ; 2815-2830 → shell panel host |
| 2846-2948 | the panel (js/stage.js): `.stage-open .panel-open .stage .stage-full .stg-bar .stg-tabs .stg-tab .stg-n .stg-filew .stg-x .stg-acts .stg-ic .stg-body .stg-pane .stg-btn`, Made tab `.md-pane .md-none` (2895-2904), project title switcher `.pj-title` + `.sheet` (2905-2921), `.top` short, agent at work `.av-live .tb-live` (2926-2936), ⌘K thread `.j-th`, Threads button `.th-btn` + `.sheet` (2940-2946), `.stg-pane` new-messages centring | shell (panel host); `.md-pane` → artifacts; `.pj-title` → projects; `.av-live .tb-live` → conversation; `.th-btn` → threads; `.j-th` → search |
| 2949-3013 | Files: `.fl .fl-tree .fl-pv .fl-view .fl-empty .fl-bar .fl-back .fl-head .fl-crumb .fl-up .fl-q .fl-list .fl-sec .fl-r .fl-c .fl-i .fl-n .fl-sz .fl-who .fl-note .fl-link` | modules/files (`.fl-link` quiet text link is reused by Runs → core/ui) |
| 3014-3064 | Settings › Runtimes: `.rt-list .rt-card .rt-hd .rt-v .rt-pill .rt-sub .rt-acct .rt-why .rt-fix .rt-ws .rt-w* .rt-bar .rt-checked .rt-seg .rt-checks .rt-check .rt-def` | modules/settings (runtimes section) |
| 3065-3073 | runtime move event `.ev .mv-ban` | conversation |
| 3074-3093 | usage limit `.lim .lim-when .next .lim-acct .lim-credits .lim-ts .lim-stay .lim-ban .lim-h .lim-why .lim-acts` | decisions/home ("Needs you" card) |
| 3094-3097 | coordinator control rows `.ev-ctl` | conversation |
| 3098-3100 | picker comments only (rules absent) | (none; comments) |
| 3101-3108 | runtime defaults `.rt-defs .rt-def .rt-ferr .rt-saved` | modules/settings |
| 3109-3117 | thread ⋯ menu groups `.tw-sep .tw-menu`, delete in place `.tdel` | modules/threads |
| 3118-3127 | All threads' agent mark `.ar .ar-a .ar-mk` | modules/threads |
| 3128-3149 | project header on one line `.tw-t`; Threads control `.th-ctl`, `@container top` | projects (header) / threads |

- Custom properties: 48 defined (layout `--side-w --pw --dock-h --col-w --col-x --hg --mw --vw --ring-in --gn-* --tb-line --st --nx-arc --nx-a --pr-a`, code `--code-*`), 221 used (147 from tokens, 12 from side.css `--sb-*`).
- Smells: one 3,149-line global sheet styling ~25 features; phone rules in three places (1560-1684, 2093-2122, per-region tails) plus phone.css; light overrides split between app.css:10-21, light.css and per-region `[data-theme=light]` tails; invalid rules at 2221-2228; `!important` ×7; ID selectors `#pf-in #hm-body #composer #say` couple CSS to index.html markup.
- Proposed home: dissolve. Each region above into its module's CSS; foundation pieces (globals, glyphs, buttons `.btn`, dialog/sheet/field, toast, switch, skeleton, motion keyframes, code tokens + highlighter, agent marks) into core/ui.

### css/light.css (85 lines)
- Purpose: light-theme rules beyond the palette: structure separators 4-9, sidebar 10-30, composer 31-34, home 35-51, conversation 52-62, floating surfaces 63-85.
- Selectors: 66 `[data-theme]`-prefixed rules over `.side .side-foot .top .thead .set-top .since .tb-out .nr-ic .pr-ic .prow .gear .th-* .theme .switch .composer .next .hd .calm .md-* .wsh-mark .bubble .tcard .ckbar .hr .b-* .panel .stage .map .viewer .dlg .sheet .sheet-card .card .dock-fold .all-card .iq-pop .tw-menu .lp-menu .at-list .field .dg* .gn-*`.
- Defines 1, uses 19 (2 from side.css).
- Proposed home: dissolve into each module's own light block (or, better, role tokens so modules need no light rules). Shared `.field .switch .dlg .sheet` → core/ui.

### css/foundation.css (267 lines)
- Purpose: the 8 structural rules from the 2026-11-03 critique, applied across features: 13-31 side panels flush; 32-37 canvas one colour / sidebar keeps its look; 38-47 hover inside column; 48-60 chosen control answers pointer; 61-79 press (outer box never moves); 80-132 text-like controls get a halo, flush-bar cells an inset fill (19 Nov); 133-138 integer line heights; 139-187 icon centring + concentric corners; 188-206 one focus ring (incl. `.send.is-stop`); 207-214 nothing loops unless an agent works; 215-233 "worst three" (settings nav, Home empty); 234-238 one motion system (js/motion.js); 239-250 no blue dot in sidebar.
- Defines `--sw --edge --row-h` (`--edge --row-h` dead) and 9 more; uses 52.
- Cross-feature: touches ~90 classes across every module (`.top .stage .stg-grip .next .tb-h .stg-tab .set-nav .theme .switch .vw-cut-dl .wsh-home .fl-link .shl-all .tp-done-u .send .jump-list .cp-link .tg-ch .lp-ln .md-pane .shd-tabw .b-hold .xd-btn .dd-row .iq-row .rt-check …`). `!important` ×14 (the highest).
- Proposed home: the rules (halo, press, ring, integer lh, concentric) become core/ui component primitives (`.ctl-text`, `.cell`, `.press`) that modules use by class; the per-feature selector lists dissolve into each module. Must keep its precedence over app.css until then.

### css/panel.css (639 lines)
- Purpose: the right panel ("stage") on one grid. Regions: 1-16 grid comment; 17-32 the strip (tabs, counts); 33-37 floats over a narrow conversation; 38-49 scope line + field; 50-83 Files tree rows (`.fl .fl-r .fl-c .fl-split .fl-q .fl-sec`); 84-110 New file / ⋯ menu (`.fl-menu .fl-new-r .fl-new-say .fl-rb`); 111-176 file viewer header (`.vw-top .vw-ic .vw-t .vw-btn .vw-seg .vw-menu .vw-fold .vw-l .vw-mw`); 177-222 Made (`.md-pane .md-tools .md-it .md-th .md-from`); 223-251 Map in the panel (`.map-host .dg .dg-tools`); 252-258 file icons; 259-330 working arc (`.arc .spin .av-live .ty-b .elapsed`); 331-343 Agents rows (`.ag-r .ag-t .ag-ic .ag-tm .ag-wait`); 344-435 Changes frame rows (`.fr .fr-gut .fr-t .fr-h .fr-b .fr-ib .ch-r .ch-m .ch-i .ch-n .ch-list`); 436-440 thread glyph; 441-476 whole rows, 44 px; 477-541 map rail (`.gn .gn-d .dg-n`); 542-557 Threads frame groups (`.tg-*`); 558-565 agent mark under time; 566-577 shell mode (`.dock` in panel); 578-598 Threads filter (`.tg-qf .all-q`); 599-617 page tabs (`.pg-tab`), Files show/hide; 618-639 Thread page (P2, `.tp`).
- Defines 17 (`--col-w --col-x --hg --dock-h --gn-* --measure`), uses 96; `--lnw` never set.
- Cross-feature: 156 `.stage` selectors scoping Files, Made, Map, Changes, Threads, Agents, Shells, conversation (`.ty-b .tb-wn .av-live`).
- Proposed home: 1-49, 599-617 → shell (panel host); 50-110, 111-176, 252-258 → files; 177-222 → artifacts; 223-251, 477-541 → map; 259-330 → core/ui (working arc); 331-343, 542-598 → threads; 344-435 → changes; 566-577 → shells; 618-639 → threads (thread page) + conversation.

### css/diffs.css (245 lines)
- Purpose: @pierre/diffs look via `--diffs-*` custom properties on `diffs-container` (1-35); counts 36-41; a turn's changed files chip 42-45; the panel's Changes (`.cx-*`, js/changesframe.js) 46-113; Files › diff and whole-file through Pierre 114-162; file state in head, read-only places, run-code files, ask/merge/follow (`.xd-*`, `.vw-menu .vw-more`) 163-242; Before/Now images (`.ximg*`) 243-245.
- Defines 25 (Pierre hooks + `--code-bg`), uses 65 (3 from panel.css, 2 from app.css).
- Cross-feature: `.tb-cf` (conversation turn chip), `.stage` ×60, `.fl-r`, `.vw-*` (Files viewer).
- Proposed home: modules/changes (cx, Pierre theme) + modules/files (`.xd-*`, viewer modes); the Pierre theming block → vendor adapter in core/ui (`diffs-theme.css`) since both Changes and Files use it.

### css/launchpad.css (438 lines)
- Purpose: Launchpad frame in the panel (`.fr-lp` tones 1-31, head 32-58, body 59-92, settings 93-151, buttons 152-283, system view `.lpv-*` 284-342, mini flow in panel `.lpm-*` 343-418, open-over-frames 419-438). Also `.tw-act` Deploy in thread header (263-283).
- Defines 7 (`--tone --halo --ic --ghosts`…), uses 77. Reaches `.stage .fr-*` (panel frames), `.dd-btn xo-select` (dropdown), `.tw-act` (thread header).
- Proposed home: modules/launchpad (one of the cleanest; only the `.tw-act` header button is a header.action contribution).

### css/links.css (104 lines)
- Purpose: link tokens in messages (inside capsule `.lk-in .lk-ic .lk-t .lk-thread .lk-file .lk-fit .lk-tg`, 15-76; outside `.lk-out .lk-ar` 77-104). Uses state glyphs `.g .g-*` and file icons `.fi`.
- Proposed home: conversation (markdown renderer's link styles) — or core/ui "link-token" if Files/Docs render the same Markdown.

### css/artifacts.css (126 lines)
- Purpose: the Artifacts place (js/recordview.js): sidebar count `.nr-q` (5-7), page `.arts .ar-head .ar-tools .ar-q .ar-kinds .ar-grid .ar-wrap .ar-body .ar-none` hiding the dock via `.app[data-view="artifacts"] .dock`, cards `.md-th .md-meta .md-well .md-pic .md-pin .md-sheet`, picture wells 99-103, Home's Recently made 104-126 (`.mx-mid .mx-mh .mx-mt`).
- Cross-feature: `.nrow` (sidebar), `.dock` (composer), `.tw-ic`, `.mx-*` (media). Note `.ar-*` prefix collides with All threads' `.ar` rows in app.css 1410-1453 and 3118-3127 (different meaning, same prefix).
- Proposed home: modules/artifacts (+ sidebar.entry count; home contribution for Recently made).

### css/dropdown.css (52 lines)
- Purpose: `<xo-select>` custom element (js/dropdown.js): button `.dd-btn`, list `.dd-menu .dd-row .dd-mk .dd-dot .dd-t .dd-d .dd-v`, phone sizes.
- Cross-feature: `.ar-pj` (artifacts project filter), `.cs-f` (chats), `.set-row` (settings) width overrides.
- Proposed home: core/ui components/dropdown.css; the three context rules move to their modules.

### css/media.css (127 lines)
- Purpose: pictures/files in messages (`.mx-stack .mx-one .mx-img .mx-state .mx-album .mx-tile .mx-row .mx-more .mx-cap .mx-tag .mx-weblink*`, 8-91) and the lightbox (`.lbx .lbx-*`, 92-127).
- JS-set props `--mx-w --mx-r --mx-tint --mx-g --mx-iw --mx-ih` (js/media.js). Cross: `.prose .m-you .bubble .tb-files .tb-fh .tb-fl .lk-ar`.
- Proposed home: conversation (media block) + core/ui lightbox (artifacts also opens it).

### css/msgx.css (408 lines)
- Purpose: the bubbles look under `<html data-msgx="bubbles">` plus things shared by both looks: back-to-latest `.mx-down` 8-23, reply bar/actions `.mx-acts .mx-reply .mx-qpop .mx-qc .mx-r-*` 24-108, bubbles 109-140, last-message gap 141-213, the agent's work pill 214-226, working bubble 227-235, scroll anchoring 236-248 (load-bearing; see memory "chat scroll anchoring traps"), mid-turn turn 249-293, opened work card 294-335, tails 336-350, thread-started card `.tcard` 351-408.
- Selectors: 131 `[data-msgx]`, `#msgs` ×29, `#tmsgs` ×29 (IDs of the two message lists: main conversation and the thread page), `.m-turn .turn .tb* .tcard .tc-* .sg .typing .ev .av .mh .mb`.
- Defines 10, uses 76; JS-set `--herald-room --mx-drag --mx-pull --mx-wave`.
- Proposed home: modules/conversation as a "look" (bubbles) variant; `.tcard` styling 351-408 → threads' card block (with rich.css 122-160 for the document look).

### css/rich.css (232 lines)
- Purpose: the document view (default look; `:root:not([data-msgx])`, 6-45), one rhythm 46-83, sign of life while a turn runs 84-98, action row `.mx-actrow` (js/msgx.js actionRows) 99-121, thread card in document view 122-160, math KaTeX `.md-math .md-display .katex` 161-177, charts `.md-chart .mc-*` + `--viz-1…8` palette 178-218, Mermaid diagrams `.md-diagram .md-dg-src .node` 219-232.
- Selectors: 68 `[data-msgx]`, `#msgs #tmsgs #typing #ttyping`.
- Proposed home: conversation (document look + rhythm + action row); rich blocks (math/chart/diagram) → a "rich" sub-module registering conversation.block renderers (also usable in Files Markdown); `--viz-*` → core/ui tokens.

### css/shape.css (74 lines)
- Purpose: per-person "shape": compact density token overrides `:root[data-density="compact"] :is(.main,.sheet,.iq-pop)` 7-27 (+ named parts `.attach .send .btn .b-opt .iq .stg-btn .all-btn .target .composer .ck-tog .ag-r .hd-r .ar .tb-h`), Settings rail foot 28-33, Settings › Shape `.shp-*` 34-69, simple model choice `.iq-simple` 70-72, turn work in words `.tb-wbad` 73-74.
- Proposed home: core/services/shape owns the density token layer (→ core/ui tokens `[data-density]` block); `.shp-*` → settings (shape section); the named-part list dissolves into modules.

### css/side.css (164 lines)
- Purpose: the sidebar's frozen palette `--sb-*` 1-10; one corner system/left edge/open project 11-86 (`.side .prow .pr-ic .nrow .nr-* .gear .side-find .side-plus .busy .needs`); the top that scales, More popover, folding to a rail 87-127 (`.side-folded .side-ib .side-pop .sm-row .sm-pin .sm-sep .nv-pins .side-fold`); the editable bar 128-152 (`.se-row .se-grip .se-h .se-list .se-sw .se-f`); project icon picker 153-164 (`.pj-pick .pk-pop .pk-grid .pk-o .pk-auto`).
- Cross: `.app`, `.tw-ic` (thread header's project tile opens the picker).
- Proposed home: shell/sidebar (with app.css 77-191). Project icon picker → projects module (contributes to sidebar row + header).

### css/phone.css (293 lines)
- Purpose: phone (≤760) bars: 1-150 one bar per place (`.top .top-menu .top-back .top-who .pj-s .thead .rn-live .phonebar` …), 151-169 coarse-pointer hit areas, 170-175 checklist, 176-204 panel covers the view, 205-217 targets after every sheet, 218-239 declarations later rules undid (found by tests/phone-cascade.test.mjs), 240-257 modifier subsets, 258-293 every control ≥36 px.
- Cross-feature: header, threads, conversation turns, runs, files, viewer, launchpad, artifacts, settings, sidebar (≈80 classes).
- Proposed home: shell/phone.css for the frame bars; per-module phone blocks for the rest; the 36 px floor as a core/ui rule on component classes. Must stay last in cascade until then (tests/phone-cascade.test.mjs asserts this).

### css/docs.css (141 lines)
- Purpose: the Files text editor (CodeMirror: js/viewer.js, js/doceditor.js, js/mdlive.js): editor fills 5-23, Markdown as a page `.cm-xo-page .cm-md-*` 24-45, change glow/clash/versions marks 46-55, "Ask about lines" tooltip `xo-asktip` 56-59, head state `.xd-state` 60-66, open-file tabs `.vw-tabs .vw-tab*` 67-88, versions `.vw-vers .vw-verbar .vw-vn .vw-who` 89-106, ⌘P/⌘⇧F quickopen `.qo-*` 107-128, tree drag target `.fl-list .fl-r` 129-131, unsaved 132-138, table widget `.cm-md-table` 139-141.
- Proposed home: modules/files (editor); `.qo-*` → modules/search (quickopen).

---

### Part A summary: proposed CSS homes
- core/ui: tokens.css (+ `--sb-*`, `--code-*`, `--viz-*`, inverse/density/contrast layers, fonts), foundation.css (base.css + foundation rules as primitives), components: button/.btn/.btn-danger/hold, dialog/sheet/field, toast, switch, dropdown, skeleton, lightbox, state glyphs `.g-*`, agent marks `.agm`, working arc, highlighter `.hl/.tk-*`, motion keyframes, quiet text link.
- shell: app.css 1-9, 74-217 (sidebar, main geometry), side.css, panel.css strip/pages, 2815-2830, 2846-2948 panel host, phone frame bars.
- modules: home, conversation (+ looks: rich/document, msgx/bubbles; links; media), composer (+ attachments, intelligence picker), decisions, threads (+ runs/sub-agents), projects, chats, files (+ docs editor, viewer), changes (diffs), map, launchpad, artifacts, settings (+ shape, runtimes, rules, worktrees, keyboard), shells, search (jump palette, quickopen), create-project.
- Required mechanism: `@layer` order (tokens < foundation < components < shell < modules < theme-light < density < phone) so moving rules out of one file doesn't silently change who wins. Today's precedence leans on file order in index.html and on `!important` (58 total across sheets).
- Risks: (1) cascade order changes (foundation/panel/phone overrides); (2) ID selectors `#msgs #tmsgs #typing #ttyping #composer #pf-in #hm-body #say #top` bind CSS to index.html markup the shell will own; (3) `[data-msgx]`/`[data-theme]`/`[data-density]`/`[data-view]` on `<html>`/.app set by index.html boot scripts and js; (4) JS-set custom properties listed above are an API between module JS and CSS; (5) scroll anchoring rules msgx.css 236-248; (6) tests read css files by path (Part B) — every move breaks them until paths are updated.

---------------------------------------------------------------------------------------------------

## Part B · Tests

### How tests run today
- No package.json, no test runner, no CI config, no npm scripts in the repo. Every unit test is a standalone script: `node tests/<name>.test.mjs` (exit code is the verdict; memory note: a file can print "N passed" and still exit non-zero). One Python test: `python3 tests/serve.test.py`.
- README.md "Tests" (lines ~160-176) lists only 14 commands: logic, attach, shells, serve.test.py, storm, busy, turnview, runtimes, files, record, map, media, shape, design-budget. PR_DESCRIPTION.md §4 says "Run each `node tests/<name>.test.mjs`" (no list). So 151 of the 165 top-level test files are run only by someone looping over the folder by hand.
- Browser suites: `node tests/browser/<suite>.test.cjs [name-regex]`, Playwright core from `PLAYWRIGHT_CORE` (default `/tmp/pw/node_modules/playwright-core`, outside the repo) and Chromium from `CHROMIUM_PATH`; per-suite cell filters `FLOWS_CELLS`, `COMBOS`, `CONTEXTS`/`ONLY`, `ORDER_CELLS`, `CONTRACT_CELLS`, `HELD_CELLS`/`HELD_SHOTS`, plus `DEBUG QDEBUG RING_SHOTS STACK_DIR SH_DIR`. harness.cjs serves the repo root over a local static server and answers every `/api/*` from a mock world in the page (`page.route`), patches `js/storm.js` boot (harness.cjs:225), and records focus-to-BODY events.
- Kinds used below: **exec** = imports real modules from js/ and runs them (pure logic, stand-in DOM/fetch); **source** = reads js/css/html text and asserts patterns (static guards for grader findings: focus handling, hooks, class names); **css** = parses stylesheets (often via tests/lib/cascade.mjs + tokens.mjs, a browser-free cascade model in index.html load order) to assert sizes/rings/hover/phone floor. Many "source" tests assert on exact file paths and function names in js/app.js, js/viewer.js, js/stage.js — these break on any file move even if behaviour is unchanged (largest migration cost in tests).

### Per test file (tests/*.test.*). Run command for every row: `node tests/<file>` (serve.test.py: `python3 tests/serve.test.py`). "README" marks the 14 listed in README.

| File | Lines | Kind | JS exercised (imports + source read) | CSS / other files read | Proposed home |
|---|---|---|---|---|---|
| agent-marks.test.mjs | 40 | exec+css | runtimes.js | css/app.css | core/ui (agent marks) |
| agent-tag.test.mjs | 51 | source+css | map.js | css/app.css, css/panel.css, css/phone.css, css/tokens.css | map |
| app-ctl-scale.test.mjs | 55 | css | — | css/app.css, lib/tokens | core/ui (css guard) |
| artifacts-preview.test.mjs | 62 | exec+source+css | record.js, recordview.js | css/artifacts.css | artifacts |
| attach.test.mjs (README) | 208 | exec | attach.js, timeline.js | — | composer (attachments) |
| busy.test.mjs (README) | 471 | exec | timeline.js, world.js | — | core/services (world/timeline) |
| card-ring.test.mjs | 33 | css | — | css/app.css, css/foundation.css, css/media.css | core/ui (css guard) |
| changes.test.mjs | 215 | exec+source+css | blocks.js, changes.js, changesframe.js, follow.js | (fake paths only) | changes |
| checklist-empty.test.mjs | 27 | source | app.js | — | threads (checklist) |
| codemirror-vendor.test.mjs | 97 | source |  + scans js/* | — | vendor (codemirror) |
| conn-line.test.mjs | 33 | exec+source | timeline.js, app.js | — | composer (send gate) |
| conv-ctl-scale.test.mjs | 80 | css | — | lib/tokens | core/ui (css guard) |
| conv-find-ring.test.mjs | 21 | source+css |  + scans js/* | (all css/*) | core/ui (css guard) |
| conv-herald-resolve.test.mjs | 73 | exec+source | herald.js, app.js | — | threads + conversation (herald) |
| conv-sound.test.mjs | 110 | source | app.js | — | core/platform (sounds) + settings |
| coord-colour.test.mjs | 46 | source+css | app.js | css/msgx.css, css/rich.css, css/tokens.css | conversation (css) |
| copy-path-fail.test.mjs | 57 | source+css | viewer.js | css/app.css | files |
| cover-inert.test.mjs | 28 | source | stage.js | — | shell (panel host) |
| create-busy-honest.test.mjs | 33 | source | create.js + scans js/* | — | create-project |
| create.test.mjs | 51 | exec | create.js | — | create-project |
| css-wellformed.test.mjs | 80 | source+css |  + scans js/* | (all css/*) | core/ui (css guard) |
| ctl-heights.test.mjs | 25 | css | — | css/app.css, css/phone.css | core/ui (css guard) |
| ctl-scale.test.mjs | 181 | source+css+cascade | app.js, chats.js + scans js/* | css/app.css, css/foundation.css, css/msgx.css, css/panel.css, css/phone.css, css/shape.css, css/tokens.css, (all css/*), index.html, lib/cascade, lib/x | core/ui (css guard, all modules) |
| design-budget.test.mjs (README) | 159 | source+css |  + scans js/* | (all css/*) | core/ui (css guard) |
| diff-redraw-focus.test.mjs | 43 | source | viewer.js | — | files |
| diffview.test.mjs | 82 | exec+source+css | diffview.js, tools/diffview/theme.mjs, app.js, diffthemes.js + scans js/* | css/app.css, index.html | files |
| dock-focus.test.mjs | 62 | source+css+cascade | app.js | lib/cascade, lib/x | decisions (docked card) |
| docs.test.mjs | 348 | exec | docs.js, drafts.js | — | files |
| drafts.test.mjs | 77 | exec+source | drafts.js, app.js | — | core/services |
| dropdown-held.test.mjs | 27 | source | dropdown.js | — | core/ui |
| edge-ring.test.mjs | 18 | css | — | css/* (loop) | core/ui (css guard) |
| editor-caret.test.mjs | 28 | source | diffview.js, vendor/pierre-diffs/ | — | files |
| editor-exit.test.mjs | 52 | exec | diffview.js | — | files |
| edits.test.mjs | 50 | exec | docs.js, viewer.js | — | files |
| field-ring.test.mjs | 42 | source+css | ring.js + scans js/* | (all css/*) | core/platform |
| file-cache.test.mjs | 25 | source | docs.js, viewer.js | — | files |
| files-stop-look.test.mjs | 26 | source+css | app.js | css/app.css, css/tokens.css, lib/tokens | composer (Stop) |
| files-tree-scroll-fold.test.mjs | 54 | source | files.js | — | files |
| files.test.mjs (README) | 66 | exec+source | files.js, app.js | — | files |
| find-bar.test.mjs | 38 | source | diffview.js | — | files |
| find-race.test.mjs | 38 | source | diffview.js, vendor/pierre-diffs/ | — | files |
| focus-back.test.mjs | 55 | source | app.js, decide.js, focusview.js + scans js/* | — | core/platform (focus) + decisions |
| focusview.test.mjs | 151 | exec+source | focusview.js, app.js, redraw.js | — | core/platform |
| follow-instance.test.mjs | 30 | exec | follow.js | — | conversation |
| gone-thread-composer.test.mjs | 33 | source+css | app.js | css/app.css | composer |
| graph-focus.test.mjs | 49 | source+css |  + scans js/* | (all css/*) | core/ui (css guard) |
| grip-ring.test.mjs | 23 | source+css |  + scans js/* | (all css/*) | core/ui (css guard) |
| head-focus.test.mjs | 26 | source | viewer.js | — | files |
| head-narrow.test.mjs | 33 | source+css | viewer.js | css/app.css, lib/tokens | files |
| head-redraw.test.mjs | 37 | source | viewer.js | — | files |
| herald.test.mjs | 65 | exec | herald.js | — | conversation |
| hover-census.test.mjs | 55 | source+css |  + scans js/* | (all css/*), index.html | core/ui (css guard) |
| hover-inks.test.mjs | 33 | css | — | css/* (loop) | core/ui (css guard) |
| icon-gap.test.mjs | 24 | css | — | css/app.css, css/diffs.css, css/tokens.css | core/ui (css guard) |
| image-text-mode.test.mjs | 28 | source | viewer.js | — | files |
| imagechange.test.mjs | 34 | exec | imagechange.js | — | changes |
| inverse-toast.test.mjs | 56 | source+css |  + scans js/* | (all css/*) | core/ui (css guard) |
| key-layer.test.mjs | 20 | source | app.js | — | shell (phone drawer) |
| keynav.test.mjs | 185 | exec | keynav.js | — | core/platform |
| keys-dispatch.test.mjs | 77 | exec+source | keys.js, app.js | — | core/platform |
| keys.test.mjs | 48 | exec | keys.js | — | core/platform |
| launchpad.test.mjs | 326 | exec | lpapi.js | — | launchpad |
| layout-reads.test.mjs | 25 | source | app.js, follow.js, msgx.js | — | conversation (follow) |
| link-buttons.test.mjs | 47 | source+css |  + scans js/* | (all css/*), index.html | core/ui (css guard) |
| links-css.test.mjs | 44 | source+css | files.js | lib/tokens | files |
| logic.test.mjs (README) | 549 | exec | api.js, highlight.js, markdown.js, model.js, timeline.js | — | core/services + conversation (markdown) |
| lp-create-connect-focus.test.mjs | 34 | source | create.js | — | create-project |
| lp-create-stop-focus.test.mjs | 39 | source | create.js | index.html | create-project |
| lp-intel-order.test.mjs | 74 | exec | intel.js | — | composer |
| lp-phone-links.test.mjs | 90 | source+css+cascade | create.js, intel.js, launchpad.js, stage.js + scans js/* | css/phone.css, css/tokens.css, lib/cascade, lib/tokens, lib/x | core/ui phone floor (launchpad, create, intel, shells) |
| lp-stop-notice.test.mjs | 171 | exec+source | herald.js, launchpad.js, app.js | — | launchpad |
| main-clip.test.mjs | 19 | css | — | css/app.css | core/ui (css guard) |
| map-focus-reveal.test.mjs | 38 | source+css | map.js | css/app.css | map |
| map-follow-cursor.test.mjs | 26 | source | map.js | — | map |
| map-follow.test.mjs | 35 | source | map.js | — | map |
| map-reach.test.mjs | 33 | source | map.js | — | map |
| map-tag-press.test.mjs | 22 | css | — | css/app.css | core/ui (css guard) |
| map.test.mjs (README) | 108 | exec+source+css | blocks.js, map.js, app.js | css/app.css, design-research | map |
| mdlive.test.mjs | 108 | exec | mdlive.js, vendor/codemirror/cm.js | — | files |
| media.test.mjs (README) | 358 | exec | attach.js, markdown.js, media.js, timeline.js, turnview.js | — | conversation (media) |
| menu-focus-fill.test.mjs | 34 | source+css |  + scans js/* | (all css/*) | core/ui (css guard) |
| menu-focus.test.mjs | 33 | source | viewer.js | — | files |
| menu-one-active.test.mjs | 45 | css | — | css/* (loop) | core/ui (css guard) |
| menu-successor.test.mjs | 42 | source | app.js + scans js/* | — | core/ui (menus, all modules) |
| merge.test.mjs | 81 | exec | merge.js | — | files |
| names.test.mjs | 24 | source |  + scans js/* | — | repo lint (all js) |
| no-offedge.test.mjs | 33 | css | — | css/msgx.css | core/ui (css guard) |
| notice-clear.test.mjs | 67 | source+css+cascade | app.js | css/app.css, css/msgx.css, index.html, lib/cascade, lib/x | shell (app.js) |
| notice-kind.test.mjs | 65 | source+css | app.js, launchpad.js | css/app.css | conversation (herald) + launchpad |
| one-active.test.mjs | 23 | source+css | app.js + scans js/* | (all css/*) | core/ui (lists) |
| page-no-hover.test.mjs | 28 | source+css |  + scans js/* | (all css/*) | core/ui (css guard) |
| paging.test.mjs | 94 | exec | blocks.js, timeline.js | — | conversation |
| paid.test.mjs | 86 | exec | paid.js, review.js | — | settings |
| paint-a11y.test.mjs | 40 | source+css | diffview.js | css/panel.css | files |
| panel-shell.test.mjs | 47 | source+css | app.js, shells/dock.js, stage.js | css/panel.css, index.html | shells + shell (panel host) |
| panel-threads.test.mjs | 97 | source+css | app.js, map.js, stage.js | css/app.css, css/panel.css, css/tokens.css | threads (panel frame) |
| path-copy-inline.test.mjs | 24 | source+css | viewer.js + scans js/* | (all css/*) | files |
| pending.test.mjs | 37 | exec | pending.js | — | core/services |
| phone-cascade.test.mjs | 27 | css+cascade | — | css/tokens.css, lib/cascade, lib/x | core/ui (css guard) |
| phone-floor.test.mjs | 140 | source+css+cascade |  + scans js/* | css/phone.css, css/tokens.css, (all css/*), index.html, lib/cascade, lib/tokens, lib/x | core/ui (css guard) |
| phone-hit-area.test.mjs | 34 | source+css |  + scans js/* | (all css/*) | core/ui (css guard) |
| phone-panel-go.test.mjs | 40 | source | app.js, launchpad.js | — | shell (phone panel) |
| picker-keys.test.mjs | 34 | source | intel.js | — | composer |
| pierre-find-focus.test.mjs | 36 | source | vendor/pierre-diffs/ | — | vendor (pierre) / files |
| press-inks.test.mjs | 57 | source+css |  + scans js/* | (all css/*) | core/ui (css guard) |
| press-keeps-node.test.mjs | 231 | exec+source | redraw.js, ui.js, files.js + scans js/* | — | core/platform (redraw) |
| press-reach.test.mjs | 114 | source+css | media.js + scans js/* | (all css/*) | core/ui (css guard, all modules) |
| project-find-escape.test.mjs | 21 | source | app.js | — | shell (sidebar) |
| project-icons.test.mjs | 40 | exec+source+css | icon.js, projicons.js, app.js | css/side.css | projects |
| quickopen.test.mjs | 95 | exec+source+css | fuzzy.js, paths.js, app.js, files.js, filesview.js, vendor/pierre-diffs/edit.js, viewer.js (source scans) | css/app.css; design-research path only as a string fixture | search (quickopen) |
| rail-order.test.mjs | 49 | source | shapeview.js | — | settings |
| rec-undo-focus.test.mjs | 26 | source | app.js, redraw.js | — | conversation (records) |
| reconcile-focus.test.mjs | 32 | source | app.js, ui.js | — | core/platform (redraw/focus) |
| record.test.mjs (README) | 280 | exec | record.js, recordview.js, skeleton.js | — | artifacts + projects (since you left) |
| reduced-motion.test.mjs | 25 | source+css |  + scans js/* | css/base.css | core/ui (css guard) |
| refusal-mark.test.mjs | 26 | source | ui.js, viewer.js | — | files (viewer) |
| refused.test.mjs | 57 | exec+source | herald.js, app.js | — | composer + conversation (herald) |
| region-focus.test.mjs | 28 | source | viewer.js | — | files |
| render-focus.test.mjs | 22 | source | viewer.js | — | files |
| retry-waiting.test.mjs | 34 | source | viewer.js | — | files |
| reveal-focus.test.mjs | 20 | source | changesframe.js | — | changes |
| rich-markdown.test.mjs | 133 | exec | chart.js, markdown.js | — | conversation |
| ring-room.test.mjs | 67 | source+css | focusview.js | css/app.css, css/base.css, css/panel.css, css/phone.css, css/tokens.css, lib/tokens | core/platform |
| ring.test.mjs | 124 | exec+source+css | ring.js, app.js, changesframe.js, viewer.js | css/panel.css | core/platform |
| routing-truth.test.mjs | 45 | exec+source | timeline.js, settings.js | — | settings (routing) + core/services |
| routing-words.test.mjs | 26 | source | settings.js | — | settings |
| rtsettings.test.mjs | 81 | exec | rtsettings.js | — | settings/runtimes |
| runs-stop-receipt.test.mjs | 69 | source+css | app.js, runsview.js | css/app.css, lib/tokens | threads (runs) |
| runtimes.test.mjs (README) | 126 | exec | kit.js, runtimes.js, timeline.js | — | settings/runtimes + core/services |
| saved-truth.test.mjs | 43 | exec | rtsettings.js | — | settings/runtimes |
| scroller-ring.test.mjs | 171 | source+css+cascade |  + scans js/* | css/base.css, css/foundation.css, css/tokens.css, (all css/*), index.html, lib/cascade, lib/x | core/ui (css guard) |
| seg-fold.test.mjs | 32 | source+css | viewer.js | css/panel.css | files |
| seg-ring.test.mjs | 16 | source+css |  + scans js/* | (all css/*) | core/ui (css guard) |
| send-gate.test.mjs | 36 | source | app.js | — | composer (send gate) |
| send-notice.test.mjs | 36 | source | app.js, viewer.js | — | composer + conversation (herald) |
| serve.test.py | 489 | exec (python, fake backends) | — | serve.py | root: serve.py (dev server/proxy) |
| settings-css.test.mjs | 20 | css | — | css/app.css | core/ui (css guard) |
| shape-held.test.mjs | 42 | source | shapeview.js | — | settings |
| shape-unkept.test.mjs | 29 | source | shapeview.js | — | settings |
| shape.test.mjs (README) | 957 | exec | shape.js | presets/${id}.json | core/services |
| shell-grip.test.mjs | 35 | css | — | css/app.css, css/tokens.css | core/ui (css guard) |
| shells.test.mjs (README) | 125 | exec+css | shells/model.js | css/app.css | shells |
| side-bar.test.mjs | 80 | source+css | app.js | css/side.css, index.html | shell (sidebar) |
| side-fold.test.mjs | 45 | source+css | app.js, keys.js | css/side.css, css/tokens.css, index.html | shell (sidebar) |
| side-spacing.test.mjs | 17 | css | — | css/app.css | core/ui (css guard) |
| sidebar-hover.test.mjs | 27 | css+cascade | — | lib/cascade, lib/x | core/ui (css guard) |
| stage-inplace.test.mjs | 24 | source | stage.js | — | shell (panel host) |
| stage-pages.test.mjs | 51 | source+css | stage.js | css/panel.css | shell (panel host) |
| stale-pass.test.mjs | 47 | source+css |  + scans js/* | css/foundation.css, design-research/2026-11-lg/controls-ids.json, design-research/2026-11-lg/tools/controls-md.cjs, index.html | core/ui (css guard) |
| start-centred.test.mjs | 16 | css | — | css/app.css, css/msgx.css, css/rich.css | core/ui (css guard) |
| state-hover.test.mjs | 127 | source+css+cascade | app.js, dropdown.js + scans js/* | css/app.css, css/foundation.css, css/side.css, index.html, lib/cascade, lib/x | core/ui (css guard, all modules) |
| stopped-on-purpose.test.mjs | 145 | exec+source+css | decide.js, kit.js, timeline.js, world.js, app.js | css/app.css | decisions + core/services |
| storm.test.mjs (README) | 401 | exec | blocks.js, hopstate.js, review.js, sse.js, timeline.js | — | core/platform (sse) + core/services (timeline) |
| target-bounded.test.mjs | 26 | css | — | css/app.css, css/phone.css | core/ui (css guard) |
| targets-css.test.mjs | 74 | css | — | css/* (loop) | core/ui (css guard) |
| thread-filter.test.mjs | 48 | source+css | app.js, stage.js | css/foundation.css, css/panel.css | threads (panel filter) |
| thread-menu.test.mjs | 43 | source | api.js, app.js, chats.js, nowfit.js, storm.js | index.html | threads (⋯ menu) |
| thread-page.test.mjs | 107 | source+css | app.js, gestures.js, stage.js, storm.js | css/app.css, css/panel.css | threads (thread page) + shell panel |
| turnview.test.mjs (README) | 249 | exec | blocks.js, turnview.js | — | conversation |
| viewer-busy.test.mjs | 43 | source | viewer.js | — | files |
| viewer-errors.test.mjs | 25 | source | viewer.js | — | files |
| viewer-head-focus.test.mjs | 18 | source | viewer.js | index.html | files |
| viewer-hooks.test.mjs | 37 | source | viewer.js | — | files |
| words.test.mjs | 47 | exec+source | words.js, gestures.js, msgx.js | — | conversation (copy words) |
| xoicons.test.mjs | 104 | exec+source+css | fileicons.js, icon.js, projicons.js, xoicons.js, tools/xoicons/build.mjs, app.js, changesframe.js, create.js, decide.js, files.js, filespage.js, intel.js, launchpad.js, lightbox.js, map.js, markdown.js, msgx.js, quickopen.js, shapeview.js, stage.js, turnview.js, ui.js, viewer.js + scans js/* | css/base.css, assets/icons/xo/manifest.json | core/ui (icons) + tools/xoicons |

Counts: 165 top-level test files (164 `.test.mjs` + `serve.test.py`). 51 execute real modules; 114 never import app code and only read source/CSS text; 76 parse CSS (16 through tests/lib). 48 read `js/app.js` source text, 23 read `js/viewer.js`, 9 read `js/stage.js`. That is the migration cost: when app.js is split, those ~48 static tests fail on file paths and function names, not on behaviour. Each one should be re-pointed at the module that takes over the responsibility, or turned into an exec test against that module's public API.

### tests/browser/ (Playwright core + headless Chromium; mock Space world)

| File | Lines | What it covers | Run command (filters) | Exercises |
|---|---|---|---|---|
| harness.cjs | 444 | Library, not a test. It serves the repo root on 127.0.0.1:0 and adds a `/__sse` stream. It answers every `/api/*` route in the page from mock state `W` (chats, status, shape, terminal, runtimes, runtime-policy, threads/messages/hops/made, models, files and saves, clone/mkdir, runs/stop, continue). It installs the Launchpad mock from `design-research/2026-11-vision/launchpad/tools/mockspace.cjs`, rewrites `js/storm.js`'s `boot()` (line 225), logs focus that falls to BODY, and measures wrapped lines. | — (required by every suite; also by design-research/2026-11-chatview/showcase.cjs; its comment names design-research/2026-11-lg/tools/inventory-states.cjs, which is not in the repo) | the whole app over HTTP |
| smoke.test.cjs | 115 | The smoke gate: send a message, open/close the panel, switch theme, open a file in the panel, phone file open | `node tests/browser/smoke.test.cjs` | shell, composer, stage, files, theme |
| flows.test.cjs | 4382 | Timing/focus/network flows G1… (decision re-arm, withdrawn cards, focus) plus STATES, RINGCLIP and ROWS sweeps | `node tests/browser/flows.test.cjs [pattern]` (`FLOWS_CELLS`, `DEBUG`, `QDEBUG`, `RING_SHOTS`, `STACK_DIR`) | every module |
| conversation.test.cjs | 1495 | CONV-1…9: rename, conversation controls | `node tests/browser/conversation.test.cjs [regex]` (`COMBOS`, `SH_DIR`) | conversation, threads header |
| settings.test.cjs | 1464 | Settings rail tablist, rows, Home's order, paid usage, Runtimes save | `node tests/browser/settings.test.cjs` (`CONTEXTS`, `ONLY`) | settings, shape, home |
| lpshell.test.cjs | 1008 | Launchpad and the Shells dock (rows in design-research/2026-11-lg/LAUNCHPAD-SHELL.md, a file that is not tracked) | `node tests/browser/lpshell.test.cjs [regex]` | launchpad, shells. It needs `design-research/2026-11-lg/lp-shell/world.cjs` and exits 2 ("not run") without it |
| coordinator-busy.test.cjs | 80 | Coordinator activity and Stop across replacement and retirement | `node tests/browser/coordinator-busy.test.cjs` | composer Stop, core/services busy |
| held-contract.test.cjs | 99 | xo-space's real payloads for held sessions (`tests/fixtures/storm-held-contract.json`) read through the UI | `node tests/browser/held-contract.test.cjs` (`CONTRACT_CELLS`) | services (world/timeline), sidebar, header |
| held-waiting.test.cjs | 151 | A session held by the usage limit reads as Waiting, never Working | `node tests/browser/held-waiting.test.cjs` (`HELD_CELLS`, `HELD_SHOTS`) | services, sidebar, header, composer |
| chat-read-order.test.cjs | 100 | A plain chat's session reads are ordered against stream frames | `node tests/browser/chat-read-order.test.cjs` (`ORDER_CELLS`) | chats, storm.js, timeline.js |

Every suite also needs `PLAYWRIGHT_CORE` (default `/tmp/pw/node_modules/playwright-core`) and optionally `CHROMIUM_PATH`. Neither is in the repo; the suites depend on an environment that has to be set up by hand. Proposed home: an `e2e/` package at the repo root, with harness.cjs as a shared fixture. Its mock world should become a "fake Space" that the module registry can boot against, which would also serve app developers. mockspace.cjs and world.cjs should move from design-research/ into it.

### tests/lib/
- **cascade.mjs** (248): a cascade model that needs no browser. It reads the sheets in index.html's load order (it parses index.html for `<link>` tags), evaluates `@media` for a given width, keeps `@container` as its own condition, compares selectors by the elements they can reach, and resolves tokens through tokens.mjs. Used by ctl-scale, dock-focus, lp-phone-links, notice-clear, phone-cascade, phone-floor, scroller-ring, sidebar-hover, state-hover. **Risk:** it encodes today's global cascade. If CSS becomes per-module or `@layer`ed, it has to learn layers and module load order.
- **tokens.mjs** (20): reads css/tokens.css (comfortable density) and resolves token names and simple `calc()`s to px. Used by cascade.mjs, app-ctl-scale, conv-ctl-scale, files-stop-look, head-narrow, links-css, lp-phone-links, phone-floor, ring-room, runs-stop-receipt.
- Proposed home for both: core/ui/test-kit (a CSS lint kit that module CSS tests import).

### tests/fixtures/
- **plain-turn.sse** (92 lines): a recorded SSE stream of one plain turn. Used by tests/storm.test.mjs:23-58 (SSE parser, turn store). Proposed home: core/platform/sse test fixtures.
- **storm-held-contract.json** (306 lines): xo-space's own payloads for a held coordinator and thread, dumped from xo-space's test kit at ef4a931 (PR_DESCRIPTION.md:63). Used by tests/browser/held-contract.test.cjs. Proposed home: e2e/fixtures, as a contract fixture shared with core/services.

### Distinct run commands
1. `node tests/<name>.test.mjs`, once per file (164 files). Nothing loops over them and there is no aggregate runner.
2. `python3 tests/serve.test.py`.
3. `node tests/browser/<suite>.test.cjs [filter]` for each of the 9 suites, with `PLAYWRIGHT_CORE`/`CHROMIUM_PATH` and the per-suite cell variables above.
4. Generators whose output tests check: `node tools/diffview/theme.mjs` (tests/diffview.test.mjs fails when js/diffthemes.js is stale), `node tools/xoicons/build.mjs` (xoicons.test.mjs imports it), and `node tools/codemirror/vendor.mjs` / `tools/diffview/vendor.mjs` (vendor hash manifests checked by codemirror-vendor.test.mjs and diffview.test.mjs).

### Tests nothing runs
- **No automated runner exists.** There is no CI, no package.json and no script, so strictly no test is run by anything. The only tests that are documented by name are the 14 in README plus serve.test.py.
- **151 unit test files are documented only by the generic "run each" line** in PR_DESCRIPTION.md §4: every `tests/*.test.mjs` except logic, attach, shells, storm, busy, turnview, runtimes, files, record, map, media, shape and design-budget.
- **3 browser suites are not in PR_DESCRIPTION's suite list** (smoke, flows, lpshell, settings, conversation, coordinator-busy): held-contract, held-waiting and chat-read-order. They are documented only in their own header comments. README says the browser suites "live outside the repo", which is out of date.
- **Owner rule (memory, 2026-11-19):** no browser suites run unless the owner asks. In practice, browser coverage runs by hand before a push.
- **Dependencies on research material:**
  - lpshell.test.cjs needs `design-research/2026-11-lg/lp-shell/world.cjs`, and every suite needs `design-research/2026-11-vision/launchpad/tools/mockspace.cjs` through harness.cjs.
  - stale-pass.test.mjs needs `design-research/2026-11-lg/controls-ids.json` and `design-research/2026-11-lg/tools/controls-md.cjs`.
  - .gitignore keeps exactly these four files tracked inside an otherwise ignored folder. A clean clone works today, but moving design-research/ breaks these tests.

---------------------------------------------------------------------------------------------------

## Part C · Tools, assets, fonts, presets, root files, tracked research

None of tools/ is loaded by the app at runtime. All of it is development-only, run by hand with `node`.

### tools/xoicons/build.mjs (91 lines)
- **Purpose:** builds `js/xoicons.js` (134 KB, generated, "don't edit") from the owner's Figma icon pack `assets/icons/xo/` (384 SVGs plus manifest.json).
- **Safety:** an allowlist of tags and attributes. It refuses `url()` pointing outside the file, `javascript:`, `data:`, entities and comments.
- **Transforms:** strips Figma's frame clip wrapper, turns the ink `rgb(29 29 31)` into `currentColor`, gives the XO mark's two inks `.x`/`.o` classes, turns rx=ry ellipses into circles, rounds numbers to 3 decimals, and writes the shared pen `P` once.
- **Exports:** `clean(name, src)` and `build()`. **Imported by:** tests/xoicons.test.mjs.
- **CLI:** `node tools/xoicons/build.mjs` writes the file; `--check` exits 1 when it is stale.
- **Input:** `assets/icons/xo/manifest.json` + `*/*.svg`. **Output:** `js/xoicons.js` (`export const XI = {name: [viewBox, markup]}`).
- **Proposed home:** core/ui/icons/build (with the pack as core/ui/icons/src). Run `--check` in the test gate.

### tools/codemirror/vendor.mjs (175 lines)
- Vendors CodeMirror 6 (pinned @codemirror/* versions, built with esbuild in a /tmp npm folder) into `js/vendor/codemirror/`, with a hash manifest. tests/codemirror-vendor.test.mjs checks those hashes.
- Proposed home: vendor/codemirror/tools.

### tools/diffview/ (22 files)
- **vendor.mjs** (132 lines): vendors @pierre/diffs@1.6.4 into `js/vendor/pierre-diffs/` with `manifest.json` (versions + sha256). tests/diffview.test.mjs checks it. Proposed home: vendor/pierre-diffs/tools.
- **theme.mjs** (155 lines): resolves XO's `--code-*` tokens (css/app.css:583-598) to concrete hex per theme and writes the TextMate pair xo-dark/xo-light into `js/diffthemes.js`. diffview.test.mjs imports it and fails when the output is stale. **This is a generator that reads CSS.** When `--code-*` moves to core/ui tokens, its input path changes. Proposed home: core/ui/tools (code theme generator).
- **lab.html** (39 lines): a dev page for js/diffview.js, served from a thread's preview port. It links 4 stylesheets by hand.
- **Measurement and QA probes from 5 Nov, all read-only against a live or preview app, all Playwright from `/tmp/pw` plus a hard-coded `~/.cache/ms-playwright/chromium_headless_shell-1248` path:**
  - measure.cjs (124), p1measure.cjs (55), p2measure.cjs (40): P0/P1/P2 timings.
  - p1shots.cjs (38), fileview-shots.cjs (58): screenshots.
  - p2ask.cjs (57): the Ask-about-lines flow.
  - p3flow.cjs (138): against the xo-space sandbox.
  - p3phone.cjs (52).
  - panel.cjs (81): the harness for the P1 probes.
  - rows.cjs (50), rows-long.cjs (59), rows-max.cjs (39): whole-row checks.
  - dlcopy.cjs (50): Download/Copy.
  - livecheck.cjs (47).
  - astra-recheck.cjs (41): references `qa-reports/…`, which is not in the repo.
  - sandbox.cjs (24), sandbox-preview.cjs (61).
  - fake-changes.cjs (42): a stand-in for `/api/xo-projects/{p}/changes`, computed with git.
  - fake-preload.cjs (21): a `node -r` preload for QA probes.
- **Smell:** these are one-off research scripts with absolute machine paths. Nothing references them except each other. Proposed home: archive them (move to design-research or delete) or move them to `devtools/diffview`. They are not part of any module.

### tools/files/ (2 files)
- **space-e2e.mjs** (156 lines): end-to-end test with no browser. It runs js/docs.js + js/api.js against a real xo-space branch on :5292 behind serve.py on :5293, using a throwaway project, and covers saves, versions, merge window, `file.version` events, /versions, /paths, /search and Restore.
- **space-e2e-reset.sh** (6 lines): resets /tmp/e2e and starts xo-space from a **hard-coded worktree** (`/home/coder/xo-space/.xo/worktrees/thread-cmsg_9ee805292df3450c`) and `/opt/xo-space/venv`. It is machine-specific.
- Nothing runs either file.
- Proposed home: modules/files/e2e (contract test), with the reset script parameterised.

### tools/filetree/ (6 files)
- **What it is:** a Files tree benchmark from the @pierre/trees evaluation.
  - README.md (17 lines)
  - bench.html (43 lines): js/files.js alone with XO's CSS. **It copies index.html's 15 stylesheet links, which will drift.**
  - bench.js (7 lines)
  - lib.mjs (56 lines): serves a listing as the /tree API, plus timing helpers.
  - perf.mjs (51 lines): timings.
  - same.mjs (59 lines): before/after row-equality check; exits 1 on a mismatch.
- Playwright comes from `/tmp/pw`.
- Proposed home: modules/files/bench (devtools).

### tools/launchpad/ (2 files)
- **mockspace.cjs** (164 lines): mocks Space's deploy routes in the browser (one scenario per page, `install(page, "building")`).
  - **It is a different, newer version of `design-research/2026-11-vision/launchpad/tools/mockspace.cjs` (133 lines). The browser harness requires the design-research copy, not this one.** Two diverging mocks of one contract.
- **smoke.cjs** (128 lines): plays Launchpad's flows in the real app on a preview port, using `./mockspace.cjs`. Playwright from `/tmp/pw`.
- Proposed home: modules/launchpad/test-kit (one mockspace, which harness.cjs and smoke.cjs both use).

### assets/icons/ (385 files, all tracked)
- **Contents:** `assets/icons/xo/manifest.json` (Figma export, fileId, exportedAt 2026-11-19T13:45Z, count 384) and 384 SVGs on a 24 grid, in 17 category folders:
  - a places-and-the-frame (22), b arrows-and-chevrons (9), c actions (25), d things-and-kinds (28)
  - e state-marks (18; the decision stamps), f keyboard-keys (9), g app-icon (2: favicon, favicon-progress)
  - h project-topics (31; project icons), i file-types (12)
  - j new-in-the-pack (28), k more-icons (30), l navigation-and-arrows (30), m editing-and-text (30)
  - n people-status-and-time (30), o media-data-and-system (30), p devices-development-and-everyday (30)
  - q keys-and-filled-variants (20)
- **Who uses them:**
  - Only tools/xoicons/build.mjs, at build time, and tests/xoicons.test.mjs (manifest + build `--check`). **The browser never fetches these files.**
  - The app uses the generated `js/xoicons.js` through `xi()` in js/icon.js, js/fileicons.js, js/projicons.js and js/ui.js. 11 js files call `xi(`.
  - css/app.css and js/app.js mention the folder only in comments. files-stop-look and refusal-mark tests reference paths in it.
  - The root `favicon.svg` is a hand copy derived from `g-app-icon/favicon.svg`, and the two files differ. The progress favicon is drawn from `XI["favicon-progress"]` in JS (js/kit.js:269).
  - Agent marks (Claude/OpenAI/Antigravity) are a separate set in `js/vendor/agent-marks/*.svg` (tests/agent-marks.test.mjs).
- **Proposed home:** core/ui/icons/pack (source) → core/ui/icons/xoicons.js (generated). Modules ask for icons by name through core/ui `xi()`. There is a pending design need for third-party apps to bring their own icons, so the registry should allow a module/app icon namespace.

### fonts/geist/ (3 files)
- `Geist-Variable.woff2`, `GeistMono-Variable.woff2`, `LICENSE.txt` (SIL OFL 1.1).
- **Loaded by:** css/tokens.css:10-11 (`@font-face` with relative `../fonts/geist/…`) and index.html:15 (`<link rel=preload>` of Geist-Variable). serve.py serves them statically.
- **Proposed home:** core/ui/fonts. The relative `url()` in tokens.css must move with it.

### presets/ (2 files)
- `engineering.json` (40 lines, "Build software") and `marketing.json` (43 lines, "Make content and campaigns").
- Contents: shape presets (`"preset": 1`) with `apps` (already names app ids such as `space.xo.diff`, `space.xo.design` with semver ranges and enable policies), `layout`, `words`, `surfaces`, `defaults`.
- **Loaded by:** js/shape.js:352 (`fetch("../presets/<id>.json")`), "served as static files until Storm serves them" (README). Tests: tests/shape.test.mjs reads `presets/${id}.json`.
- **Proposed home:** core/services/shape/presets. Note that the `apps` key is already a proto-manifest for the apps-host (app id + version range + enablement). It is input for the registry/manifest design.

### Root files
- **index.html** (CSS-related only):
  - Lines 15-42 are the stylesheet order (Part A). Lines 8 and 11 are the boot scripts that set `data-theme`/`data-msgx`/`data-msgx-tails` from localStorage `cv-theme`/`cv-bubbles` before first paint. Line 13 is the favicon; line 15 is the font preload.
  - The markup carries the IDs that CSS selects by (`#msgs #tmsgs #typing #ttyping #composer #pf-in #hm-body #say #top`).
  - tests/lib/cascade.mjs, ctl-scale, hover-census, phone-floor, scroller-ring, state-hover, side-bar, side-fold, stale-pass, link-buttons, thread-menu and viewer-head-focus read index.html. tools/filetree/bench.html duplicates its `<link>` list.
  - Proposed home: shell (the frame). The `<link>` list should become one bundle entry (core/ui + shell) plus module CSS injected by the loader in a defined layer order.
- **serve.py** (540 lines, stdlib only):
  - Static server plus `/api/*` reverse proxy to XO_API (default :5002) on PORT 5180. It relays SSE unbuffered and tunnels one WebSocket (`/api/terminal/sessions/<id>/ws`).
  - Same-origin and Host allowlist checks (anti DNS-rebinding). `NEVER_FORWARD` blocks secrets/raw-file routes. A writer key from `$QUIRQ_STATE_ROOT/…` (or `~/.quirq`) is attached to writer routes: project file PUT, edits undo, files rename/delete/mkdir, thread DELETE/restore. Body limits: 1 MiB, 25 MiB for attachments.
  - Tested by tests/serve.test.py.
  - Proposed home: unchanged at the root as the dev/prod server (or `server/`). The apps-host will need it to know about app origins and sandbox frames, so its allowlists become part of the permission story.
- **start.sh** (29 lines): runs serve.py in the foreground or detached (`.server.pid`, `.server.log`), plus `--stop`/`--status`. It stays at the root.
- **favicon.svg** (root): the app icon, linked from index.html:13. It is a hand-derived copy of the pack's `g-app-icon/favicon.svg` (different fill hex). Move it to core/ui/icons, or generate it from the pack.
- **README.md** (191 lines):
  - Sections: Start, The backend, Code (a file-by-file table of js/ and css/), Tests (14 commands), History.
  - The Code table and the Tests list will be wrong after any move. Some content is already stale: it says browser suites "live outside the repo", and it names `design-research/2026-11-vision/audit/tools/`, which is not tracked.
  - Proposed home: rewrite as the module index. Each module's own README carries its row.
- **PR_DESCRIPTION.md** (284 lines):
  - The body of PR #39 (13 Nov, release/2026-11-13 → main): rebuild summary, design-research untracking (§2, with the table of the 4 tracked files tests need), changes by area, Tests (§4: suite results), Deploying.
  - It is a historical document, and nothing depends on it. Proposed home: docs/history (or delete after merge).

### ui-mockups/ (tracked: 108 files, 7.0 MB on disk)
- `ui-mockups/create-project/`: "Where Create XO Project lives — four ideas (2026-11-04)". It contains:
  - README.md
  - shots/ (43 PNGs)
  - craft-audit/ (60 PNGs + measurements.json)
  - tools/ (craft-audit.cjs, variants.cjs, verify.cjs): read-only Playwright probes against :3400. variants.cjs requires an **absolute path in another worktree**; verify.cjs requires `design-research/2026-11-vision/audit/tools/lib.cjs`, which is not tracked. Both are broken on a clean clone.
- **Dependencies:** nothing in js/, css/, tests/, tools/ or serve.py references ui-mockups/ (grep: no hits). Nothing depends on it.
- **Proposed home:** out of the product tree (archive, or move under the ignored design-research/).

### design-research/ (ignored by .gitignore, but 123 files remain tracked, 15 MB on disk)
Tracked contents at 6c73139:
- **2026-11-lg/controls-ids.json** and **2026-11-lg/tools/controls-md.cjs** (761 lines; builds CONTROLS.md from crawler inventories). **Required by tests/stale-pass.test.mjs.**
- **2026-11-lg/lp-shell/world.cjs** (212 lines): the Launchpad + Shells mock world. **Required by tests/browser/lpshell.test.cjs** (exit 2 without it).
- **2026-11-vision/launchpad/tools/mockspace.cjs** (133 lines): **required by tests/browser/harness.cjs**, and therefore by every browser suite. It is an older copy of tools/launchpad/mockspace.cjs.
- **2026-11-chatview/showcase.cjs** (151 lines): uses tests/browser/harness.cjs to shoot the chat showcase. Also in that folder: `hardcoded-positioning-audit.md` (309 lines, a read-only audit of hard-coded positions on 1fd9e09) and shots-gaps/ (4 PNGs). Nothing depends on them.
- **2026-11-19-icons/**: `ICONS.md` (231 lines, every icon in the app, the list to draw) and `pack/COVERAGE.md` plus 17 shots (the pack's coverage in the app). These are research documents only.
- **2026-11-19-threads-panel/**:
  - `DELETE-SPEC.md` (68 lines): a spec for xo-space's soft-delete route.
  - `thread-page/CONV-MAP.md` (94 lines): the map of the conversation's single-instance code, which is directly relevant to modularisation.
  - `thread-page/THREAD-IN-PANEL.md` (98 lines): the plan.
  - `thread-page/mock.cjs`: Playwright from `~/.cache/xo-test-deps`.
  - build/ (58 PNGs) and thread-page shots.
  - Nothing depends on them.
- **2026-11-vision/canvas-editing/** (5 md files: README, PLAN, SPACE-CONTRACT, files-as-editor, vscode-behaviours): research on in-place document editing.
  - tests/quickopen.test.mjs uses the path `…/canvas-editing/PLAN.md` only as a string in a fake path list; it does not read the file.
- **Summary:** 209 of the 231 files in the two folders are images. App runtime dependency: none. Test dependency: exactly the 4 files .gitignore names (controls-ids.json, controls-md.cjs, world.cjs, mockspace.cjs).
- **Proposed home:** move those 4 into the test kit, as e2e/fixtures/mockspace.cjs (merged with tools/launchpad's newer copy), e2e/worlds/lp-shell.cjs and devtools/controls-registry/. After that, design-research/ and ui-mockups/ can leave the product repo entirely.
  - CONV-MAP.md, DELETE-SPEC.md and SPACE-CONTRACT.md are worth reading for the conversation, threads and files module designs.

### Part C summary: risks
1. **Generated files have their sources elsewhere.** Both generators must be re-pointed when files move, and `--check`/staleness tests must stay in the gate.
   - js/xoicons.js comes from assets/icons via tools/xoicons.
   - js/diffthemes.js comes from the `--code-*` tokens in css/app.css via tools/diffview/theme.mjs.
2. **Vendor manifests.** js/vendor/codemirror and js/vendor/pierre-diffs are checked against hashes their vendor scripts wrote. Moving `js/vendor` → `vendor/` means updating the tests' paths and the manifests' relative paths.
3. **Machine-specific paths.** Tools and research scripts use `/tmp/pw`, `~/.cache/ms-playwright/...-1248`, other worktrees and `/opt/xo-space`. None of these is portable.
4. **Duplicated lists.**
   - index.html's stylesheet list is copied into tools/filetree/bench.html, tools/diffview/lab.html and tests/lib/cascade.mjs (which parses index.html, so it follows automatically; the other two don't).
   - The mockspace exists twice.

## Domain summary (CSS / tests / tooling)

- **Module boundaries:**
  - **core/ui** owns tokens (incl. the sidebar's `--sb-*`, code `--code-*` and chart `--viz-*` sub-palettes), foundation (reset, focus ring, ring room, press/halo/cell primitives, integer line heights, reduced motion), components (button, hold button, dialog/sheet/field, toast, switch, dropdown, menu, skeleton, lightbox, status glyphs, agent marks, working arc, highlighter), icons (pack + generator), fonts, and the CSS test kit (tests/lib).
  - **shell** owns the frame CSS: `.app` grid, sidebar, main geometry, panel host and strip, phone bars.
  - **Each module** owns its region CSS from the app.css map, plus its own light, density and phone blocks.
- **Places (slots) implied by the CSS:**

  | Place | Kind | Scope | Contributed by |
  |---|---|---|---|
  | `sidebar.entry` | list, ordered (the editable bar: side.css 128-152) | app | home, chats, artifacts, shells' toggle, settings foot |
  | `sidebar.project-row.badge` | list | project | busy, needs-you |
  | `header.action` | list | conversation | Threads control, panel button, Map button, Deploy, ⋯ menu groups |
  | `header.state-line` | single | conversation | — |
  | `panel.page` / `panel.frame` | keyed | project/conversation | Files, Changes, Made, Map, Threads, Agents, Launchpad, Shells, Thread page |
  | `conversation.block` | keyed by block kind | conversation | message, turn, event line, thread card, media, rich math/chart/diagram, file card, runtime move, usage limit, coordinator control |
  | `conversation.look` | single, priority-chain: bubbles vs document | app | `[data-msgx]` |
  | `composer.tool` | list | conversation | attach, intelligence chip, Send now, Stop |
  | `composer.above` | stack | conversation | herald notices, docked decision, put-away file chip; one `--dock-gap` |
  | `decision.card` | keyed by kind | app/conversation | — |
  | `home.section` | list, ordered by shape | app | next move, then, handled, recently made |
  | `settings.section` | list | app | General, Appearance, Keyboard, Shape, Routing, Rules, Worktrees, Runtimes, Paid |
  | `theme` | single | app | dark/light |
  | `density` | single | app | comfortable/compact |
  | `phone` layout | single | app | — |

- **Public API to other modules:**
  - Token names only. Modules never define palette, scale or theme values (design-budget, ctl-scale and targets-css enforce this today).
  - Component classes from core/ui.
  - `xi(name)` for icons.
  - A CSS registration call in the loader, e.g. `registerStyles(module, url, {layer})`, so order is explicit.
  - The JS→CSS custom-property contracts listed in Part A, documented per module.
- **Risks, by subtlety:**
  1. **Cascade order and `!important` overrides.** foundation/panel/phone win only by load order; phone.css must stay last, and tests/phone-cascade.test.mjs proves it.
  2. **Scroll anchoring rules.** msgx.css 236-248, plus the rhythm in rich.css 46-83; see the "chat scroll anchoring traps" memory.
  3. **ID selectors tied to index.html markup**, and two message lists (`#msgs`/`#tmsgs`) styled in parallel, for the main chat and the thread page.
  4. **Boot-time `<html>` attributes.** `data-theme`, `data-msgx` and `data-density` must still be set before first paint.
  5. **Cross-feature selector sheets** (light, foundation, phone, shape density) must be dissolved without losing a rule. Use the app.css region map above as the ledger.
  6. **Invalid dead rules** at app.css 2221-2228, and dead tokens: delete them consciously.
  7. **Static source tests.** 114 tests assert on file paths and names, and 48 read js/app.js. Plan to re-point each one to the module that inherits the responsibility, or the safety net silently disappears.
  8. **The four design-research files the tests need**, and the two mockspace copies.
