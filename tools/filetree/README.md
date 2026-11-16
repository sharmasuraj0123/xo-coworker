# Files tree bench

Times the Files tree (`js/files.js`) on a real repository's listing, and checks that two versions of it draw
the same rows. From the @pierre/trees evaluation (`design-research/2026-11-pierre-trees-eval` on
xo/thread-1dce08), which found that a folder click redrew the whole list.

1. A listing, one line per entry, `d|f <bytes> <path>`:
   `find /path/to/repo -mindepth 1 -printf '%y %s %P\n' > /tmp/filetree.txt` (set `LISTING=/tmp/filetree.txt`).
2. Serve the repository root: `python3 -m http.server 3922 --bind 127.0.0.1`. For a before/after, serve a
   `git archive` of the older commit on another port.
3. `node tools/filetree/perf.mjs <port> [cpu throttle, 4] [open rows, 2000,6000]`: opening Files, a render
   with nothing changed, closing and reopening the last and the first open folder (and whether focus stays),
   a search keystroke and clearing it, scrolling. Headless Chromium at 4× CPU, as the evaluation measured.
4. `node tools/filetree/same.mjs <before port> <after port>`: the same 27 steps (opening, closing, picking
   files, searching) on both; after each, every row in order, with its state, must match. Exits 1 if not.

Playwright comes from `/tmp/pw/node_modules`.
