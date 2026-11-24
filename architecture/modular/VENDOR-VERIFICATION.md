# Vendor relocation verification

[VENDOR-SHA256.tsv](VENDOR-SHA256.tsv) records each source and destination with SHA-256 computed independently from the pinned P4 tree, `81d7be3a8a89db8ebe9bb295ff17eb882d8af87b`, and the relocated tree. All 367 pairs match, and Git identifies all 367 as exact renames.

| Library | Files |
| --- | ---: |
| Agent marks | 4 |
| CodeMirror | 128 |
| KaTeX | 24 |
| Mermaid | 108 |
| Pierre Diffs | 94 |
| Pierre tree assets | 3 |
| xterm | 6 |

The [move ledger](LEDGER.md) closes all 367 records individually. Pierre Diffs' manifest uses `moved` because `48e35b8b` removed the editor metadata after the historical ledger base. Its relocated bytes match the pinned P4 tree.

## Static delivery

The `serve.py` loopback probe compares separate Git exports of the pinned and relocated trees. Each of the 367 files is fetched at the current and a stale version on both trees, for 1,468 successful requests. All responses match the recorded digest and MIME type. Current URLs return `public, max-age=31536000, immutable` and stale URLs return `no-cache`. A further 367 requests to the old paths on the relocated tree return 404.

| MIME type | Files |
| --- | ---: |
| text/javascript | 328 |
| font/woff2 | 20 |
| text/markdown | 8 |
| application/octet-stream | 4 |
| image/svg+xml | 3 |
| application/json | 2 |
| text/css | 2 |

Acorn resolves the vendor graph's 1,189 static imports and re-exports and 290 dynamic imports from their versioned parent URLs. Every dynamic import has a literal specifier. The 319 distinct targets stay under the versioned root and return JavaScript on each tree. The consumer checks cover Files' editor and merge entry points, the Changes diff module and module worker, Mermaid's deferred entry, both KaTeX assets and the xterm modules. The KaTeX stylesheet's 20 relative font references and the four agent-mark declarations referencing three SVGs resolve under the same version. The app entry serves xterm's stylesheet in its original position.

## Regression checks

- Omitting `vendor/` from the versioned graph fails the vendor content-change test.
- Restoring an old xterm or KaTeX path fails the published link or runtime asset check. Changing xterm response bytes or CodeMirror chunk bytes without changing the filename fails the pinned checksum.
- Starting CodeMirror configuration or Mermaid during boot fails its import trace. Completing KaTeX before its stylesheet or removing a font fails the corresponding readiness or HTTP check.
- Changing the Changes worker URL, language mapping or generated theme fails the worker, language or theme check. Restoring a retired Pierre browser route glob fails the Node-level URL match.
- Changing the agent-mark SVG, its delivery MIME or response bytes fails the URL or HTTP check. Returning 200 for a retired route fails its retirement check.
- Reversing the declared CSS layers or adding a pen to a rendered SVG root fails the parsed cascade or DOM check.

P5 owns the browser checks for the editor, terminal, Changes highlighting and worker, Mermaid, KaTeX, runtime marks and the two Pierre browser flows. Compare boot requests with the pinned baseline after normalizing moved paths. On-demand vendors stay deferred and xterm keeps its existing eager timing. Package V exercised the HTTP delivery and Node runtime checks.
