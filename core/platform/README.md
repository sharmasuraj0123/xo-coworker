# core/platform

**Purpose.** The browser plumbing every layer above uses: requests, streams, keys, touch, time words and small helpers. It knows no feature and imports only itself.

## Files

| File | What it does | Loads with side effects? |
|---|---|---|
| `index.js` | The import-safe surface: re-exports `util`, `time`, `clipboard`, `motion`, `pending`, `fuzzy`, `diff`, `sse`. | no |
| `motion.js` | The one curve `EASE` (tokens.css `--ease`) and the live reduced-motion query `RM`; core/ui builds its motion on these. | no |
| `util.js` | `esc`, `space` (a spacing token's px), `isImagePath`. | no |
| `time.js` | `toMs`, `clock`, `dayOf`, `short`, `elapsed`, `since`. | no |
| `clipboard.js` | `copyText` (async clipboard, else the selection's copy), `COPY_REFUSED`. | no |
| `pending.js` | `once(key, work)`: a control's request answers once until it settles; `isPending`, `busyAttrs`. | no |
| `fuzzy.js` | Quick Open's matching: `score`, `rank`, `marked`, `lineOf`. | no |
| `diff.js` | Line diffs and three-way merges: `linesOf`, `changes`, `merge3`. | no |
| `sse.js` | `createParser` (incremental SSE) and `SSEStream` (resume by Last-Event-ID, backoff, resets). | no |
| `http.js` | `request` and the one error parser (`ApiError`), the Coder token, `blob`, `text`, `upload`, `signedUrl`, `socketUrl`, `urlOf`, `missingRoute`, `clientId`. | **yes**: takes the Coder token out of the address bar |
| `keys.js` | The shortcut catalogue and engine: `is`, `globalFor`, `typing`, `label`, `hint`, `set`, `reset`, `onChange`. | **yes**: reads `cv-keys` from localStorage |
| `gestures.js` | The touch primitive: `drag`, `glide`, `follow`, `unstyle`, `tick`, `scrollsX`, `scrolledY`, `edgeIsSafari`, `FLICK`. | **yes**: a capture `touchstart` listener resets the one-touch claim |
| `types.d.ts` | Types shared by the files above. | — |

Import the side-effect files by their own path, never through `index.js`, so loading the surface never touches the page.

## Storage keys

`cv-keys` (localStorage, custom shortcuts), `xo-coder-token` (sessionStorage, this tab's Coder token).

## Tests

`tests/*.test.mjs`, run by `node tests/run.mjs`. `exports-used.test.mjs` fails when an export here has no importer.

`routes-contract.test.mjs` drives every route the client has (`api.js`'s `api`, its attachment helpers, and Launchpad's deploy client) with fetch faked. Each request's method and path must be in `tests/fixtures/openapi-routes.json`, which is xo-space's `/openapi.json` reduced to each path's methods. Refresh that snapshot with `node tools/openapi/snapshot.mjs` (one GET from 127.0.0.1:5002, or the base given as its argument); a route xo-space drops then fails the test, not the owner.
