# Conformance checks

`node tools/check.mjs --fast` checks the working tree. For a package review, pass
`--conformance-base <start-commit>` from the checkout so the check also accounts
for files changed in earlier commits. An archive can verify the baseline counts.
Use the checkout for the package's changed-file check.

Each baseline records findings by path and rule. It can only decrease.
`--update-baselines` removes allowances once the checks pass. The changed-file
gate clears type escape hatches, legacy comments, comment-only catches, viewport
constants, DOM expandos and source-reading tests about the changed files. Other
findings are subject to the per-file ratchet as their owning packages remove them.

Source-read attribution traces static paths and recognizable templates. Dynamic
reads still count against their test file. The expando rule detects underscore
writes and other writes on statically recognizable DOM receivers. Export usage
follows re-exports and treats namespace or dynamic imports as potentially reading
any export.

For stylesheet moves, compare `node tools/conformance/css-resolve.mjs --flat <root>`
for the two trees. It follows links and imports, preserves cascade order and
conditions, and compares relative asset URLs by their resolved paths.

For token migrations, compare `node tools/conformance/css-resolve.mjs --resolved
<root>`. It folds root tokens where the supported theme, flavour, width and
contrast states determine their values. It retains local and runtime-dependent
values symbolically. This gives a regression check for stylesheet and root-token
changes. Element matching, custom-property inheritance in arbitrary DOM trees
and layout are still covered by the style package's screenshot pairs.
