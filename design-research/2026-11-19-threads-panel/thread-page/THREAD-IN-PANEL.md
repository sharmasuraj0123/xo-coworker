# A thread beside the coordinator's chat: the plan

**Date:** 19 Nov 2026. Planned on the branch build (`dd5fbe32`). This is a plan with mockups only; nothing is built until the owner approves.

**The owner, 14:44Z:** "a thread opening beside the coordinator chat, i want you to research and plan it first and show me how it looks only then work on it."

**One panel model.** This plan uses the same model as the Files plan (the Files thread's `FILES-IN-PANEL.md`). The panel shows either its sections (Threads, Changes, Map, Launchpad) or one page: Shell (today), Files (that plan), or Thread (this plan). There is one switch, `stage.dataset.page`, and each page keeps its own width. The two plans read as one design.

## The mockups

They are in this folder. Each is made on the live app from its own pieces: the thread's real checklist bar, messages and composer, moved into the panel's page slot (`mock.cjs`, read-only).

| Shot | What it shows |
|---|---|
| `beside-dark.png`, `beside-light.png` | The coordinator's chat stays where it is. The panel shows the thread as a page, 560 wide: ‹ back to the sections, the thread's name, its state, runtime and branch, its checklist bar, its conversation, and its own composer ("Reply in this thread"). |
| `files-dark.png` | A thread and a file both open. The panel's head holds them as two tabs (Thread · FILES-IN-PANEL.md). One page shows at a time; ‹ goes back to the sections. |
| `focus-dark.png` | Focus (⤢): the panel takes the whole area beside the sidebar. The thread keeps its reading width (768), as a full-width thread does today. |
| `phone-dark.png` | On a phone, the panel is the full-screen sheet it already is. The thread fills it: ‹ goes to the panel's sections, × goes back to the coordinator's chat. |

## How it behaves

**Opening**
- Opening a thread puts it in the panel. That covers a row in the panel's Threads, a thread card's "Open" in the chat, a thread link in a message, and ⌘K.
- **"Open full width"** in the thread's ⋯ menu (or ⌘-click) gives today's full page. Both ways stay.
- **From Home or Artifacts** (no coordinator chat on screen), a thread opens full width, as today.

**The panel's head** (40 high, today's bar):
- ‹ Sections;
- the open pages as tabs (a thread, files), at most 5, the oldest closing first;
- Shell, ⤢ focus, ×.

A dot on ‹ says something in the sections needs you.

**Under the head**
- The thread's state, runtime and branch.
- Its ⋯ menu, the same one as today's thread header: rename, label, stop, delete and the rest.
- The checklist bar.

**Its conversation and composer** are the thread's own. The coordinator's composer still says "To the xo-coworker coordinator", and the panel's says "Reply in this thread". The two targets are always written out. You asked for no focus ring, so none is added.

**A decision the thread asks for** docks above the panel's composer. That's where it docks today, above the thread's composer.

**Width**
- 560 by default, a 520 reading column at the panel's inset.
- Drag 480 up to the window minus 560, so the chat never drops below 560.
- The width is kept for threads, apart from files' 640 and the sections' 360. The keyboard resize stays.

**Focus (⤢)** takes the whole area; the coordinator's chat folds to a thin bar with an amber dot when it needs you. This is the same rule as Files.

**Back and close**
- ‹ goes to the sections. The thread stays a tab: reopening it is instant, scrolled where you left it.
- × closes the panel.
- Esc steps back in this order: focus, then sections, then close.

**Reading marks** a thread seen while it shows in the panel, as opening it does today.

**Next to Files**
- One page at a time, with one tab strip.
- A file opened from inside the thread page (a chip, a link) opens as a Files tab, and the thread's tab stays.
- The widths swap per page. The chat reflows at most once.

**On a phone**
- The thread is the panel sheet's page: ‹ goes to the sections, × goes to the chat.
- There is no second composer on screen: the sheet covers the chat.
- This replaces today's "a thread is a separate place" on a phone, and Back returns to the coordinator's chat where you were.

## What it takes

Today the conversation is one of a kind: `render()` in app.js draws `#msgs` for `S.view`, follow.js owns `#scroller`/`#column`, and the composer, dock, herald and typing line are single elements. A second conversation on screen needs one of two things.

| | A. The conversation as an instance (recommended) | B. The thread in an embedded frame |
|---|---|---|
| **How** | Move the conversation's drawing out of app.js into `conversation.js`: its messages, typing line, follow (scroll), composer, decision dock and target line. The main chat and the panel page are two instances of it. Both are fed by the one world and the one stream that already exist. | The panel page holds the app itself at `?embed=t:<id>`, showing only a conversation. |
| **Cost** | 3 to 4 days (below) | 1 to 1.5 days |
| **Good** | One app, one stream, shared state. The thread page is exactly today's thread. Files' page and Shell already live in the same panel. | Fast. Zero risk to the main chat's code. |
| **Bad** | It's the biggest refactor of app.js since the chat view. Scroll anchoring (follow.js) must become per-instance, and that's where bumps came from before. | A second load and a second stream (twice the reads). Keys, focus, theme and drag-and-drop cross a frame. It isn't "one app". |

**Phases, for A:**

| Phase | What | Size |
|---|---|---|
| P0 | The panel's page model, shared with Files' P1 (sections or one page, the tab strip, a width per page). It's done once, by whichever lands first. | (in Files P1) |
| P1 | `conversation.js`: the conversation as an instance. The main chat moves onto it with nothing changed (tests, a bumps check at 1× and 4×). | 2 days |
| P2 | The Thread page: the panel instance, its head and sub-head, ⋯, checklist bar, the docked decision, entry points, ‹/×/Esc, focus, the tab with Files. | 1 day |
| P3 | Phone (the sheet's page), reading marks, the widths kept, tests, and a four-cell screenshot set when you ask for browser runs. | ½–1 day |

## Risks

- **Scroll anchoring with two live conversations.** follow.js was the source of every bump fixed this month (`chat-scroll-anchoring-traps`). P1 keeps one owner per instance, with no shared module state. It's checked with the existing bumps trace before anything else is built on it.
- **Two composers.** You can type into the wrong one. The target line already names each, and Enter only sends from the focused one. If it still confuses, I'd dim the one you're not in, rather than add a ring.
- **Width.** At 560 a wide table or code block scrolls sideways, as in the chat today; focus (⤢) is the answer.
- **Work in flight.** The Files thread's P1 and this plan both touch stage.js's page slot. We agree the page API (`page(name, host)`, `pages()`, `width(name)`) before either builds.

## What the owner decides

1. Build it on **A** (the conversation as an instance, 3–4 days) or **B** (an embedded frame, 1–1.5 days)?
2. Should a thread opened **from the chat** (a card's Open, a link) go to the panel, or only one opened from the panel's Threads?
3. Is 560 the right default thread width?
