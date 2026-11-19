# Every icon in xo-coworker: the list to draw

**Source:** `release/2026-11-19` @ b4f581e, which is what :3000 serves. It was read in full; nothing was changed.

**What's in this folder:**
- `icons-today.png`: a contact sheet of today's SVG icons, with the file:line of each.
- Three appendices with every definition and every place it's used (file:line):
  - `inventory-a-core.md`: ui.js, app.js, the panel, Map, Files, viewer.
  - `inventory-b-rest-css-glyphs.md`: chat, steps, Launchpad, decisions, CSS-drawn marks, text glyphs.
  - `inventory-c-file-and-project-sets.md`: file-type and project icons.

**How the list is organised:** each row is one icon to draw. Where today's code draws the same idea in several places (the ⋯ "more" exists three times, the folder four times), it is listed once and every place is named. The ID is the file name I'd look for in your pack (`home.svg`, `chevron-down.svg`…).

---

## How to deliver them, so they drop straight in

- **Format:** one SVG per ID, on a **24 × 24** grid with a 2 px safe margin, so the live area is 20 × 20.
- **Colour:**
  - One colour only: `currentColor`, with no hard-coded colours. The app tints icons by state (blue working, amber needs you, green done, red danger).
  - Two-colour exceptions are marked; use `currentColor` plus `opacity` for the second tone.
- **Strokes:**
  - Stroke icons are what the app uses today, and they're best with one weight across the pack.
  - Today, outside the sidebar, every stroke is forced to **1.5 px, square caps, miter joins** (css/base.css:36-37). Inside the sidebar it's 1.6 px with round caps and joins.
  - Tell me which you choose, and I'll make it one rule everywhere.
- **Fills:** filled shapes are fine where marked "filled": stop, the state marks, the stamps.
- **The sizes they're seen at:**
  - mostly **16 px**;
  - **12–14 px** in chips, badges and meta lines;
  - **15 px** in the sidebar;
  - **20 px** in the phone bar;
  - **84–88 px** for the two stamps.
  - Please check that each icon reads at 12 px.
- **Rotation:** the chevron is rotated by CSS (−90°, 180°), so it must look right in all four directions.
- **Badge slot:** some icons carry a small corner badge (a 12 px circle at the bottom right of a 28 px tile), so leave that corner quiet on thread, agent and project tiles.

---

## A. Places and the frame (sidebar, header, panel)

| ID | Means | Where it shows | Size |
|---|---|---|---|
| `home` | Home | Sidebar Home row; ⌘K "Home" | 15–16 |
| `xo-mark` | XO itself / the Workspace coordinator | Sidebar brand; Workspace row; coordinator avatar in chat; "Can't reach XO". Proportions 30×13, 18×8 and 58×24; two colours (X ink, O green) | wide |
| `chat` | A conversation | Sidebar Chats row; ⌘K "Chats"; thread avatar; "Ask about these lines" | 14–16 |
| `artifacts` | What threads made | Sidebar Artifacts row; ⌘K; Artifacts page header (today a stack of layers) | 15–16 |
| `more` | More (places / actions) | Sidebar More row (proposed); every ⋯ button: Files, viewer, Launchpad, thread menu | 15–16 |
| `project` | A project (the default cube) | Project tile wherever no topic icon fits: sidebar, header, @-list, ⌘K, Map root, create dialog | 15–16 |
| `plus` | New / add | Sidebar "+ New" project; Home "Create XO Project"; ⌘K "New project…"; Map zoom in | 12–16 |
| `search` | Find | Sidebar find / ⌘K field; All-threads search; Files find; panel "Find a thread" | 14–16 |
| `menu` | Open the sidebar (phone) | Phone bar; conversation bar on a phone | 20 |
| `sidebar-left` | Fold or show the sidebar or file tree (⌘B) | Proposed sidebar collapse; Files tree toggle | 16 |
| `panel-right` | Open or close the right panel | Conversation header toggle | 16 |
| `full-size` | Make it full size | Panel bar; Map (standalone) | 16 |
| `exit-full-size` | Back beside the conversation | Panel bar while full size | 16 |
| `fold-to-rail` | Fold the chat to a rail beside a file | Chat head when the chat docks beside a file | 16 |
| `gear` | Settings | Sidebar foot; phone bar | 16 |
| `sun` | Light mode | Theme switch knob; ⌘K | 11–12 in the knob |
| `moon` | Dark mode | Theme switch knob; ⌘K | 11–12 in the knob |
| `terminal` | Shells | Sidebar foot Shells; panel Shell button (proposed); step rows "ran a command" | 16 |
| `threads` | Threads (the panel frame) | Panel Threads frame; folded panel rail. Today it's `agents` | 16 |
| `changes` | Files agents changed | Folded panel rail "Changes"; Files rail "Changed". Today: a page with a tick | 16 |
| `map` | The Map / Diagram view | Folded panel rail "Map"; Map "Diagram" toggle | 15–16 |
| `graph` | The Map as a graph | Map "Graph" toggle | 15 |

## B. Arrows and chevrons

| ID | Means | Where it shows | Size |
|---|---|---|---|
| `chevron-down` | Open, unfold, a menu. **Rotated** by CSS to point right or up | Frame fold; disclosure rows; checklist; dock; "Back to latest" round button in chat; selects | 11–16 |
| `chevron-right` | Into / next / a closed folder | Home rows; Files tree folders (rotates when open); lightbox Next; decision "Skip ahead" | 12–16 |
| `chevron-left` | Back / previous | Conversation Back; Files "Back (Esc)" / up; lightbox Previous; panel back (proposed) | 14–20 |
| `arrow-right` | Go / open / passed on | Home "Go"; thread card "Open"; route rows "You, in…"; Intelligence "→ Next" | 12–16 |
| `arrow-left` | Back to the chat | Files "Back to chat" | 16 |
| `arrow-down` | Download / hide downwards | Viewer and lightbox Download; Shells "Hide" | 16 |
| `send` | Send (an up arrow today) | Composer Send; viewer "Ask about these lines" send | 16–17 |
| `external-link` | Opens outside XO (new tab) | After every outbound link in chat (~10 px); Launchpad "Open it"; Changes "Open in Files" | 10–16 |
| `next-move` | "Your next move": XO's own chevron, from the mark | Home label | 12 |

## C. Actions

| ID | Means | Where it shows | Size |
|---|---|---|---|
| `close` | Close / dismiss / remove | Every ×: panels, sheets, Settings, chips, the reply chip, disks | 12–16 |
| `check` | Done / allowed / copied / selected | Allow; Resolve; "Copied"; selected model row; ok events | 12–16 |
| `stop` | Stop a running turn (**filled**) | Composer Send while running; Stop buttons; herald | 14–16 |
| `copy` | Copy | Message actions; Copy path; Launchpad address | 16 |
| `edit` | Edit / rename / answer in your words | Thread "Rename, label…"; failed message Edit; viewer Edit; starters | 12–16 |
| `retry` | Retry / reopen / reset | Failed message; thread Reopen; connection lost; Keyboard reset | 14–16 |
| `send-back` | Send back with a note / undo | Decision "Send back"; back events | 16 |
| `reply` | Reply to (quote) a message | Message actions. **Today it reuses `send-back`'s drawing; I'd make it its own** | 16 |
| `attach` | Attach files | Composer paperclip; drop veil | 17 |
| `pin` | Pin on top / to the sidebar | Artifacts pin; More rows (proposed) | 16 |
| `eye` | Look / preview / details | Next-card Details; composer Preview; viewer Preview; "read" steps | 15–16 |
| `file-new` | New file | Files "New file" | 16 |
| `minimize` | Minimise | Shells dock; Map zoom out (same drawing today) | 15–16 |
| `link` | An address / link an app | Launchpad Address card and node | 16 |
| `split-view` | Side by side (diff) | Viewer toggle | 16 |
| `code` | Source view | Viewer Preview / Source | 16 |
| `thumbs-up` | Good reply | Action row under an agent reply (20 % fill when pressed) | 16 |
| `thumbs-down` | Bad reply | Same row | 16 |
| `follow` | Follow the agent | Map toolbar (pressed state) | 15 |
| `fit` | Fit it all | Map toolbar | 15 |
| `interrupt` | Act now: interrupt / send now (a bolt today) | Thread card "Interrupt"; composer "Sends now" | 12–16 |
| `runs-code` | This file runs code. **Today the same bolt; I'd split it** | Viewer badge | 14 |
| `lock` | Protected / read only / hold to confirm | Risk badge; read-only file; hold-to-allow; secrets | 12–16 |
| `key` | Keyboard; Git credentials | Settings › Keyboard; create dialog GitHub states | 16 |
| `delete` | Delete (**new**, for Delete thread) | Thread ⋯ menu (proposed) | 16 |

## D. Things and kinds

| ID | Means | Where it shows | Size |
|---|---|---|---|
| `thread` | A thread (bubble with lines) | Panel rows; chat rail; thread link capsules; project head | 16 |
| `agent` | A sub-agent | Step rows "started a sub-agent" | 14–16 |
| `branch` | A git branch / worktree | Checklist branch chip; Settings › Worktrees; Map root; artifacts kind | 12–16 |
| `doc` | A document / a made file | Thread card "Open file"; attachment chip; artifacts kind | 14–16 |
| `image` | A picture | Attachment chip; artifacts kind | 16 |
| `folder` | A folder / All files | Panel "All files"; Files rail; lightbox "Open in Files"; create dialog | 16 |
| `folder-open` | An open folder | Map folder boxes | 16 |
| `web` | The web / a public page | Launchpad Visitors; artifacts kind "page"; activity rows (a globe today) | 16 |
| `list` | Steps / a log / data | Sub-agent log; artifacts kind "data"; Shells list tab; Compact switch | 11–16 |
| `runtime` | Where agents run | Settings › Runtimes; "continued on" banner | 13–16 |
| `routing` | Routing | Settings › Routing; system events | 12–16 |
| `rules` | Rules | Settings › Rules | 16 |
| `shape` | Shape (what XO shows you) | Settings › Shape | 16 |
| `settings-general` | General settings (sliders today) | Settings › General; ⌘K actions; "Edit the sidebar…" (proposed) | 16 |
| `sound` | Sounds | Settings › Sounds; its switch knob | 11–16 |
| `clock` | Time / later / a limit | Home "Later today"; usage limit; schedule starter | 14–16 |
| `hourglass` | Time it'll take | Next-card and decision estimate | 14 |
| `suggestion` | Suggested / recommended (a spark today) | Next-card "Suggests"; Launchpad "Recommended"; "N made" | 14 |
| `warning` | An error or refusal said in a line | Viewer save error | 14 |
| `pause` | Paused / waiting | Interrupt and system events; "Sending is paused"; herald | 12–13 |
| `plug` | An MCP tool call | Step rows | 14–16 |
| `question` | The agent asked / said in words | Step rows | 14–16 |
| `step-dot` | Any other step | Step rows | 14–16 |
| `agent-cursor` | Where each agent is on the Map (coloured per agent) | Map diagram | 18 |
| `deploy` | Deploy / Launchpad (a rocket today) | Header Deploy; Launchpad; More (proposed) | 16 |
| `github` | GitHub (**brand mark: keep it official or draw a plain one?**) | Connect GitHub; "From GitHub" | 16 |
| `container` | The container image | Launchpad pipeline "Image" | 16 |
| `server` | The running app | Launchpad pipeline; app list | 16 |

## E. State marks (today drawn in CSS or as text characters, so they're the least "ours")

| ID | Means | Where it shows | Size |
|---|---|---|---|
| `state-working` | Working now (an animated arc today) | Thread badges, cards, rows, buttons ("Stopping…") | 8–14 |
| `badge-working` | Working, as a corner badge on a tile | Panel thread rows; avatars; chat rail | 12 |
| `state-needs-you` | Needs you (◆ today) | Sidebar counts; thread rows; cards; checklist "Paused on you" | 8–12 |
| `state-done` | Done | Thread badges; checklist ✓ | 8–12 |
| `state-failed` | Failed | Badges; checklist ■ in red | 8–12 |
| `state-stopped` | Stopped on purpose | Badges; ■ "Stopped at…" | 8–12 |
| `state-resolved` | Resolved | Badges | 8–12 |
| `state-held` | Held / parked | Badges | 8–12 |
| `state-paused` | Paused (a chat held) | Chat rows | 8–12 |
| `state-idle` | Idle / waiting (○ today) | Badges; checklist "to do" | 8–12 |
| `step-doing` | The step in progress (✱ today) | Checklist; card now-line | 10–12 |
| `alert` | This chat needs you ("!" today) | Folded chat rail badge | 14 disc |
| `effort-glance`, `effort-decide`, `effort-think` | How much of you an ask takes (a pie today) | Next card; decision card | 14 |
| `stamp-allowed` | Allowed (big, animated) | Decision card on Allow | 84–88 |
| `stamp-sent-back` | Sent back (big, animated) | Decision card on Send back | 84–88 |
| `undo-countdown` | Time left to undo (a ring that empties) | Undo toast | 14 |

## F. Keyboard keys (today they're Unicode characters, and the ⇧⏎ you circled is one of them)

| ID | Key | Where it shows |
|---|---|---|
| `key-command` | ⌘ | Every Mac shortcut hint (about 60 tooltips), the shortcut sheet, Settings › Keyboard |
| `key-shift` | ⇧ | Shortcut hints |
| `key-option` | ⌥ | Shortcut hints |
| `key-return` | ↵ ⏎ | "hold ↵", list navigation |
| `key-up`, `key-down`, `key-left`, `key-right` | ↑ ↓ ← → | Intelligence picker; lightbox |
| `key-delete` | ⌫ | (proposed thread menu) |

*Off a Mac, these are written as words ("Ctrl", "Alt"), so they need no icon.*

## G. App icon

| ID | Means | Where it shows |
|---|---|---|
| `favicon` | The app in the browser tab | Tab; home-screen icon. Today it's the XO mark on a 500 grid |
| `favicon-progress` | The tab while an agent works or needs you | The app draws progress segments around the mark: green done, blue doing, amber needs you. Tell me if your mark should leave room for them |

## H. Project topic icons (31 + the default cube): today from Lucide

The app picks one of these from a project's name and its threads' titles (js/projicons.js). They show on the sidebar tile, the folded rail, the header, the @-list, ⌘K and the coordinator's avatar.

`research` (telescope) · `hardware` (cpu) · `agents` (bot) · `swarm` (network) · `space` (orbit) · `backend` (server) · `deploy` (rocket) · `interface` (panels) · `design` (palette) · `pitch` (presentation) · `marketing` (megaphone) · `writing` (notebook and pen) · `data` (chart line) · `finance` (wallet) · `legal` (scale) · `security` (shield) · `people` (users) · `web` (globe) · `mobile` (smartphone) · `messaging` (message squares) · `media` (image) · `video` (clapperboard) · `music` · `games` (gamepad) · `learning` (graduation cap) · `health` (heart pulse) · `shopping` (bag) · `travel` (plane) · `code` (code brackets) · `automation` (workflow) · `work` (briefcase) · default: `project` (the cube, section A)

Your feedback: two projects currently share the rocket and two share the telescope. It might be worth letting a project choose its icon.

## I. File-type icons (52 today): from Pierre Trees

These show in the Files tree, Changes, chat file chips and links, the viewer header, artifacts and the Map.
- **Generic, yours to draw (11 + 3):** `file-default` · `file-text` · `file-code-html` · `file-json` · `file-yaml` · `file-shell` · `file-image` · `file-svg` · `file-font` · `file-table` · `file-database`, plus `file-archive`, `folder` and `folder-open`. Today archives have no glyph and fall back to a plain grey page.
- **Brand logos (41: TypeScript, React, Python, Docker, git…):** these are other companies' marks.
  - **Option 1:** keep them as they are (recommended: people recognise them instantly).
  - **Option 2:** replace them with XO-drawn type badges (e.g. a "TS" lettermark).
  - The full list, with the extensions each covers, is in `inventory-c-file-and-project-sets.md`.

## J. Not icons, but drawn marks; tell me if you want these in the pack too

- **Separators and bullets:** `·` (183 uses) and `›` (breadcrumbs).
- **Small CSS marks:** radio rings, the selected-option dot, status lights in Launchpad, rule dots, legend swatches on the Map, and the dashed "sent" line.
- **Chat bubble tails** (two masks).
- **Text, not icons:** `…` and `–` are punctuation.

## Don't draw (defined but never shown today; I'll delete them)

`play`, `warm`/flame, `gem`, `ripe`, `loop`, `replay`, `shield` (ui.js); `DIR_OPEN` (map.js); Launchpad's own `x`; the 17 unused Lucide file glyphs in js/vendor/lucide/files.js; Pierre's `npm` (nothing maps to it).

---

### Counts

| Section | Count |
|---|---|
| A–D, XO's own interface icons | 84 IDs: 81 drawn today, plus 3 new (`delete`, `reply` and `runs-code`, each split from a shared drawing) |
| E, state marks | 18 IDs, all drawn in CSS or as text today |
| F, keyboard keys | 9 |
| G, app icon | 2 (the mark itself is `xo-mark`, in A) |
| H, project topics | 31 (the cube is in A) |
| I, file types | 14 generic to draw; 41 brand logos are your choice |

**Total:** 158 to draw, leaving the brand logos out.

When your pack arrives, I'll do the following:
1. Wire every ID to one icon module, so each icon is defined once.
2. Replace the CSS-drawn and text marks with your icons.
3. Delete the duplicates.
4. Show you every place in dark and light before anything ships.
