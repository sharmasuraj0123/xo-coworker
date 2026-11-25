# Conformance checks

`node tools/check.mjs --fast` checks the working tree. For a package review, pass
`--conformance-base <start-commit>` from the checkout so the check also accounts
for files changed in earlier commits. An archive can verify the baseline counts.
Use the checkout for the package's changed-file check.

Each baseline records old findings by path and rule; no file may gain a
finding. A baseline that could be lower, or one raised since the base, prints a
`note` and does not fail: `--update-baselines` lowers it, and a raise needs its
reason in the commit. A changed file loses its allowance for type escape
hatches, `@ts-check` gaps, legacy comments and swallowing catches; its other
findings stay under the per-file baseline.

The lifecycle check follows lexical bindings in application and core code. It
recognizes bare and qualified browser globals and catches that silently return a
fallback. Shared scope and storage primitives own the underlying platform calls.
Native resources pass when a proven scope owns their cancellation, and an
exported observer setup must pass its disposer to a scope in every consumer.

Source-read attribution traces static paths and recognizable templates. Dynamic
reads still count against their test file. The expando rule detects underscore
writes and other writes on statically recognizable DOM receivers. Export usage
follows re-exports and counts the names read through a namespace or destructured
from it. Opaque namespace reads conservatively keep any export they could access.

The one-time coverage migration in `tools/baselines/coverage.json` records each
newly detectable site against its original source bytes. Remove a file's
migration entry when fixing it. Changed files lose all migrated coverage, and
entries can only shrink.

For stylesheet moves, compare `node tools/conformance/css-resolve.mjs --flat <root>`
for the two trees. It follows links and imports, preserves layer registration,
declaration order and conditions, and distinguishes versioned and root asset paths.

For token migrations, compare `node tools/conformance/css-resolve.mjs --resolved
<root>`. It folds root tokens where the supported theme, flavour, width and
contrast states determine their values. It retains local and runtime-dependent
values symbolically. This gives a regression check for stylesheet and root-token
changes. Element matching, custom-property inheritance in arbitrary DOM trees
and layout are still covered by the style package's screenshot pairs.
