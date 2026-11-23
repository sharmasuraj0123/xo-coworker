# xo-space contract for the Files root fix

Version 1, 19 Nov 2026. This is for the xo-space project, built on `feat/storm-reliability` (`ef4a931`, PR #296, the build :5002 runs). The frontend (xo-coworker) is coded against it and degrades cleanly when a route or event is missing (§8).

The reasoning is in `PLAN.md`; the system map is in `README.md` (part A).

## 0. Conventions (all as today)

- **Errors:** `{"detail": {"code", "message", …extra}}`, as `_refused()` in `routers/cowork_agent/bff/xo_project_files.py`.
- **Paths:**
  - `relative_path` is **project-relative**, and a worktree's files sit under `.xo/worktrees/<name>/…` (as `/file` does).
  - Exception: `/paths` and `/search` answer relative to the **root asked for** (the project, or one worktree), and say which `root`.
- **Versions:** `version` is `"sha256:<hex>"` of the exact bytes, as `address.version_of`.
- **Writes** (every `POST` below and `PUT /file`):
  - They need **`X-XO-UI-Writer`**. The UI's `serve.py` adds it on its `WRITER_ROUTES`, and the frontend branch adds the new routes there.
  - Without it: **403 `ui_only`**.
- **Places:**
  - Every write obeys the places rules: **403 `read_only_place`**, **403 `outside_project`**, **428 `confirm_required` `{reason: "runs_code"}`**, which is then sent again with `confirm: "runs_code"`.
  - A rename or move checks **both** ends.
- **Secret names** (`.env*`, `*.pem`, `*.key`, `id_*`): content is held in memory only, as in today's edit log. Their versions answer `content_kept: false` after 15 min.

## 1. The version store (every writer)

It grows out of `services/project_files/edits.py`: same state folder, blobs, retention (30 days / 200 MB) and locking. Each record:

```json
{
  "id": "v_3f9a…",                 // was "e_…" for UI saves; both prefixes stay valid ids
  "path": ".xo/worktrees/x/docs/a.md",
  "worktree": "x",                 // or null
  "kind": "edit",                  // edit | create | delete | rename | restore | undo
  "old_path": null,                // rename only
  "from_version": "sha256:…",      // null for create
  "to_version": "sha256:…",        // null for delete
  "at": "2026-11-19T10:31:02.114Z",
  "by": {
    "kind": "ui",                  // ui | agent | disk
    "session_id": null,            // agent: the session that wrote it
    "thread_ts": null,             // agent: its thread, when it has one
    "turn_id": null,               // agent: the turn running when it changed
    "message_id": null             // agent: the turn's reply, set at turn end (§1.3)
  },
  "size_bytes": 1234,
  "content_kept": true,            // false: secret name, over 1 MB, or not text
  "confirmed": null                // "runs_code" when the UI confirmed
}
```

**1.1 Merge window.** A new record for the **same path by the same writer** replaces the newest record when that one is younger than **10 s**. "Same writer" means the same `by.kind` and, for agents, the same `session_id`.
- The replaced record keeps its `id` and `from_version`. Its `to_version`, `at` and `size_bytes` move on.
- The replaced intermediate blob may be pruned.
- This is what makes 1 s autosaves read as one version.

**1.2 No double records.** A change whose new hash equals the path's newest `to_version` is not recorded again. In practice that means the watcher seeing the UI's own `PUT`, or an agent writing identical bytes.

**1.3 Attribution:**
- **When the watcher sees a change** (§2), the record is `by.kind = "agent"` with `session_id` and `turn_id` if a turn is **running** in a session whose working folder contains the path. Otherwise it's `by.kind = "disk"`.
- **At turn end,** `Made._turn_wrote` (`services/cowork_agent/storm/made.py:186`) already lists the files that turn's tools wrote. For each one, the newest record for that path inside the turn's time window gets `by = {kind: "agent", session_id, thread_ts, turn_id, message_id}`. If no record exists (no watcher), one is created from the file's current bytes.
- **A change made through `PUT /file`** is `by.kind = "ui"`, as today.

**1.4 The base.** When a path has no record yet, the answer to `GET /versions` includes `head` (§4.1), the version git has at `HEAD`, so v1 always exists for a tracked file.

## 2. The watcher

- **Library:** `watchfiles.awatch` (1.3, already in the venv), one task per **project root** that has had a viewer or a running session in the last 30 min. It covers the project folder and each `.xo/worktrees/<name>/`.
- **Ignored:**
  - `.git/` (all of it), and a worktree's `.git` file;
  - `.xo/` except `.xo/worktrees/*/`, and inside a worktree its own `.xo/`;
  - `node_modules/`, `__pycache__/`, `.venv/`, `venv/`, `dist/`, `build/`, `.next/`, `.cache/`;
  - Space's own temp files `.<name>.xo-save.<hex>.tmp`.
- **Debounce:** 150 ms. Changes are folded per path, and the last state wins.
- **For each changed path:**
  - **A regular file:** hash it (up to 1 MB keep the blob; over 1 MB record the hash only, `content_kept: false`). If the hash differs from the path's newest record, record `edit` (or `create` when the previous state was "absent").
  - **Gone:** record `delete`.
  - **A rename the OS reports as a pair:** record one `rename` when the hashes match, else a delete plus a create.
- **Overflow or restart:** emit `file.rescan` (§3) for that root. No per-file records are guessed.
- **Budget:** inotify allows 1,048,576 watches here. `xo-coworker` is ~150 folders, or ~8,500 with its 65 worktrees.

## 3. Stream events (stored, so they're resumable)

Each is appended to the storm store with **`chat_id` = the project's chat**, so `/api/chat/stream` (no filter, `chat=`, or `kinds=file`) carries it. They replay on `Last-Event-ID` like every stored event.

**`file.version`** goes out once per record written, or per record a merge window extends:

```json
{
  "project_id": "xo-coworker",
  "path": "docs/a.md",            // project-relative, as /file
  "worktree": null,
  "id": "v_3f9a…",                // the record (stable through a merge window)
  "kind": "edit",                 // edit | create | delete | rename | restore | undo
  "old_path": null,
  "version": "sha256:…",          // null when deleted
  "prev_version": "sha256:…",     // null when created
  "by": { "kind": "agent", "session_id": "…", "thread_ts": "…", "turn_id": "…", "message_id": null },
  "at": "2026-11-19T10:31:02.114Z",
  "size_bytes": 1234,
  "content_kept": true
}
```

**`file.version.attributed`** fires when turn end (§1.3) sets or changes `by` on a record already announced: `{"project_id", "path", "id", "by"}`.

**`file.rescan`** tells clients the watcher lost track of a root, so open files should be re-read: `{"project_id", "worktree": null | "x", "reason": "overflow" | "restart"}`.

**Rate.** At most one `file.version` per path per 250 ms. Bursts fold into the newest.

**Catch-up beyond the replay window:** `GET /versions?since=` (§4.1).

## 4. Routes

### 4.1 `GET /api/xo-projects/{id}/versions`

Query parameters:
- `relative_path` (required unless `since`);
- `limit` (1–200, default 50);
- `before` (a record id, for older pages);
- `since` (ISO time: every record in the project at or after it, all paths, newest first, for catch-up after a long sleep).

```json
{
  "relative_path": "docs/a.md",
  "versions": [
    { "id": "v_…", "n": 7, "kind": "edit", "version": "sha256:…", "prev_version": "sha256:…",
      "at": "…", "by": { "kind": "ui", … }, "size_bytes": 1234, "content_kept": true,
      "old_path": null, "current": true }
  ],
  "head": { "commit": "ef4a931…", "version": "sha256:…" },
  "more": false
}
```

- **`n`** counts from 1 at the oldest record kept for the path.
- **`current`** is true when that `version` equals the file's bytes now.
- **`head`** is `null` outside git, or for a path git doesn't track.
- **Errors:** 404 `project_not_found`, 400 `invalid_path`.

### 4.2 `GET /api/xo-projects/{id}/file?relative_path=…&version=sha256:…`

- **Answers:** the same shape as `/file`, with the content from the version's blob (or git's object when it equals `head.version`), plus `editable: false` and `not_editable_reason: "historical"`.
- **404 `version_not_found`:** the blob was pruned, or `content_kept` was false.

### 4.3 `POST /api/xo-projects/{id}/files/rename` (rename and move)

- **Body:** `{"relative_path", "new_relative_path", "confirm"?: "runs_code"}`. It works for files and folders. Missing parent folders are made.
- **200:** `{"relative_path": new, "old_relative_path", "kind": "file"|"folder", "edit_id", "version"}` (`version`: the file's hash, or null for a folder).
- **Errors:**
  - 404 `not_found`;
  - 409 `exists` (`current: {version}` for a file);
  - 400 `invalid_path` (empty, `..`, absolute, into itself);
  - 403 / 428 as in §0 for either end.
- **Logged** as one `rename` record per file (a folder rename writes one per file, sharing one `edit_id` group). `POST /edits/{edit_id}/undo` moves it back.

### 4.4 `POST /api/xo-projects/{id}/files/delete`

- **Body:** `{"relative_path", "base_version"?: "sha256:…", "confirm"?: "runs_code"}`.
- **What it does:** moves the file or folder into Space's state folder (`<state>/projects/<pid>/files/trash/<edit_id>/`), never into the project.
- **200:** `{"edit_id", "kind": "file"|"folder", "count"}`.
- **Errors:**
  - 409 `file_changed` with `current` when `base_version` is given and differs;
  - 404 `not_found`;
  - 403 / 428 as in §0.
- **Undo:** `POST /edits/{edit_id}/undo` restores it (409 `exists` if something now sits there). The trash follows the log's retention.

### 4.5 `POST /api/xo-projects/{id}/files/mkdir`

- **Body:** `{"relative_path"}`.
- **200:** `{"relative_path"}`.
- **Errors:** 409 `exists`, 400 `invalid_path`, 403 / 428.
- **New files** stay `PUT /file` with `base_version: null`, as today.

### 4.6 `GET /api/coworker/xo-projects/{id}/paths` (⌘P, and the tree's find)

- **Query:** `worktree` (a worktree's name; the project's checkout when absent), `stamp`.
- **How:** `git ls-files -co --exclude-standard -z` in that root (tracked plus untracked, minus what's ignored). Outside git, a walk using §2's ignore set.
- **200:** `{"root": "" | ".xo/worktrees/x", "paths": ["js/app.js", …], "dirs": ["js", …], "truncated": false, "stamp": "…"}`
  - paths are relative to `root`, sorted, capped at 50,000;
  - `dirs` holds every folder that has a path, so the tree can show folders without listing each one.
- **With a matching `stamp`:** `{"unchanged": true, "stamp": "…"}`.

### 4.7 `GET /api/coworker/xo-projects/{id}/search` (⌘⇧F)

**Query:**

| Parameter | Default | Meaning |
|---|---|---|
| `q` | required | 1–500 characters |
| `worktree` | absent | a worktree's name; the project's checkout when absent |
| `regex` | `false` | treat `q` as a regex |
| `case` | `false` | match case |
| `word` | `false` | whole words only |
| `glob` | none | e.g. `*.md`, comma-separated |
| `limit` | 500 | 1–2,000 matches |

**How:** `git grep -n --column -I -z` (plus `--untracked --exclude-standard`), with `-F` unless `regex`, `-i` unless `case`, `-w` for `word`. Outside git, a Python walk with §2's ignore set. Binary files are skipped. Time budget 5 s.

**200:**

```json
{
  "root": "",
  "matches": [ { "path": "js/app.js", "line": 120, "col": 7, "text": "  const x = …", "ranges": [[6, 11]] } ],
  "files": 14,
  "truncated": false,
  "took_ms": 83
}
```

- `text` is the line, cut to 400 characters around the first match.
- `ranges` are character offsets in `text`.
- `truncated` is true at the limit or the time budget.

**Errors:** 400 `bad_regex` (with `message`), 400 `query_empty`.

## 5. Unchanged on purpose

- **`PUT /file`** keeps its body and answers (`base_version`, 409 `file_changed` with `current`, 428, 413, 415). It now also writes a version record (`by.kind = "ui"`, merge window) and a `file.version` event.
- **`/changes`, `/file-history`, `/edits`, and `POST /edits/{id}/undo`** stay as they are. Undo now also covers `rename` and `delete`.
- **`person_edits`** keeps telling agents what the person changed. It counts `rename` and `delete` too.

## 6. Tests the frontend relies on

pytest, so the frontend can trust these:
- **Merge window:** three saves 1 s apart → one record; a save 11 s later → a second record.
- **The UI's own save** is not recorded twice by the watcher.
- **Agent attribution:** a running turn → `agent`; no turn → `disk`; at turn end `message_id` is set and `file.version.attributed` is sent.
- **Rename and delete** are undoable, and the runs-code and read-only rules apply to both ends.
- **`/paths`** in a worktree lists untracked files and leaves ignored ones out. **`/search`**: regex errors come back as 400; the 5 s budget gives `truncated`.
- **Watcher overflow** → `file.rescan`.

## 7. Wire-up in the UI repo (the frontend does this)

- `serve.py` `WRITER_ROUTES` adds `POST /api/xo-projects/*/files/(rename|delete|mkdir)`.
- New API calls go into `js/api.js`.

## 8. How the frontend copes with today's backend (no contract yet)

| Missing | What the UI does |
|---|---|
| `file.version` events | It keeps today's signal: an agent's edit row → `/changes` → for an open file, one `GET /file`. A clean file then takes the new text in place as a new version. |
| `/versions` | The ‹ v of n › stepper holds versions this browser has seen since the file opened, plus your saves from `GET /edits`. |
| `/paths` | ⌘P walks `/tree` in the background, one folder at a time, with the same flat fuzzy list. |
| `/search` | The ⌘⇧F panel says search needs the newer Space. |
| `/files/*` | Rename, move and delete are hidden. New file and new folder use `PUT /file`. |
