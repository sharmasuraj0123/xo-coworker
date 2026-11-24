# P4 keyboard layers and compatibility cleanup

**Base** · Verified P3 exit at `modular-gate-P3-group-06`. Resolve the hash after the Group 6 merge. Suggested branch `modular/p4-keyboard-shims`.

**Ownership** · The remaining overlay and shortcut wiring in the app entry, `shell/layers.js` and its shell and kernel contracts, compatibility entries and their importers, static entry references required by those removals, and the remaining ledger dispositions documented at the P3 exit. Leave conversation, decisions, module-owned action bodies, styles and product behavior alone. Any stylesheet path change keeps its exact link slot, cascade and versioned asset resolution.

| Ledger prefix | Keys from Group 4 |
| --- | --- |
| `js/app.js::functions::` | `runsEscape`, `openAll`, `closeAll`, `focusOverlay`, `syncInert`, `keyLayer`, `openKeys`, `closeKeys`, `runGlobal` |
| `js/app.js::keys::` | `Escape`, `ArrowDown`, `ArrowUp`, `Enter`, `Tab`, `/`, `End`, `ArrowRight`, `ArrowLeft` |

**Entry** · Before editing, confirm the 18 keys against the pinned ledger and account for Group 6's handoff. Capture the live Back and Escape sequences in `shell/layers.js` and the active Tab/inert behavior through boot. Cross-check with release parity tests. Inventory shims by reading their contents and tracing static imports, dynamic imports, preload links, server rewrites and fixtures. A legacy file containing runtime code requires a separate verified move before its entry can be removed. Review open ledger obligations individually and bring any uncertain ownership to the coordinator.

At the Group 4 checkpoint, 556 open entries are outside the index, app, conversation stylesheet and decision package. They cover 286 unit-test and fixture entries, 218 legacy browser-test entries, 45 tooling entries and seven styles or assets. Recount after Group 6. Confirm the actual destination of each entry and identify browser coverage already replaced before proposing any removal. Browser suite execution remains subject to the owner's P5 approval.

## Slices and checks

1. **Escape and shortcuts.** Use the existing kernel layer stack and shell registrations. Preserve the distinct OS Back and Escape orders, including Back's standalone viewer and unsaved-edit confirmation. Preserve native modal ownership, IME cancellation, application and terminal shortcut ownership, and the app navigation fallback. Test each full order and competing surfaces together, including Chats setup with Runs, Files or viewer with phone panel and Settings, and Settings ahead of Files for Escape. Reordering either sequence must fail.
2. **Inert ownership.** Couple the existing inert transitions to the registered surfaces on the same stack. Check stacked and independently inert regions as layers open and close, and phone drawer changes at the media-query boundary. Files retains the inert state it owns. Test exposure of background controls and focus restoration as the top layer closes.
3. **Tab and focus.** Preserve the current Tab precedence for the shortcut sheet, All Threads, Jump, phone Settings and phone drawer. Check both wrap directions, focus return, a control that claims Tab, a native modal still closing, and focus never falling to `BODY`. Register each surface once, and keep each key's order as data in one place. Use boolean DOM identity comparisons.
4. **Compatibility entries and ledger.** Repoint callers to the owning modules before removing each now-unused shim, in named slices. Check the import map and the versioned static graph, first stylesheet and Home first paint before boot, and normal startup through the shipped entry. Reconcile remaining asset, tooling, test and code entries by actual destination or verified disposition. Preserve deferred Apps cases and the P5 browser harness. Move no code to a weaker layer to satisfy a path, and preserve every storage key.

**Exit** · Run the serial capped full check from a clean archive with the project's lease, then `check_ledger.py --final` separately. Require exit 0 and zero open obligations. Verify the compatibility entries have no remaining callers, the published entry resolves through the static server, and Back, Escape, inert and Tab each have DOM or public-API coverage with deliberate breaks. Obtain the independent review before tagging `modular-gate-P4`. Keep the P3 tag as the rollback point and record any newly observed issues in the consolidated handoff. The post-P4 fix phase starts only after this gate.

## Engineering and quality checks

- **Small, named commits**, each doing one thing, with a message that says what and why. No mixed refactor+behaviour commits. No drive-by edits outside the package's files.
- **Moves are moves**: code moved byte-equivalent apart from imports and types, checked with a diff of old against new. Any behaviour change is its own commit with a test that fails before it.
- **Clear names and real types.** No `any` without a written reason in the commit, no dead code, no commented-out code, no TODOs left behind, no duplicated helpers: reuse core/platform, core/ui and core/services.
- **No catch-alls or swallowed errors, and no timeouts or sleeps used to paper over races.** Find the cause.
- **Tests check behaviour through the DOM or the public API**, never by grepping source text, and each one is proven by a deliberate break.
- **The ledger and baselines only go down**, and are updated in the same commit as the move.

- Move code as it is. Don't hard-code any value, and don't change any CSS value, look or behaviour while modularizing.
- Never rebuild or redesign anything on your own. If something seems to need a rebuild or a behaviour change (including a "fix"), stop and ask me first, with the evidence. I take it to the owner.
- In P2, resolve conflicts by keeping release's look and behaviour exactly, and modular's structure. Anything that can't be both, ask me.

Keep existing source files at or below their pinned sizes and new files at 400 lines or fewer. At handoff list touched source sizes, include the move and mutation evidence, and confirm one-line comments and docstrings at most and no dead code, duplicate helpers or layered workarounds. Report the exact checked commit and lease release. Record discovered performance, accessibility and behavior issues for the post-P4 fix phase.
