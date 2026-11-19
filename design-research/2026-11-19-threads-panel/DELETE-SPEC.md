# Spec for xo-space: deleting a thread (soft delete, with undo)

**For:** xo-space, which owns this route.
**Needed by:** the xo-coworker thread menu, which already has the UI. Delete appears there only for threads whose row says `can_delete: true`.

**Today** (read-only check of xo-space, 19 Nov):
- There is no route that deletes a thread. Its row, messages, events and transcript are never removed.
- The only nearby route is `DELETE /api/chat/worktrees/{chat}/{ts}?confirm=` (`routers/cowork_agent/storm/worktrees.py:45`, `services/cowork_agent/storm/worktrees/service.py:355`).
- That route removes the thread's worktree folder, and with `confirm` also `branch -D`.
- When work would be lost it returns `409 would_lose_work` with a confirm token. While the session is busy it returns `409 session_busy`.

## 1. Say which threads can be deleted
Add `can_delete: boolean` to every thread row in these responses:
- `GET /api/chat/chats/{chat}/threads`
- `GET …/threads/{ts}`
- the stream's thread events

**Rule:** a thread can be deleted when you can act on it in this chat: the owner in their own space. Return `false` for the coordinator's own host thread and for anything else xo-space protects.

The UI shows Delete only when this field is `true`, so an older xo-space shows no Delete.

## 2. Delete: `DELETE /api/chat/chats/{chat}/threads/{ts}`
**Body:** `{ "keep_branch": true, "confirm": "<token>"? }`. The UI always sends `keep_branch: true`.

**Steps, in order:**
1. **Stop** any run in the thread's session, the way `POST /api/chat/sessions/{sid}/runs/stop` does. Don't fail with `session_busy`.
2. **Remove the worktree** using the existing worktree service:
   - With `keep_branch: true`, delete only the folder, never the branch.
   - If removing the folder would lose work that isn't on any branch (uncommitted or untracked files), return `409 would_lose_work`. Use the same shape the worktree route uses: `{ code, what: {summary, changed, untracked, commits, branch}, confirm }`.
   - A second call that sends `confirm` goes ahead.
3. **Soft-delete:** set `deleted_at` on the thread. From then on:
   - its row is missing from every list and from `GET …/threads/{ts}`, which returns 404 `thread_deleted`;
   - its messages are missing from the chat's message pages;
   - "made" items it produced are hidden too (Artifacts);
   - the stream sends `{ kind: "thread_deleted", chat_id, ts }`, so other open clients drop it.
4. **Respond** `200 { "deleted": true, "undo_until": "<ISO, now + 10 s>" }`.

**Idempotent:** deleting an already-deleted thread returns the same 200 while it can still be undone, and 404 after.

## 3. Undo: `POST /api/chat/chats/{chat}/threads/{ts}/restore`
- **Before `undo_until`:** clear `deleted_at` and return the full thread row (as `GET …/threads/{ts}` would). The stream sends a normal thread event, so it reappears everywhere.
- **The worktree:** it was removed, so recreate it from the kept branch at its tip. That's cheap because the branch was kept. If recreating fails, still restore the thread and return `worktree: null`. The UI then says the folder is gone; the branch is still there.
- **After `undo_until`:** return `410 undo_expired`.

## 4. Purge
Some time after `undo_until`, remove the soft-deleted thread for real: its row, messages, events, transcript and stored attachments. The branch is kept.

Choose any timing you like. An hour, or a daily sweep, is fine. The UI never shows deleted threads again.

## 5. What the UI does with it
Built on `feat/threads-panel-build`, in `js/app.js` (`deleteThread`, `tdelRender`), `js/storm.js` (`deleteThread`, `restoreThread`) and `js/api.js`.

**The confirmation** is asked in place under the thread's header, with Keep it first. It reads: "Delete '<title>'? Its messages and transcript go, and its worktree folder is removed. You can undo it for a few seconds. Its branch `<branch>` is kept."

**On `409 would_lose_work`:** the UI names the work (`what.summary`), and the button becomes "Delete anyway", which sends `confirm`.

**On 200:**
1. The UI goes back to the project.
2. It shows the notice "'<title>' deleted · Its branch … is kept", with Undo until `undo_until`.
3. Undo calls restore.

## 6. Tests worth having on the xo-space side
- `can_delete` appears on rows.
- Delete stops the runs, removes the folder, keeps the branch, sets `deleted_at` and hides the thread everywhere.
- `would_lose_work`, then delete with the `confirm` token.
- Restore before `undo_until` brings back the row, its messages and its worktree. After `undo_until` it returns 410.
- Purge removes everything except the branch.
- Other clients receive `thread_deleted`.
