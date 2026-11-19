# Hard-coded positioning and centring: an audit

Read-only, 19 Nov 2026, on release/2026-11-19 @ 1fd9e09 (which includes 3914600b, the --cap-mid fix; its CSS is identical to 3914600b, and the JS line numbers are 1fd9e09's). Every stylesheet
(css/*.css, tokens.css aside) and every position or offset written from JavaScript (js/*.js, vendor aside). Nothing
has been changed: this is the list, for the owner's go.

## Summary

- **142 real nudges in CSS**: values set by hand to make something line up, or that copy a size by eye. They fall in five
  kinds (G1–G5 below), each with one root fix.
- **137 legitimate geometry** that looks similar and should stay: motion, hit areas, drawn graphics (Map, charts, bubble
  tails), badges on corners, insets inside their own box, centring by half a size, anchors on the spacing scale.
- **252 control sizes written as px** where a size token exists or should: 24 px ×43, 32 ×69,
  40 ×41 (tokens --h-sm, --h-ctl, --h-lg exist), 36 ×79 (the phone's 36 floor, no token) and 44 ×20 (a touch target,
  no token).
- **JavaScript**: popovers and menus placed with constant gaps (12, 10, 8, 4, 22 px) in 6 places; the rest (gestures that follow
  a finger, the Map's coordinates, measured rows) is real geometry.
- **Already fixed** (3914600b): every vertical-align in px or em next to an icon now comes from --cap-mid (6 values).

## Real nudges by surface

| Surface | G1 icon nudge | G2 off-grid spacing | G3 hand-set halo | G4 cancelling margin | G5 off-scale position | Total |
|---|--:|--:|--:|--:|--:|--:|
| Panels, runtimes & notices | 2 | 5 | 2 |  | 13 | 22 |
| Conversation |  | 9 | 3 | 5 | 5 | 22 |
| Files, viewer & dialogs | 2 | 5 | 1 |  | 9 | 17 |
| Decisions | 4 | 2 | 6 | 1 |  | 13 |
| Map | 3 | 3 |  |  | 7 | 13 |
| Composer & picker | 2 | 1 | 4 |  | 5 | 12 |
| Settings |  | 4 | 1 | 2 | 3 | 10 |
| Launchpad | 1 | 3 | 2 | 2 | 1 | 9 |
| Shells | 2 |  |  |  | 4 | 6 |
| Home | 1 |  | 4 |  | 1 | 6 |
| Sidebar & header | 2 |  | 2 |  |  | 4 |
| Changes & diffs | 2 |  |  |  | 1 | 3 |
| Artifacts |  | 1 |  |  | 1 | 2 |
| Phone |  | 1 |  | 1 |  | 2 |
| App (shared) | 1 |  |  |  |  | 1 |
| **Total** | **22** | **34** | **25** | **11** | **50** | **142** |

## The five kinds, with every instance

### G1 · An icon or mark nudged level with its text (22)

What it is: 1–3 px (and one 8) moved by hand so a glyph lines up with the first line of the words beside it.  
Root fix: the --cap-mid rule (vertical-align: calc(var(--cap-mid) − h/2)) for an icon inside a line; for an icon beside a block of text, align it on the first line: margin-top: calc((line-height − icon) / 2), from the type tokens.

| file:line | selector | value |
|---|---|---|
| `app.css:42` | `.g-done` | `translate(1px,-1px)` |
| `app.css:104` | `.sh-n::before` | `margin:0 5px 1px 1px` |
| `app.css:343` | `.top-back` | `margin-left:-3px` |
| `app.css:739` | `.hr-go` | `margin-left:2px` |
| `app.css:841` | `.iq-truth .g` | `margin:0 6px -1px 0` |
| `app.css:1058` | `.c-facts svg` | `margin-top:3px` |
| `app.css:1346` | `.cp-note>svg,.cp-note>.spin` | `margin-top:1.5px` |
| `app.css:1347` | `.cp-note>.spin` | `margin:2.5px 1px 0` |
| `app.css:1917` | `.c-q-o input` | `margin-top:3px` |
| `app.css:1927` | `.c-iwhy svg` | `margin-top:2px` |
| `app.css:2028` | `.sc-dot` | `margin-top:2px` |
| `app.css:2269` | `.attach` | `margin-left:2px` |
| `app.css:2349` | `.sh-btn svg` | `margin-left:-2px` |
| `app.css:2725` | `.dg-n.k-root` | `margin-top:-2px` |
| `app.css:2753` | `.k-graph .gn` | `margin-top:-8px` |
| `app.css:2799` | `.dg-more` | `margin-right:-3px` |
| `app.css:3106` | `.lim-h svg` | `margin-top:3px` |
| `diffs.css:43` | `.tb-cf .xd-n` | `margin-left:2px` |
| `diffs.css:130` | `.xd-ask kbd` | `margin-left:2px` |
| `launchpad.css:98` | `.lp-src svg` | `margin-top:1px` |
| `panel.css:26` | `.stg-n` | `margin-left:-2px` |
| `panel.css:229` | `.dg-n.k-root` | `margin-top:-2px` |

### G2 · Spacing between lines off the 4 grid (1–3 px) (34)

What it is: 1, 2 or 3 px of space (or −3) between a line and the next, or an indent of 22 beside 24s.  
Root fix: the spacing tokens (--s-1 4, --s-2 8) and the conversation rhythm; .tb-rb's 22 px indent becomes the 24 its siblings use.

| file:line | selector | value |
|---|---|---|
| `app.css:1128` | `.teach-body` | `margin:6px 0 0 2px` |
| `app.css:1134` | `.c-note` | `margin-top:2px` |
| `app.css:1337` | `.dlg-head p` | `margin-top:3px` |
| `app.css:1390` | `.dlg-foot` | `margin-top:2px` |
| `app.css:1507` | `.set-ph` | `margin:2px 0 22px` |
| `app.css:1510` | `.set-empty b` | `margin-bottom:3px` |
| `app.css:1523` | `.kg h3` | `margin:0 0 8px 2px` |
| `app.css:1778` | `.tb-steps` | `margin:2px 0 6px 24px` |
| `app.css:1779` | `.tb-rows` | `margin:2px 0 4px 24px` |
| `app.css:1797` | `.tb-rb` | `margin:2px 0 8px 22px` |
| `app.css:1801` | `.tb-plan-l` | `margin:2px 0 6px 24px` |
| `app.css:1828` | `.tb-rail` | `margin:2px 0 4px` |
| `app.css:1831` | `.tb-chg` | `margin:4px 0 2px 24px` |
| `app.css:2067` | `.rl-gone-h` | `margin:var(--s-5) 0 var(--s-2) 2px` |
| `app.css:2164` | `.vw-sub` | `margin-top:3px` |
| `app.css:2308` | `.composer>.att-tray` | `margin:-3px 0 8px 0` |
| `app.css:2531` | `.syl-tt small` | `margin-top:1px` |
| `app.css:2672` | `.mp-sub` | `margin-top:2px` |
| `app.css:2723` | `.dg-t small` | `margin-top:2px` |
| `app.css:2810` | `.dg-sep` | `margin:0 3px` |
| `app.css:2920` | `.md-none b` | `margin-bottom:3px` |
| `app.css:3050` | `.rt-ws` | `margin-top:2px` |
| `app.css:3062` | `.rt-checked` | `margin-top:2px` |
| `app.css:3092` | `.lim` | `margin:2px 0 4px` |
| `artifacts.css:87` | `.arts:not(.is-pics) .ar-grid .md-from` | `margin:2px 0 0 54px` |
| `launchpad.css:191` | `.lp-rec-c p` | `margin:2px 0 0` |
| `launchpad.css:296` | `.lpv-link` | `margin:2px 0` |
| `launchpad.css:403` | `.lpv-link` | `margin:0 2px` |
| `media.css:17` | `.tb-files>.mx-stack:first-child` | `margin-top:2px` |
| `msgx.css:57` | `.mx-reply` | `margin:-3px 0 10px` |
| `msgx.css:180` | `:root[data-msgx] .prose>.mx-name` | `margin:0 0 2px` |
| `panel.css:86` | `.fl-more` | `right:8px` |
| `panel.css:86` | `.fl-more` | `margin-top:2px` |
| `phone.css:85` | `:root:root .top .pj-s.has-need` | `margin-top:2px` |

### G3 · A hover fill pulled past the words by a hand-picked negative margin (25)

What it is: the same job, five different values: 3/7, 4, 6, 8, 12 px.  
Root fix: the --halo token and the one rule that .tb-h/.tb-rh already use (margin out, padding in by --halo, corners --r).

| file:line | selector | value |
|---|---|---|
| `app.css:276` | `.nx-where` | `margin-right:-8px` |
| `app.css:292` | `.nx-link` | `margin-left:-8px` |
| `app.css:303` | `.then-i` | `margin:0 -12px` |
| `app.css:762` | `.target` | `margin-left:-8px` |
| `app.css:784` | `.at-list` | `left:-8px` |
| `app.css:1050` | `.c-where` | `margin-left:-6px` |
| `app.css:1054` | `.c-top .c-where` | `margin-right:-6px` |
| `app.css:1079` | `.dt-more` | `margin:2px 0 0 -8px` |
| `app.css:1118` | `.b-later` | `margin-left:-6px` |
| `app.css:1291` | `.dock-hide` | `margin:-6px -12px -6px auto` |
| `app.css:1597` | `.nx-where` | `margin-left:-8px` |
| `app.css:1648` | `.card.is-dock .dock-hide` | `margin-right:-6px` |
| `app.css:1763` | `.tb-h` | `margin-left:-6px` |
| `app.css:1781` | `.tb-rh` | `margin-left:-6px` |
| `app.css:1859` | `.tw-rt` | `margin-left:-4px` |
| `app.css:2273` | `.att-tray` | `margin:0 0 10px -6px` |
| `app.css:2299` | `.att-note` | `margin:8px 0 0 -6px` |
| `app.css:2922` | `.pj-title` | `margin:-3px -7px -3px -7px` |
| `app.css:2992` | `.fl-up` | `margin-left:-4px` |
| `launchpad.css:140` | `.lp-add` | `margin-left:-8px` |
| `launchpad.css:312` | `.lpv-acts` | `margin:-6px -8px -6px auto` |
| `msgx.css:318` | `t[data-msgx] .m-turn .tb-work.is-open .tb-rail .tb-rows>.tb-row>.tb-rh` | `margin-left:-8px` |
| `panel.css:43` | `.fl-up` | `margin:0 -4px` |
| `panel.css:97` | `.fl-new-r input` | `margin-left:-6px` |
| `shape.css:49` | `.shp-json summary` | `margin-left:-8px` |

### G4 · A negative margin cancelling another rule's spacing (11)

What it is: one rule adds space, another takes it back.  
Root fix: set the gap once on the parent (flex/grid gap or the rhythm tokens) and drop both.

| file:line | selector | value |
|---|---|---|
| `app.css:522` | `.m.cont` | `margin-top:-16px` |
| `app.css:682` | `.ev` | `margin:-8px 0 16px` |
| `app.css:1159` | `.card.is-dock.is-one .dock-more` | `margin:-62px 0 -6px` |
| `app.css:1514` | `.set-sec>.set-row+.set-row` | `margin-top:-9px` |
| `app.css:1521` | `.kp-t` | `margin:-4px 0 18px` |
| `launchpad.css:27` | `.lp-foot` | `margin-bottom:-16px` |
| `launchpad.css:385` | `.lpm-env .lp-a` | `margin:-20px -8px` |
| `msgx.css:74` | `.mx-qc` | `margin:-4px -10px 8px` |
| `msgx.css:151` | `:root[data-msgx] #msgs>.m.cont` | `margin-top:-16px` |
| `msgx.css:225` | `:root[data-msgx] #msgs>.m-turn+.m-them:not(.mx-other)` | `margin-top:-12px` |
| `phone.css:119` | `:root:root .top[data-kind="project"] .now-wrap` | `margin:4px -16px 0 0` |

### G5 · A position in px that is off the scale or copies another size (50)

What it is: a floating panel's 14 px inset (off the 4/8 scale), the toasts' 96/116 px (the composer's height, guessed), 52 px (the phone bar's height), 44 px (the header's or the rail's width), 41, 13, 10, 9, 7, 5 ….  
Root fix: one --float-inset token for the floating panels; --dock-h for what sits above the composer; a phone-bar and a rail-width token; spacing tokens for the rest; the decision pill's 10 from (line − pill) / 2.

| file:line | selector | value |
|---|---|---|
| `app.css:768` | `.send` | `margin:-2px -2px -2px 0` |
| `app.css:870` | `.iq-more::before` | `left:4px` |
| `app.css:870` | `.iq-more::before` | `right:4px` |
| `app.css:870` | `.iq-more::before` | `top:-5px` |
| `app.css:1003` | `.panel` | `top:14px` |
| `app.css:1003` | `.panel` | `right:14px` |
| `app.css:1230` | `.app[data-view="home"] .toast-wrap` | `bottom:96px` |
| `app.css:1232` | `body.panel-open .app[data-view="home"] .toast-wrap` | `bottom:96px` |
| `app.css:1367` | `.cp-in-ic` | `left:13px` |
| `app.css:1367` | `.cp-in-ic` | `top:13px` |
| `app.css:1495` | `.set-nav button::before` | `left:-11px` |
| `app.css:1495` | `.set-nav button::before` | `top:10px` |
| `app.css:1495` | `.set-nav button::before` | `bottom:10px` |
| `app.css:1583` | `.home,.conv,.arts` | `top:52px` |
| `app.css:1632` | `.herald` | `left:10px` |
| `app.css:1632` | `.herald` | `right:10px` |
| `app.css:1657` | `body.panel-open .app[data-view] .toast-wrap` | `bottom:116px` |
| `app.css:2157` | `.viewer` | `top:14px` |
| `app.css:2157` | `.viewer` | `right:14px` |
| `app.css:2157` | `.viewer` | `bottom:14px` |
| `app.css:2323` | `.drop-veil` | `inset:10px` |
| `app.css:2359` | `.shd-grip` | `top:-12px` |
| `app.css:2361` | `.shd-grip::after` | `top:10px` |
| `app.css:2361` | `.shd-grip::after` | `margin-left:-18px` |
| `app.css:2413` | `.shd-note` | `bottom:14px` |
| `app.css:2656` | `.map` | `top:14px` |
| `app.css:2656` | `.map` | `right:14px` |
| `app.css:2656` | `.map` | `bottom:14px` |
| `app.css:2661` | `body.map-full .map` | `left:14px` |
| `app.css:2684` | `.mp-now::before` | `left:7px` |
| `app.css:2684` | `.mp-now::before` | `top:9px` |
| `app.css:2684` | `.mp-now::before` | `bottom:9px` |
| `app.css:2868` | `.stage` | `top:14px` |
| `app.css:2868` | `.stage` | `right:14px` |
| `app.css:2868` | `.stage` | `bottom:14px` |
| `app.css:2872` | `body.stage-full .stage` | `left:14px` |
| `artifacts.css:20` | `.arts` | `top:52px` |
| `diffs.css:93` | `.stage .cx-pill` | `top:44px` |
| `fileview.css:16` | `body.chat-docked .fv-cgrip` | `right:-5px` |
| `fileview.css:17` | `body.chat-docked .fv-cgrip::before` | `left:4px` |
| `fileview.css:129` | `body.chat-docked.chat-railed .fv` | `right:44px` |
| `fileview.css:148` | `body.chat-docked.chat-over .fv` | `right:44px` |
| `foundation.css:24` | `.stg-grip` | `left:-3px` |
| `foundation.css:25` | `.stg-grip::after` | `left:2px` |
| `launchpad.css:425` | `.stage .fr-lp.is-open>.fr-b` | `top:41px` |
| `msgx.css:46` | `.mx-nobub .mx-acts.is-foot` | `left:10px` |
| `msgx.css:46` | `.mx-nobub .mx-acts.is-foot` | `translateY(-4px)` |
| `msgx.css:106` | `#msgs>.m::after` | `top:10px` |
| `rich.css:145` | `:root:not([data-msgx]) .tcard.st-needs>.tc-dec` | `right:16px` |
| `rich.css:145` | `:root:not([data-msgx]) .tcard.st-needs>.tc-dec` | `bottom:10px` |

## Legitimate geometry (137): keep, though several could name a token

**Motion: an entrance, exit, hover or toggle movement** (38): `app.css:87` .theme[aria-checked="true"] .th-knob `translateX(18px)`, `app.css:267` from `translateX(-24px)`, `app.css:270` 100% `translateY(-8px)`, `app.css:271` to `translateX(-18px)`, `app.css:307` .then-i:hover>svg `translateX(3px)`, `app.css:488` from `translateY(18px)`, `app.css:489` from `translateX(18px)`, `app.css:490` from `translateX(-18px)`, `app.css:524` from `translateY(8px)`, `app.css:660` .tcard:hover .tc-go svg `translateX(3px)`, `app.css:896` from `translateY(4px)`, `app.css:897` to `translateY(2px)`, `app.css:899` from `translateY(-4px)`, `app.css:900` to `translateY(-2px)`, `app.css:902` from `translateY(8px)`, `app.css:903` to `translateY(6px)`, `app.css:905` from `translateY(4px)`, `app.css:1127` each-tog[aria-pressed="true"] .sw::after `translateX(11px)`, `app.css:1171` .card.is-dock.st-back .card-in `translateX(6px)`, `app.css:1185` .card.st-back .card-in `translateX(6px)`, `app.css:1191` to `translateY(-10px)`, `app.css:1192` to `translateX(-14px)`, `app.css:1193` to `translateX(14px)`, `app.css:1199` from `translateY(10px)`, `app.css:1200` from `translateX(16px)`, `app.css:1201` from `translateX(-16px)`, `app.css:1549` .switch[aria-checked="true"] .th-knob `translateX(18px)`, `diffs.css:132` from `translateY(-2px)`, `foundation.css:17` from `translateX(12px)`, `launchpad.css:302` to `top:-8px`, `launchpad.css:410` to `left:-8px`, `links.css:93` .lk-out:hover .lk-ar `translate(1.5px,-1.5px)`, `msgx.css:12` .mx-down `translateY(8px)`, `msgx.css:60` from `translateY(6px)`, `msgx.css:165` from `translateY(6px)`, `msgx.css:267` from `translateY(6px)`, `msgx.css:268` to `translateY(-6px)`, `msgx.css:301` from `translateY(4px)`

**Anchoring on the spacing scale (4, 6, 8, 12, 16, 24 px from an edge)** (36): `app.css:1678` .set-nav button::before `left:12px`, `app.css:1678` .set-nav button::before `right:12px`, `app.css:2499` .panel::before `top:6px`, `app.css:2499` .panel::before `margin-left:-18px`, `app.css:2504` .shd.is-half .shd-bar::before `top:4px`, `app.css:2590` .md-pin `top:4px`, `app.css:2590` .md-pin `right:4px`, `diffs.css:127` .xd-ask `right:16px`, `diffs.css:184` .xd-pop `right:8px`, `diffs.css:245` .ximg-tag `top:8px`, `diffs.css:245` .ximg-tag `left:8px`, `fileview.css:184` root:root body.chat-sheet .chead::before `top:6px`, `fileview.css:184` root:root body.chat-sheet .chead::before `margin-left:-18px`, `fileview.css:187` t-sheet.files-open:not(.sheet-up) .crail `left:12px`, `fileview.css:187` t-sheet.files-open:not(.sheet-up) .crail `right:12px`, `fileview.css:217` .herald.is-out `left:16px`, `fileview.css:217` .herald.is-out `right:16px`, `launchpad.css:375` .lpm-k `left:8px`, `launchpad.css:431` .fr-ghost::before `left:12px`, `launchpad.css:431` .fr-ghost::before `right:12px`, `media.css:118` .lbx-arrow.is-prev `left:8px`, `media.css:119` .lbx-arrow.is-next `right:8px`, `media.css:120` .lbx-count `bottom:24px`, `media.css:125` .lbx-count `bottom:16px`, `msgx.css:22` .mx-down `right:16px`, `msgx.css:48` .m-you.mx-nobub>.mx-acts.is-foot `right:8px`, `panel.css:21` .stg-tab::after `left:8px`, `panel.css:21` .stg-tab::after `right:8px`, `panel.css:308` .fr-t.is-on::after `left:8px`, `panel.css:308` .fr-t.is-on::after `right:8px`, `panel.css:319` .fr-gut::after `top:-4px`, `panel.css:384` .fv .fl.is-wide .fl-split::after `left:-4px`, `panel.css:531` body.stage-covers .herald `left:16px`, `panel.css:531` body.stage-covers .herald `right:16px`, `phone.css:142` ot:root .top[data-kind="thread"]::before `left:16px`, `phone.css:142` ot:root .top[data-kind="thread"]::before `right:16px`

**Drawn geometry: the Map, a chart, a bubble's tail, the swipe arrow** (21): `app.css:2787` .k-graph .dg-tag `left:13px`, `app.css:2787` .k-graph .dg-tag `top:16px`, `app.css:2790` .dg-arrow `left:-1.6px`, `app.css:2790` .dg-arrow `top:-1.4px`, `app.css:2792` .dg-tag `left:15px`, `app.css:2792` .dg-tag `top:-3px`, `app.css:2797` .dg-cur.is-left .dg-tag `right:4px`, `app.css:2798` .dg-cur.is-below .dg-tag `right:-10px`, `app.css:2798` .dg-cur.is-below .dg-tag `top:31px`, `app.css:2808` .dg-tools `right:10px`, `app.css:2808` .dg-tools `bottom:10px`, `app.css:2820` .dg-key `left:10px`, `app.css:2820` .dg-key `bottom:10px`, `msgx.css:94` .mx-swipe `left:12px`, `msgx.css:97` .bubble>.mx-swipe `left:-44px`, `msgx.css:202` :root[data-msgx] #msgs>.m-them>.mx-swipe `left:-2px`, `msgx.css:345` :root[data-msgx-tails] .mx-tail::before `right:-8px`, `msgx.css:346` ata-msgx-tails] .mx-tail.is-them::before `left:-8px`, `rich.css:192` .mc-x>span `top:8px`, `rich.css:198` .mc-dot `margin:-4px 0 0 -4px`, `rich.css:200` .mc-bar `margin-left:calc((var(--k) * var(--w) + (var(--k) - 1) * 2px`

**A badge or busy arc hung on a corner** (17): `app.css:160` .pr-busy `right:-3px`, `app.css:160` .pr-busy `bottom:-3px`, `app.css:161` .pr-busy::after `inset:2px`, `diffs.css:71` .stage .cx-i .arc `right:-6px`, `diffs.css:71` .stage .cx-i .arc `bottom:-6px`, `fileview.css:121` .fl-rb em `top:3px`, `fileview.css:121` .fl-rb em `right:1px`, `fileview.css:142` .crail-m `right:2px`, `launchpad.css:351` .lpm-t .arc `right:-4px`, `launchpad.css:351` .lpm-t .arc `bottom:-4px`, `msgx.css:19` .mx-down-n `top:-6px`, `msgx.css:19` .mx-down-n `right:-6px`, `panel.css:263` .arc `right:-4px`, `panel.css:263` .arc `bottom:-4px`, `panel.css:264` .arc::before `inset:2px`, `panel.css:463` .stage .ag-ic .arc `right:-4px`, `panel.css:463` .stage .ag-ic .arc `bottom:-4px`

**An inset inside its own box (knobs, rings: concentric)** (6): `app.css:83` .th-knob `left:2px`, `app.css:83` .th-knob `top:2px`, `app.css:1125` .sw::after `left:2px`, `app.css:1125` .sw::after `top:2px`, `app.css:2409` .shd-x `inset:8px`, `launchpad.css:57` .lp-arc::before `inset:1px`

**Hit area: an invisible ::after that enlarges a small target** (5): `app.css:496` .wsh-mark::after `inset:-28px`, `app.css:674` .tc-next::after `inset:-6px`, `app.css:694` .av-w::after `inset:-4px`, `phone.css:161` :root:root :is(.side-plus `inset:-8px`, `phone.css:168` :root:root .ev-asked>.ev-t::after `inset:-12px`

**A hairline overlap (a line drawn over the bar's own 1 px line)** (4): `app.css:1513` .set-row+.set-row `margin-top:-1px`, `launchpad.css:15` .stage .fr-lp::before `top:-1px`, `panel.css:21` .stg-tab::after `bottom:-1px`, `panel.css:308` .fr-t.is-on::after `bottom:-1px`

**A card's band or button set from the card's own padding** (4): `msgx.css:363` ta-msgx] .m-them .tcard.st-needs>.tc-dec `right:12px`, `msgx.css:363` ta-msgx] .m-them .tcard.st-needs>.tc-dec `bottom:12px`, `msgx.css:372` :root[data-msgx] .m-them .tc-segs `margin:0 -16px 4px`, `rich.css:130` :root:not([data-msgx]) .tc-segs `margin:0 -16px 8px`

**Centring a glyph in its slot** (3): `msgx.css:140` :root[data-msgx] #msgs>.ev>.ev-ic `margin:0 3px`, `rich.css:35` :root:not([data-msgx]) #msgs>.ev>.ev-ic `margin:0 1px`, `rich.css:88` ng):not(:has(.tb.is-live))>.tb-h::before `margin:0 2px`

**Centring by half its own size** (2): `app.css:272` .next .stamp `margin:-42px 0 0 -42px`, `app.css:1174` .stamp `margin:-44px 0 0 -44px`

**line-height 1 on a one-line chip (no leading)** (1): `app.css:2329` .m-react `line-height:1`

## Control sizes written as px (252)

Heights and widths of 24, 32, 40 px where --h-sm, --h-ctl, --h-lg exist; 36 px (the phone's floor) and 44 px (a touch
target) have no token yet. Root fix: use the three tokens, and add two (--h-phone 36, --hit 44). By file: app.css 113, phone.css 36, panel.css 25, fileview.css 24, launchpad.css 15, msgx.css 13, diffs.css 7, rich.css 6, artifacts.css 4, dropdown.css 4, foundation.css 2, media.css 2, docs.css 1.

## JavaScript

| file:line | what | verdict | root fix |
|---|---|---|---|
| `js/chats.js:326-327` | the new chat's settings popover: 12 px from the window's edges, 10 above its button, at least 240 tall, 22 off its top | constants | read the gap from the spacing tokens (getComputedStyle --s-3), or CSS anchor positioning |
| `js/intel.js:458-459` | the model picker: 12 from the edges, 10 above the chip | constants | same |
| `js/files.js:521-522` | a file row's menu: 8 from the edges, 4 from the row | constants | same |
| `js/msgx.js:722-723` | "Reply to this" over a selection: 8 from the edges and above | constants | same |
| `js/msgx.js:844` | back-to-latest: 12 above the composer | constant (the CSS says 12 too) | one token, read by both |
| `js/app.js:3011` | the "new messages" pill: 12 under the header | constant | a spacing token |
| `js/dropdown.js:210-211`, `js/files.js:499,505`, `js/recordview.js:591` | positions from measured rects or offsetTop | measured: keep | — |
| `js/gestures.js`, `js/lightbox.js:253-374` | transforms that follow a finger or a swipe | motion: keep | — |
| `js/map.js:424-937` | the Map's node and edge coordinates (PAD) | drawn geometry: keep | — |
| `js/motion.js:74`, `js/app.js:2501` | FLIP animations from measured positions | motion: keep | — |

## Method

A script read every rule (vertical-align in px/em; top/right/bottom/left/inset; translate offsets; margins that are
negative or 1–3 px; line-height hacks) and listed {A['tot']+A['legit']} candidates; each was then sorted by hand into a kind by
what its selector draws and what its comment says. Sizes were counted separately. JS was searched for style.top/left,
transform and px written from constants.

## Fixed (xo/thread-4e00de-nudges, from release/2026-11-19 @ 1fd9e09)

| kind | commit | what it is now |
|---|---|---|
| G3 hover fills | adbb1fae | --halo (8) for a control, --halo-row (12) for a row; icon buttons bleed (16 − 24) / 2; buttons on a text line centre by (--lh-14 − --h-ctl) / 2 |
| G1 icon nudges | 8270af87 | an icon at the top of wrapping text: --ic and margin-top calc((1lh − var(--ic)) / 2); an icon inside a line: --cap-mid; 2 px gaps → --s-1 |
| G2 off-grid spacing | f211c395 | --s-1 between lines, --s-2 after a block, --s-6 for indented steps (the 22 px indent is 24) |
| G4 cancelling margins | d78e44bc | the element a gap belongs to says it once (same numbers on screen); Settings rows share borders by −(--s-2 + 1px) |
| G5 positions | 7d17db18 | --float-inset (12; was 14), --h-phonebar, --rail-w, --grip-w, --grab-w/--grab-h; positions computed from --h-lg, --h-sm, --lh-14, --s-*; a dead Settings rail bar removed |
| JS gaps | 91a22b13 | js/util.js space(token): popovers and menus keep --s-3 from the window and --s-2 from their anchor |

Kept on purpose, each a measurement or a drawn shape rather than a nudge: the back chevron's side bearing (.top-back),
.attach's concentric reach into the composer, the docked decision's corner (.dock-hide), the composer's reply chip and
attachment row (concentric with its corner), the 'more' fade over a docked decision (its own height), Launchpad's env
button, the quote card in a bubble, the Map's labels and pills, .g-done's drawn tick, the send button's reach, the phone
Artifacts list's source line (its row height is what a virtual grid measures), and Home's toast offsets (96/116 px:
Home's dock is 145 px tall, so they aren't "the dock + a gap"; they need a decision of where a toast belongs there).

Not done: the 252 sizes written as 24/32/40/36/44 px. They are on the scale already, but --h-ctl shrinks in compact
density, so each needs a decision (a control that should follow density, or a box that shouldn't) before it takes a token.

Checked: a read-only layout diff of Home, the chat (document view, bubbles, phone), a thread, Settings and the model picker
on :3000's data, before and after. On screen, only what was meant to move moved: the composer's @ target 2 px narrower
(its right padding on --halo), the model picker 2 px nearer its chip (10 → --s-2), Settings' page head 2 px up (its
2 px top margin gone), and the bubbles' column 18 px taller over the conversation (2 px gaps that are now 4).
