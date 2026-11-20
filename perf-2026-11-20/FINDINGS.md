# Load gaps on :3000 (release/2026-11-19 @ 5a2b0784), measured 2026-11-20 21:24Z

Live folder /opt/xo-cowork/frontend = git 5a2b0784 (diff -rq clean). Backend :5002 (xo-space app-host build).
One headless run (probe.mjs, raw numbers in out.json): 1440x900, GETs only.
Two cells: "local" (loopback, 1x CPU) and "remote-like" (60 ms RTT, 3 MB/s, 4x CPU throttle).

## 1. Opening xo-coworker until usable

| step | local 1x | remote-like |
|---|---|---|
| skeleton painted (FCP) | 0.18 s | 0.52 s |
| 80 JS modules loaded, DCL (3 import levels, 2.5 MB, no gzip) | 0.63-0.68 s | 2.14 s |
| stream opened, first frame (storm waits for it before loading) | 0.68 s | 2.20 s |
| last boot read lands (the 25th runtime-policy read) | 1.52 s | 19.6 s |
| sidebar + page drawn (render() returns until state.loaded) | **1.56 s** | **19.8 s** |

Backend time is small: every boot read answers in 2-150 ms on :5002 (curl through :3000: chats 5 ms,
sessions 8 ms, runtimes 115 ms, the 24 thread lists 133 ms wall at 6-way). The stream snapshot arrives in 2 ms.

What the time is spent on:
- **The gate.** app.js render() returns until storm's `loaded`, set when loadAll() ends. loadAll waits for
  chats, then 24 per-project thread lists + sessions + review + routed + runtimes + policies. Policies =
  the Space's, then **24 per-chat runtime-policy reads (233 bytes each)**, 6 at a time. About 50 sequential-ish
  requests in ~8 rounds sit on the critical path. Only the composer's model chip (intel.js) uses chat
  policies. The sidebar draws 40 ms after the last policy read in both cells.
- **Bytes.** Boot moves 3.2 MB of static files and 2.6 MB of JSON across ~100 API calls, none compressed.
  serve.py drops Accept-Encoding upstream and never gzips static files. xo-coworker's thread list alone is
  653 KB (119 KB gzipped), and 418 KB of it is the `outputs` field of 91 threads (49 of them resolved).
  sessions 237 KB, one chat's hops 609 KB, made 143 + 131 KB. JS+CSS gzip from 3 MB to 0.78 MB.
- **Request queueing.** The SSE stream holds one of the browser's 6 HTTP/1.1 connections, so ~100 calls go
  through 5. In the remote-like cell that is most of the 17 s between JS done and draw. Unverified for the
  owner: if Coder's proxy serves the browser over HTTP/2, this cap goes away, but the bytes and the round
  trips stay.
- **Eager vendors.** xterm (345 KB + css) loads at boot without a terminal open. KaTeX and Mermaid are
  lazy, as stated before (not in the static import graph or the boot resources).
- **storm's 4 s timer.** Still on release (storm.js:891, never cleared). Today it costs nothing because the
  snapshot comes in 2 ms. It would cost up to 4 s only if the stream's first frame stalls. The real cost
  is the serial order: loadAll waits for the first frame (40 ms local, 0.3 s remote-like).
- **Idle.** Confirmed: 40 of 40 requestIdleCallback deadlines were 15-16 ms (8-16 ms at 4x CPU). The page is
  never idle. This does not delay the load itself.
- No long tasks at 1x. At 4x CPU: 0.7 s total (one of 251 ms when the modules run).

## 2. "Loading the thread…" gap (first open; time from click to the note gone)

| | local 1x | remote-like |
|---|---|---|
| full width (#msgs link), thread cmsg_13f4… | **0.41 s** | **0.77 s** |
| right panel (Threads tab), thread cmsg_6d08… | **0.63 s** | **1.15 s** |

The thread draws nothing until all four reads land. That is deliberate (it stops the page jumping):
messages (40), events (500 frames, 70-360 KB), events (control kinds), hops. These are already parallel.
- Backend share (:5002): 110-135 ms wall for these busy threads (the events read is the slowest and
  largest). Quieter threads take 33-63 ms.
- The rest is browser-side: queueing behind boot's leftover requests (made x24, messages x7, images) on 5
  free connections, then transfer and drawing. In the panel the four reads came back at 484-562 ms, against
  ~130 ms on the backend. At 4x CPU the panel page's mount and draw add ~1 s of long tasks (246, 134, 160 ms …),
  against ~0.6 s for full width. A new panel page costs more CPU than reusing the main conversation.

## Proposed fixes (nothing built; expected gains from the numbers above)

1. **Draw on chats, not on everything.** Set `loaded` after chats + sessions + status. Fill thread lists
   into the skeleton's held places as they land. Read per-chat runtime-policy only when a composer for
   that chat shows, or after the first draw. Run loadAll beside the stream's first frame instead of after
   it (frames are already held), and clear the 4 s timer (the modular fix). Gain: local 1.56 s → ~0.75 s,
   remote-like 19.8 s → ~4-5 s.
2. **gzip in serve.py.** Static files and JSON when the browser accepts it; SSE stays raw. Pass
   Accept-Encoding through, or compress in the proxy. 5.8 MB → ~1.2 MB. Gain ≈ 1.5 s at 3 MB/s, about 0 on loopback.
3. **Slimmer thread list (xo-space, backend).** Leave `outputs` (and `card`/`status_md` bodies) out of
   GET …/threads, or behind `?fields=`. Read them per thread. That is 653 KB → ~150 KB for xo-coworker.
   This belongs to xo-space, not to this project.
4. **Thread open.** Start loadThread on pointerenter/focus of a thread row. The 0.3-0.4 s wait mostly
   hides behind the hand's travel, and the page still lands whole. Defer boot's `made` x24 until idle-ish
   or until Artifacts/Home shows, so a thread's reads never queue behind them. Optionally make the first
   events page smaller (it is the slowest read). Gain: perceived gap 0.41 → ~0.1 s full, 0.63 → ~0.25 s panel.
5. **Lazy xterm** (import on the first terminal). Saves 345 KB and ~0.1-0.4 s of boot.
