# Editing a document in place: how other tools do it, and three options for XO

Research only, 19 Nov 2026. No product code was changed.

The owner's request (19 Nov, 08:57Z): today, editing a doc in XO means pressing Edit, landing in another mode, and pressing Save. They want it to work like Claude's canvas instead: the document sits beside the chat and you edit it in place, like a Word page, with headings, text, equations and graphs.

## 1. What XO does today (read from the code)

- **Opening a file.** A `.md` file opens rendered in the viewer (Preview). The renderer is `js/markdown.js`, the same one the chat uses. There's a Preview | Source switch in the head (`js/viewer.js:223`).
- **Edit.** Pressing Edit (or `E`) switches a document to **Source**, which is raw Markdown in Pierre's code editor (`js/viewer.js:341`). The head becomes `Edited · Cancel · Save ⌘S`. Cancel asks before discarding anything (`editActs`, `:269`).
- **Saving.** Save sends the whole file together with the version you started from. If the file changed in the meantime, the two versions are merged and any clashes wait in Pierre's merge view (`save`, `:381`). Unsaved text is kept as a draft in this browser (`js/drafts.js`). After a save you get a toast with Undo and Tell the agent.
- **Asking the agent.** In Source you can select lines and get **Ask about lines a–b** (`askCapsule`, `:707`). There's no way to ask from the rendered view.
- **When an agent edits the open file.** The head shows **Updated · Show**, and you choose when to take the new version (`:240`, `:891`).
- **Math, diagrams, charts.** None today. The chat-view thread (cmsg_bff772ae…) is vendoring KaTeX and Mermaid into `js/vendor/katex` and `js/vendor/mermaid`, and is wiring them into `msgx.js` / `app.js`.

**Why it feels heavy.** You read one thing (a formatted page) but edit another (raw Markdown on a different screen). Then three steps stand between you and a saved file: Edit, the switch to Source, and Save. Each tool below removes at least two of those three.

**What we already have that helps:**
- We own a line-based renderer (`renderMarkdown` walks the source line by line, `:303`), so each rendered block can carry the source line it came from.
- The editor can open at a given line (`ed.focus({ lineNumber })`, `:365`).
- Version-checked saving, the three-way merge and drafts already exist.

## 2. How the best tools do it

| Tool | View vs edit | Saving | AI edits next to yours | Math / charts / diagrams |
|---|---|---|---|---|
| **Claude: Docs / template artifacts** | No separate mode. You type straight into the doc. | Live; no Save button. Export to Word, PDF, Markdown or Google Docs. | Select text → **Edit with Claude** → type a request; Claude edits that spot. Asks made in chat also update the doc live. | Rich blocks: headings, tables, charts, diagrams. |
| **ChatGPT Canvas** | Opens beside the chat; you click in and type. | Autosaves. Back/forward arrows step through versions. | Select text → **Ask ChatGPT**: a targeted edit of the selection; with nothing selected it rewrites more. A shortcuts menu (suggest edits, length, reading level, polish). **Show changes** shows a diff. Suggestions appear as inline comments you accept or ignore. | Markdown-style rendering; code canvases for code. |
| **Notion** | Always editable; no modes. Blocks, a `/` menu and Markdown shortcuts. | Continuous autosave; page history. | Notion AI acts on a selection or a block. | `/equation` block (KaTeX) with a live preview as you type; inline math. Mermaid is a code block with a **Code / Preview / Split** switch. |
| **Obsidian** | Three views: **Live Preview** (the default: formatted, and the Markdown appears only on the line or span your caret is on), **Source**, and **Reading**. `⌘E` switches between them. | Autosave to the `.md` file. | Plugins only. | MathJax for `$…$` / `$$…$$`; Mermaid rendered in code blocks. Each shows its source when the caret enters it. Built on CodeMirror 6 *decorations*: the file stays plain Markdown and the formatting is drawn on top. |
| **Typora** | One surface. No preview pane and no mode switch. A block shows its source while the caret is in it and renders when you leave. | Autosave (optional). | None. | MathJax 4 math blocks, Mermaid 11, ` ```math ` fences. |
| **Google Docs** | Always editable. *Suggesting* mode records your changes as tracked changes. | "Saved to Drive", continuously; version history. | The Gemini side panel inserts or rewrites; you can review suggestions. | Equation editor and Sheets charts (not text-based). |
| **Linear docs / Craft** | Always editable rich text with Markdown shortcuts and a `/` menu. | Live, with presence from other editors. | Linear's AI writes into the doc. | Craft has a math block; Linear has code and Mermaid blocks. |
| **GitHub (for contrast)** | **Write / Preview tabs.** | Explicit commit. | None. | Math and Mermaid in Preview only. |

What they have in common:

1. **No Edit button.** You click where you're reading and type there. Only GitHub, the developer-tool outlier, still has a separate write mode, and that's the pattern XO has today.
2. **No Save button.** Every one of them saves continuously. Safety comes from history (undo, versions, a diff of changes) rather than from a confirm step.
3. **Rich blocks show their source only while you're in them.** Math and diagrams render as soon as the caret leaves. Notion and Typora show a small source box with a live preview right under it.
4. **AI edits are aimed by a selection.** Select text, then *Edit with Claude* / *Ask ChatGPT*. The changes land in the doc, where you can see them (ChatGPT's Show changes, Docs' suggestions).
5. **Files vs documents.** Obsidian and Typora keep a plain `.md` file byte-for-byte. Notion, Docs, Craft and Claude Docs keep their own rich format. For XO this matters most, because the agents write these same `.md` files with git.

## 3. Options for XO, ranked

### Option 1 (recommended; part of it can ship today): edit on the page, saved as you go

**What you see.** The Markdown file opens as a page: centred, at a comfortable line length (~720 px), with document typography (headings, lists, tables, code). Equations, Mermaid diagrams and charts render using the chat thread's KaTeX and Mermaid. There's no Edit button for documents.

**How editing feels.**
- **Getting in.** Click any paragraph, heading, list, table or block (double-click, or `E` with a block in focus, for keyboard users). That one block turns into its Markdown, in place, in a soft rounded box. Everything else stays rendered. This is Typora's and Notion's model.
- **Math and diagrams.** For an equation or a Mermaid diagram, the source box sits above a live preview of it that updates as you type. This is Notion's equation block and Mermaid "Split".
- **Getting out.** Click elsewhere, press `Esc`, or `Tab` to the next block. The block renders again.
- **Saving.** Each change saves itself after a short pause (~1 s) and when you leave the block. A quiet *Saved* sits in the head; there's no Save or Cancel. `⌘Z` undoes, and Undo stays in the head for a while after a save.
- **Whole-file editing.** Source mode stays for that, and it saves the same way.
- **Files that run code** (CI configs, hooks) keep the "Save anyway?" question and keep explicit Save. This is about documents only.

**When an agent changes the file while it's open.**
- If you're not typing, the page takes the new version in place, and the blocks that changed get a soft tint for a few seconds. That's ChatGPT's "show changes", made quiet.
- If you're in a block, today's merge runs and your text wins wherever only you touched it.

**What it reuses.**
- `renderMarkdown`, with one addition: each block carries its source line range (for example `data-l="12-18"`). The renderer already walks the source line by line.
- The version-checked `saveProjectFile`, the merge, drafts, `saveOutcome` wording, and the Updated detection.
- The chat thread's KaTeX and Mermaid. Coordination point: they should land in **`js/markdown.js`** (or a post-render hook it exports), not only in `msgx.js`, so the viewer gets them for free.
- For the block editor: an auto-growing `<textarea>`, which is cheap and robust, or a small Pierre editor instance.

**Size.** About 1 to 1.5 days for the whole option.

**Fits today** (about half a day of work, plus the chat thread's renderer):
1. Typography for the page view of documents.
2. Line ranges on rendered blocks, and click-a-block → edit that block in place → splice it back into the file.
3. Autosave with a quiet *Saved* and Undo, replacing Edit / Cancel / Save for `.md`. The runs-code files are unchanged.

**Comes later:**
- The live preview under math and Mermaid blocks.
- Taking agent changes in automatically with the tint (until then, **Updated · Show** stays).
- **Ask about this** on a selection in the rendered page. This is the Canvas / Claude "Edit with Claude" move: map the selection to its source lines through `data-l` and reuse the existing Ask capsule and composer.

**Limits.**
- An edit can't span several blocks at once. You'd use Source for that, which is how Notion behaves too.
- Very long tables edit as one block of Markdown.

### Option 2 (where it could go next): one continuous live page (Obsidian Live Preview)

**What you see.** A single editable page that looks rendered everywhere. The Markdown marks (`##`, `**`, `$`) appear only on the line your caret is in. Math and diagrams are widgets that open to their source when the caret enters them. There are no blocks to step between, and selecting across paragraphs works. It's the closest to "a Word page" that a plain `.md` file can get.

**Editing and saving.** As in Option 1: autosave, undo and history, and the same merge on agent edits. The file stays byte-exact Markdown, so agents, git and diffs are unaffected.

**What it reuses.** Everything from Option 1 except the block editor. It needs **CodeMirror 6** with `@codemirror/lang-markdown` and decoration widgets (about 75 KB gzipped for the core, plus the Markdown language support), vendored the way Pierre is. That would make it a second editor beside Pierre's: Pierre stays for code and diffs, CM6 handles documents. Open-source starting points exist (Ixora, other CM6 live-preview packs, HyperMD's approach).

**Size.** 3 to 5 days to feel right. Tables and nested lists are the slow part; Obsidian took years to polish them.

**Today.** No.

### Option 3 (only if XO docs stop being plain files): a true rich-text document (Word / Claude Docs)

**What you see.** A word-processor page: a formatting toolbar (H1/H2, bold, lists, link), a `/` menu to insert an equation, chart, diagram or table, drag handles on blocks, and comments. Built on ProseMirror (Milkdown Crepe or Tiptap).

**Editing and saving.** Always editable and autosaved, with the best feel of the three.

**The catch.**
- Markdown goes through a round trip: parse to a rich tree, then write back out. Opening and saving reformats the file (list markers, line breaks, table spacing). The diffs become noisy, and agents and the editor keep rewriting each other's formatting.
- Crepe pulls in Vue, so it's heavy.
- When an agent edits the file mid-typing, you need tree-level reconciliation, not text merges.

This model fits a document XO owns (like Claude Docs). It doesn't fit files in a repo that agents also write.

**Size.** 1 to 2 weeks for a polished version.

**Today.** No.

## 4. Recommendation

- **Ship Option 1's core today:** page typography; click a block to edit it in place; autosave with *Saved* and Undo; Edit / Cancel / Save gone for Markdown. It removes all three steps the owner named, keeps `.md` files byte-exact for the agents, and uses the save, merge and draft code already there.
- **Next:** "Ask about this" on a selection, and agent changes taken in with a tint.
- **If the owner still wants one seamless page after using it:** Option 2. Option 3 only if XO grows its own document type.

**Dependency for today:** the chat-view thread should expose KaTeX and Mermaid through `js/markdown.js`, so the viewer renders equations and diagrams with no second copy.

## Sources

- Claude: [What are artifacts and how do I use them?](https://support.claude.com/en/articles/17153992-what-are-artifacts-and-how-do-i-use-them) (direct editing of template docs, *Edit with Claude* on a selection, export); [Artifacts overview](https://claude.com/features/artifacts)
- ChatGPT: [Using canvas in ChatGPT](https://help.openai.com/en/articles/9930697-using-canvas-in-chatgpt); [Introducing canvas](https://openai.com/index/introducing-canvas/) (targeted edits on a selection, shortcuts, show changes, versions)
- Obsidian: [Edit and read](https://help.obsidian.md/edit-and-read) (Live Preview / Source / Reading, `⌘E`); [Editor decorations](https://docs.obsidian.md/Plugins/Editor/Decorations) (how Live Preview is built on CM6)
- Notion: [Advanced blocks (equation, Mermaid code / preview / split)](https://thomasjfrank.com/learn-notion/advanced-blocks/)
- Typora: [What's new 1.9 (math code blocks)](https://support.typora.io/What's-New-1.9/); [Typora 1.13: MathJax 4, Mermaid 11.12](https://alternativeto.net/news/2026/3/typora-1-13-brings-mathjax-4-mermaid-11-12-improved-search-performance-and-ui-updates)
- BlockNote: [Source with preview blocks](https://www.blocknotejs.org/docs/features/custom-schemas/source-with-preview) (the block-level pattern in Option 1)
- CodeMirror: [Bundling example: minimal setup ~75 KB gz](https://codemirror.net/examples/bundle/); [Ixora (CM6 Markdown live styling)](https://npmjs.com/package/@retronav/ixora)
- Milkdown: [@milkdown/crepe](https://cdn.jsdelivr.net/npm/@milkdown/crepe@7.21.2/README.md)
- Google Docs, Linear and Craft are described from their public product behaviour; I didn't re-check them against a page today.
