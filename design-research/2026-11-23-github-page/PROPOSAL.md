# Issues and pull requests, per project: proposal

The owner asked on 2026-11-23 for an issues/PRs page on each project that is on GitHub. This is the design. Nothing is built for live yet.

## What Space :5002 already serves (checked 2026-11-23)

| Need | Space today |
|---|---|
| Is this project on GitHub? | Yes. `GET /api/xo-projects/{id}/github/issues` returns `repo` (e.g. `quirq-ai/xo-space`), or `state: "no_remote"` with `repo: null` (xo-apps). |
| Issues list | Yes, from the poller's mirror: number, title, open/closed, state reason, assignees, url, updated time. It does a cold fetch on first ask and then polls every 60 s. |
| Labels, author | No. The poll query doesn't fetch them (`labels: null`). |
| Issue body and comments | No route. `issue_actions.fetch_issue` fetches one issue (with labels) for adoption only. |
| Pull requests | Nothing at all: no query, no mirror, no route. |
| Checks / CI | Nothing. |
| GitHub connection health | Yes. `GET /api/connectors/github/status`. |
| "Start a thread on this" | Partly. `POST …/github/issues/{n}/adopt` records an issue as a workitem, and `…/workitems/{id}/claim` ties a session to it. The issue list already returns `adopted`, `workitem_id` and `in_progress`. |
| Writing to GitHub (comment, close, merge) | No, on purpose. Space's rule is that GitHub is read-only to the system (workitems plan, amendment 33). |

**Right now:** GitHub's sign-in on this machine has been invalid since 2026-11-18 ("Bad credentials"; `gh auth status` reports that the token for dwivedi-ai is invalid). The mirror still holds what it read on 18 Nov. Only the owner can reconnect.

## Where it lives

It's a page of the panel, like Files. A GitHub button in the panel's bar, beside Files, shows only on a project with a GitHub remote. The chat stays where it is, ‹ or Esc goes back to Threads, Changes and Map, and an issue or PR opens as a page over the list, the way a shell keeps the page under it.

I didn't choose either of these:
- *A fourth frame in the stack* (Threads · Changes · Map · Issues). It would squeeze Threads and Changes, which already compete for height.
- *A page of its own* (like Home or Launchpad). It would take the chat away, and most of what you do here is "put an agent on this", which happens in the chat.

## How it looks (shots: dark and light, 1440×900, at 1×)

- **List** (`shots/*-1-issues.png`, `*-2-prs.png`): two tabs in the frame-tab style, Issues and Pull requests, each showing its open count. Open on GitHub ↗ and Read again ⟳ sit on the right. Rows are the Threads rows (tile, title, a meta line, age), grouped and folding the same way:
  - Issues: **In a thread** (an agent is on it: the tile carries the working arc) · **Open** · **Closed** (first five).
  - Pull requests: **Needs you** (your review asked, or checks failing: the amber diamond) · **Open** · **Merged and closed**. The meta line shows checks ✓/✗/running, the review state and the head branch.
  - A stale or broken connection is a single line above the list: "GitHub's sign-in has expired. This is what it said 5 days ago." with a **Reconnect** button.
- **Item** (`*-3-pr.png`, `*-4-issue.png`): title and number, a state badge, author, age and comment count. Then one main action: **Work on it in a thread** (for a PR, **Review it in a thread**; **Open its thread** if one is already on it) and **Open on GitHub**. For a PR, its checks and its changes (files, +/−, branch → base) come next, then the body and the comments.

Everything is built from existing parts and tokens: `.ag-r` rows, `.tg-h` group heads, `.fr-h/.fr-t` tabs, `.fr-ib` icons, `.badge`, `.btn`/`.btn-pri`, `.ch-r` rows, `.prose`, `--accent/--err-ink/--info/--warn`, `--add-text/--del-text`. The new CSS is about 35 lines of layout. Merged PRs use ink, not violet, because violet belongs to the coordinator.

## What's real in the shots, and what's sample

- Real: the issues list (xo-space's mirror, 38 issues), the repo name, the "sign-in expired" state and its date.
- Sample: every pull request, the checks, the issue and PR bodies and comments, and the one "In a thread" issue. Space doesn't serve any of these yet.

## Space work it needs (smallest first)

1. **Author and labels in the poll.** Two fields added to the existing query, at the same cost (1 point per poll).
2. **Pull requests in the same mirror.** A `pullRequests` connection next to `issues`, in the same poll and the same mirror document: number, title, state, draft, author, head/base, `reviewDecision`, `statusCheckRollup.state`, +/−/files, comment count, updated time. Plus `GET /api/xo-projects/{id}/github/pulls`, shaped like `/issues`. Why the mirror and not a live call per open: the page then opens instantly, offline it shows the last read, and the budget stays one poll.
3. **One item, on demand.** `GET …/github/issues/{n}` and `…/github/pulls/{n}` for the body, comments, labels and (for a PR) check runs. These are fetched when you open an item and never polled. It extends `fetch_issue`, which already exists.

No Space work is needed for:
- "Work on it in a thread": the app adopts the issue (existing route) and sends the coordinator a message naming it (existing send). The row's "In a thread" comes from the existing `in_progress`.
- "On GitHub?" and connection health: both are already served.

Not in v1: commenting, closing, merging and approving from the app. Space treats GitHub as read-only, and agents in threads already have `gh`. Ask a thread, or use Open on GitHub.

## Prototype

Branch `xo/thread-bd5376`: `js/ghpage.js`, plus wiring in `js/stage.js`, `js/app.js` and `js/api.js` (`githubIssues`), and styles at the end of `css/panel.css`. It ran on scratch :5193 against the real Space, with every write blocked in the page. The sample PRs, bodies and comments are hard-coded and would go when it's built for real.
