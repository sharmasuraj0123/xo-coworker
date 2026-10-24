# 11 · Mobile gestures: the natural flow

**Status:** built on 2026-10-24, on the branch `feat/mobile-gestures` (on top of `feat/browser-shells`). The code is in `js/gestures.js`, the history wiring is in `js/app.js` (“the phone's own Back”), the Shells sheet is in `js/shells/dock.js`, and the CSS is at the end of `css/app.css`. §6 lists where the build differs from this proposal. The proposal maps gestures onto the phone layout (≤760 px) that `main` has today, plus the Shells dock from `feat/browser-shells`.

**The goal.** On a phone the app should behave the way your hands already expect from Messages, WhatsApp, Telegram, Slack, Mail and Photos. You shouldn't have to learn a gesture or discover it. Each gesture does what the same movement does in those apps, and every gesture also has a visible button, so nothing is gesture-only.

---

## 0. What the phone layout is today (the surfaces)

| Surface | What it is on a phone | How you move today |
|---|---|---|
| **Sidebar** (`.side`) | a drawer, 300 px / 84 vw, slides in from the left over a scrim | ☰ in the phonebar; ✕ or tap the scrim to close |
| **Phonebar** (`.phonebar`) | 52 px top bar: ☰, title, Settings cog | taps |
| **Home** (`#home`) | the ranked "worth your time" page | vertical scroll |
| **Conversation** (`#conv`): Workspace, project, thread | header, the Now shelf (horizontal snap strip, projects only), checklist bar (threads), messages, folded work lines | vertical scroll; scrolling up loads older history; ‹ back in a thread's header |
| **Dock** (`#dock`) | composer on a glass bar at the bottom; above it, a thread's own decision card (`.card.is-dock`, max 52 vh, "Read the conversation first" folds it) | taps |
| **Needs you** (`#panel`) | a bottom sheet, 91 dvh, one ask at a time, ‹ › in the footer | taps; j / k on a keyboard |
| **Sheets**: All threads, Sub-agents, Jump, Keys; **popovers** as sheets: Intelligence, New chat | bottom sheets | taps, ✕ |
| **Viewer** (`#viewer`) | a shared file, full screen | ✕ |
| **Settings** | a full-screen page, tabs in a horizontal strip | ✕ |
| **Shells dock** (`#shd`, feat branch) | a 320 px panel under the main column; tab bar, an 8 px drag grip, minimise | drag the grip (mouse-sized) |

**Two things to fix whatever we decide about gestures** (found while reading the code):

1. **The app never touches browser history** (no `pushState`/`popstate` in `js/`). On Android the system back gesture (a swipe in from either edge) therefore **leaves XO Space** instead of closing a sheet or going from a thread back to its project. On iOS Safari, the left-edge swipe does the same.
2. **The Shells dock has no phone layout.** A fixed 320 px panel plus an 8 px grip under a 52 px bar and the composer leaves almost no room on a 390 × 844 screen, and an 8 px grip is far below the 36 px touch minimum (05 §touch).

---

## 1. Principles

1. **Borrow, don't invent.** Use only gestures people already do every day in messaging and mail apps. If a gesture needs a tooltip to be found, it doesn't belong here.
2. **The finger drives the surface.** A drawer, page or sheet follows the finger 1:1 and settles on release, depending on how far and how fast you moved. It never snaps the moment a threshold is crossed. That is what makes a gesture feel physical and lets you change your mind halfway.
3. **One direction, one meaning.**
   - **Swipe right** means "back, toward the list". In a thread it goes back to the project; at the top level it opens the sidebar.
   - **Swipe down** means "put it away": close a sheet, fold a card, lower the keyboard.
   - **Swipe left** does nothing for navigation. It is kept for actions on a single row.
4. **The system's gestures come first.** The OS edges (iOS left edge in Safari, both Android edges, the bottom home bar) belong to the OS. We make them do the right thing by wiring history (§2.1), and we don't fight them.
5. **No decision is a gesture.** This keeps the Decision Kit's rule ("destructive is never batched, never one key, never a gesture") and goes further: *no* ask is answered by a swipe, routine ones included. Swipe-to-approve breeds automation bias (07 §ethics, Goddard 2012), and a swipe can't make "no as cheap as yes". Gestures move you *between* asks. Buttons answer them.
6. **Every gesture has a button.** ☰, ‹, ✕, ‹ › and "Read the conversation first" all stay. Gestures are shortcuts for thumbs, the way keys are shortcuts for keyboards.

---

## 2. The gestures, by priority

### P0 · 2.1 System Back does the expected thing (Android back gesture, iOS edge swipe)

The most natural gesture is the one the phone already has. It costs the person nothing to learn.

| Where you are | System Back does |
|---|---|
| a sheet is open (Needs you, All threads, Sub-agents, Jump, Intelligence, New chat) | closes the sheet |
| the viewer or Settings is open | closes it and returns exactly where you were |
| the sidebar is open | closes it |
| a sub-agent opened inside the Sub-agents sheet | goes back to the list (today's `runsEscape`) |
| a thread | goes to its parent (today's `back()`: the project, or wherever you came from) |
| a Chats session | goes back to Chats |
| a project or the Workspace | goes back to the previous place you visited |
| Home with nothing open | leaves the app (the normal end of the stack) |

**How:** one history entry per view change and per overlay opened, and `popstate` runs the same close or back code that Esc runs today. On iOS Safari, the left-edge swipe then becomes the app's own Back for free.

### P0 · 2.2 Swipe right: back a level, or open the sidebar

A horizontal drag that starts anywhere on the conversation or Home, not only at the edge. This is the pattern in Telegram, Slack and Discord.

| Where you are | Swipe right does | Feels like |
|---|---|---|
| **a thread** | the thread slides right and the project shows underneath, following the finger (the reverse of today's `enter-r` animation) | iOS back-swipe, Telegram |
| **a Chats session** | back to Chats | same |
| **Home, the Workspace or a project** (the top level) | the sidebar drawer slides in under the finger | Slack, Gmail, Discord |
| **the sidebar is open** | nothing: it's already open | — |
| **Settings, the viewer** | close, returning where you were | iOS back |

**Swipe left** closes the sidebar. The drawer follows the finger from anywhere on the drawer or the scrim (today only a tap on the scrim closes it).

In a thread, the sidebar is two swipes away (back to the project, then the drawer), or one tap on ☰. That matches the app's hierarchy (projects → project → thread) and gives "swipe right" one meaning: *step out toward the list*.

**Rules that keep it from misfiring:**
- **Start zone:** ignore drags that start within ~20 px of the left edge on iOS Safari (that edge is Safari's, and with §2.1 it does Back anyway). Everywhere else, anywhere on the content works.
- **Intent lock:** decide after ~10 px of movement. Horizontal means the angle is within ~30° of horizontal; otherwise it's a scroll and the gesture is dropped for this touch.
- **Commit:** on release, past ~40 % of the width or a flick faster than ~0.5 px/ms. Otherwise it springs back.
- **Don't start in:** the Now shelf, code blocks and wide tables that scroll sideways, the Settings tab strip, the Shells tab bar or a terminal, the composer while the text field holds a selection, or any open sheet.

### P1 · 2.3 Drag down to put a sheet away

Every bottom sheet (Needs you, All threads, Sub-agents, Jump, Intelligence, New chat) gets a visible **grabber** (36 × 4 px pill) at the top. A drag down on the grabber or the header closes the sheet, following the finger. This is the iOS and Android sheet convention.
- A drag on the sheet's *content* closes it only when that content is already scrolled to the top (otherwise it scrolls).
- Close at ~25 % of the sheet's height or on a downward flick. The existing `sheet-down` animation finishes the move.
- In **Needs you**, a commit window that is still running (the 3 s Undo) keeps running when the sheet closes, exactly as ✕ behaves now.

### P1 · 2.4 Needs you: swipe sideways to move between asks

In the Needs-you sheet, swipe the decision card **left for the next ask** and **right for the previous one**. These are the footer's ‹ › and the j / k keys. The rail of ticks moves with it. This is the photo-carousel and story pattern.
- It only *moves*. It never answers, defers or makes a rule (principle 5). An ask you swipe past just stays in the queue, as Skip does today.
- A destructive ask's **hold 1.2 s** stays a held press on its button, never a gesture.
- Inside the sheet this horizontal swipe takes the place of §2.2, so "swipe right" doesn't close the sheet there. Drag down (§2.3) and system Back (§2.1) close it.

### P1 · 2.5 A thread's decision card: drag down to fold, up to bring back

The `.card.is-dock` above the composer can take up to 52 vh. Dragging it down folds it to its one-line bar, the same as "Read the conversation first". Dragging that bar up opens it again. This is Apple Maps' and Music's mini-player. It hands the screen back to the conversation without hiding that something waits.

### P1 · 2.6 Scroll the conversation down to lower the keyboard

While typing, a drag down across the message list lowers the keyboard (blur the composer), as in iMessage and WhatsApp. Today the keyboard covers half the conversation until you tap somewhere. The draft is already saved per conversation, so nothing is lost.

### P2 · 2.7 Viewer: swipe down to close, pinch to zoom

The full-screen file viewer behaves like Photos:
- **swipe down** dismisses it (it drops and fades with the finger);
- **pinch and double-tap** zoom an image or PDF page, and you pan while zoomed (no dismissing while zoomed);
- **swipe sideways** moves between files when the message carries more than one.

### P2 · 2.8 Shells on a phone: a sheet with resting heights

Proposed for when `feat/browser-shells` lands. On a phone the Shells dock becomes a bottom sheet with three resting heights:
1. **a tab bar only** (the minimised state that exists today);
2. **about half the screen**;
3. **full screen, above the keyboard**.

You drag between them on the tab bar, which replaces the 8 px grip. Swiping sideways on the tab bar switches shells.

**Inside the terminal, every touch belongs to the terminal**: vertical drag scrolls the scrollback, long-press selects. None of the app's gestures (§2.2 to §2.6) start there. With the sheet at full height, system Back (§2.1) lowers it to the tab bar. It doesn't detach a shell.

### P2 · 2.9 Long-press a message: Copy, Select

A long-press on a message bubble or an agent's answer opens a small menu, as in Messages and WhatsApp:
- **Copy** (the whole message as text);
- **Select text** (hands back to the browser's own selection);
- the actions the row already has where they apply: **Retry** and **Edit** on a failed send, **Open thread** on a routed card.

Today only code blocks have Copy. Copying a whole answer on a phone currently means fighting the browser's selection handles.

### P2 · 2.10 Swipe left on a thread row: Resolve

In **All threads** (and Home's "Then" rows, if wanted), a swipe left on a thread row reveals **Resolve**. This is Mail's archive. A full swipe resolves it, and the existing herald line with **Undo** confirms it (`resolveThread`, 6 s). Resolving is reversible, so it is safe as a gesture. It answers no ask, so principle 5 holds.

### P3 · 2.11 Tap the title to jump to the top

Tapping the phonebar title, or a conversation's header, scrolls back to the top. iOS does this natively only for whole-page scroll, and the app scrolls an inner element (`.scroller`, `#home`), so the convention is lost today. Whether the top means the newest messages or the oldest loaded ones is a small decision; the oldest loaded is iOS's meaning.

---

## 3. Gestures we recommend not adding

| Gesture | Why not |
|---|---|
| **Swipe an ask to allow or deny** (Tinder-style) | It turns judgement into a reflex, and "no" can't be as cheap as "yes" (principle 5, kit.js rules). |
| **Swipe right on a message to reply or quote** (WhatsApp) | It clashes with swipe-right for back. If quoting ever ships, put it on swipe **left** on a message (Telegram's choice). |
| **Pull to refresh in a conversation** | The conversation is live (SSE, plus polling as a fallback), so there's nothing to refresh. `.scroller` already sets `overscroll-behavior: contain` so the browser's own pull-to-refresh can't reload the app mid-draft. Home could later get a calm "Up to date" pull, but it isn't needed. |
| **Swipe or long-press to send, or long-press Send for "Send now"** | Sending starts real agents, and "Send now" stops a running turn. Both stay as visible, deliberate taps. |
| **Shake to undo, multi-finger swipes, custom edge zones on iOS** | Hard to discover, easy to trigger by accident, and they clash with OS and accessibility gestures. |
| **Swipe between projects** | Projects aren't an ordered set you page through. The drawer and Jump are the real way between them. |

---

## 4. Feel: the small details that make it natural

- **Physics:** follow the finger 1:1 with no lag. On release, use a short spring based on the app's own `--glide` easing, and carry the release speed into it.
- **Rubber-band** at the ends: swiping to "previous" on the first ask, or right while the drawer is already open, stretches a little and springs back. It shouldn't feel like a dead stop.
- **Haptics** (Android only; iOS Safari has no web vibration API): one light tick (`navigator.vibrate(8)`) when a swipe passes its commit point and when a destructive hold completes. Nothing else buzzes.
- **Reduced motion:** gestures still work. Surfaces follow the finger, but they cross-fade into place instead of springing, as the existing `prefers-reduced-motion` rules do.
- **Screen readers:** VoiceOver and TalkBack take over swipes, so every gesture keeps its button (principle 6), and the drawer and sheets keep their current focus handling.
- **Discoverability without tutorials:** a grabber on every sheet; the drawer's edge shadow while it's dragged; the page underneath visible during a back-swipe; the folded decision bar showing its handle. No coach marks.

---

## 5. Order to build in (when asked)

1. **System Back via history** (§2.1). It's the biggest win and it's invisible.
2. **Swipe right for back or the drawer, swipe left to close the drawer** (§2.2).
3. **Drag down on sheets, with grabbers** (§2.3), and **scroll down to lower the keyboard** (§2.6).
4. **Needs-you swipe between asks** (§2.4), **fold the decision card** (§2.5).
5. **Viewer** (§2.7), **long-press menu** (§2.9), **swipe to Resolve** (§2.10), **tap the title for the top** (§2.11).
6. **The Shells phone sheet** (§2.8), once that branch is on `main`.

One small gesture module (pointer events, the intent lock, follow and settle, the "don't start in" list) can serve 2 to 5, so each surface only declares its direction and what commit does.

---

## 6. What was built, and where it differs

**Built:** everything in §2.1–2.11.

**Different from the proposal:**
- **Shells (§2.8).** The sheet has two heights, full screen and about half, and "away", where it waits in the sidebar's Shells row as it already did on this branch. A slim bar left on screen would have covered the composer. Back lowers a full sheet to half, then puts it away. Opening Shells from the sidebar also closes the sidebar.
- **Viewer (§2.7).** Pinch-zoom is the browser's own; the page allows it. A tap on an image already toggles actual size. Swipe down closes, and so does swipe right. Moving sideways between a message's files isn't built: the viewer opens one file at a time.
- **Long-press (§2.9).** The menu has Copy and Select text. Retry and Edit stay as the inline buttons a failed message already has. On touch screens, messages no longer start the browser's own selection on a long-press; Select text brings it back for that message.
- **Resolve (§2.10).** Only in All threads, not on Home's rows. A resolved thread's row offers Reopen instead.
- **Tap the title (§2.11).** It scrolls to the oldest messages loaded, which is what iOS means by the top. Reaching the top loads older history, as scrolling does.

**How Back works.** While there is something to go back to, the app keeps one history entry of its own. Back closes, in order: a dialog, Jump, Intelligence, a new chat's setup, Sub-agents, Keys, All threads, the viewer, Settings, the Shells sheet, the sidebar and Needs you. Then it goes from a thread to its parent. Then it retraces the places you visited, then goes to Home. With nothing left, it lets the browser leave. The entry is pushed only after your own tap, key or gesture, because Chrome lets Back skip entries that were pushed without one. Esc keeps its old behaviour.

**Tested** in headless Chromium as a Pixel 7, with real touch events sent through CDP:
- the sidebar opens and closes by swiping;
- swiping a thread back reaches its parent;
- a short swipe springs back;
- Back walks out from a thread to the project, then Home, then leaves;
- All threads and Needs you close when dragged down;
- Needs you moves between asks without answering one;
- Settings closes on a swipe right;
- the decision card folds and opens;
- a drag down over the conversation lowers the keyboard;
- tapping the title goes to the top;
- long-press shows Copy and Select text;
- Shells goes from full to half, and Back puts it away.

The viewer's swipes weren't tried live, because that needs a shared file.
