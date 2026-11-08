// node controls-md.cjs — CONTROLS.md from the crawler's inventories (inventory-<theme>-<width>.json) and the code:
// one row per kind of control, where it is, what it does, how it answers (hover, press, focus, size), the
// handler in the code, and its status. Statuses come from ../controls-status.json (rows Astra has graded, rows
// fixed and waiting); a row with no entry is "Unchecked".
const fs = require('fs'), path = require('path');
const DIR = path.join(__dirname, '..'), ROOT = path.join(DIR, '..', '..');
const inv = (f) => (fs.existsSync(path.join(DIR, f)) ? JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')) : null);
const desk = inv('inventory-dark-1440.json'), phone = inv('inventory-dark-390.json');
const status = fs.existsSync(path.join(DIR, 'controls-status.json')) ? JSON.parse(fs.readFileSync(path.join(DIR, 'controls-status.json'), 'utf8')) : {};

// values that name what a control does stay in its key; the rest (a project, a file, a row) are one kind
const KEEP = new Set(['data-mode', 'data-vw-mode', 'data-fl-rail', 'data-route', 'data-lp', 'data-shp-preset', 'data-to', 'data-fr-fold', 'data-ghost', 'data-stage-map']);
function key(x) {
  if (x.id) return '#' + x.id.replace(/-\d+$/, '-N');
  const parts = [];
  for (const a of x.data) {
    const [n, v = ''] = a.split(/=(.*)/s);
    if (n === 'data-w' || n === 'data-k' || n === 'data-fid' || n === 'data-fl-bytes' || n === 'data-file-name') continue;
    if (n === 'data-go') { parts.push(n + '=' + v.replace(/^(p|t|c):.*/, '$1:…')); continue; }
    parts.push(KEEP.has(n) && v ? `${n}=${v}` : n);
  }
  if (parts.length) return `${x.tag}[${[...new Set(parts)].sort().join(',')}]`;
  return `${x.tag}.${x.cls.split('.').filter((c) => !/^is-/.test(c)).slice(0, 2).join('.')}`;
}

// what each kind does, in the product's words (checked against the handler named in the row)
const DOES = [
  [/^#theme$/, 'Switches light and dark; the page cross-fades.'],
  [/^#nv-home$/, 'Home: what needs you, what was made; the label says how many need you.'],
  [/^#nv-ws$/, 'The Workspace coordinator\'s chat.'],
  [/^#nv-chats$/, 'Chats: one agent, one folder, without a project.'],
  [/^#nv-arts$/, 'Artifacts: everything agents made, across projects.'],
  [/^#side-add$/, 'New project: opens Create.'],
  [/^#pf-in$/, 'Filters the project list as you type; Esc clears.'],
  [/data-go=p:…/, 'Opens that project\'s page (its row says Working / Needs you).'],
  [/data-go=t:…/, 'Opens that thread.'],
  [/data-go=c:…/, 'Opens that chat.'],
  [/data-go=home/, 'Back to Home.'],
  [/^#nv-shells$/, 'Shells: the terminals in the dock.'],
  [/^#pb-menu$/, 'Phone: opens the sidebar as a drawer.'],
  [/^#set-side$|^#set-phone$/, 'Opens Settings.'],
  [/data-create/, 'Create XO Project: the create dialog.'],
  [/data-handled/, 'Folds open the threads that are handled or working, under the ones that need you.'],
  [/data-made-file/, 'Opens the file an agent made, beside the conversation.'],
  [/data-made-go/, 'Opens the thread that made it.'],
  [/^#say$/, 'Writes the message; Enter sends, Shift+Enter breaks a line, @ aims it at a project.'],
  [/^#attach$/, 'Add files: pick files to attach (or drop them on the conversation).'],
  [/^#target$/, 'Says who the message goes to; opens the list of places to send it.'],
  [/^#iq$/, 'Intelligence: the model and effort this conversation runs; opens the picker.'],
  [/^#send$|data-mode=send/, 'Sends the message (Stop while a run goes; the label says which).'],
  [/data-mode=stop/, 'Stops the run that\'s going.'],
  [/data-mode=empty/, 'Create: start with an empty folder.'],
  [/data-mode=clone/, 'Create: from a GitHub repository.'],
  [/^#cp-name$/, 'The new project\'s name; it becomes its folder.'],
  [/^#cp-desc$/, 'The project brief, one or two sentences.'],
  [/^#cp-cancel$/, 'Closes Create without making anything.'],
  [/^#cp-submit$/, 'Makes the project and opens it.'],
  [/^#jump-q$/, 'Jump: type a place or an action; arrows move, Enter goes.'],
  [/^#j-N$/, 'A Jump result: goes there (or does the action) on Enter or click.'],
  [/data-stage-toggle/, 'Opens or closes the panel: agents, map and changes.'],
  [/data-dmodel/, 'Picker: chooses that model (applied on Done or Enter; Esc cancels).'],
  [/data-deffort/, 'Picker: chooses how hard it thinks (Quick … Deepest).'],
  [/data-lmore/, 'Picker: shows the runtime and routing rows.'],
  [/data-lauto/, 'Picker: back to the default model.'],
  [/^#arts-q$/, 'Finds an artifact by name as you type.'],
  [/^#arts-pj$/, 'Artifacts from one project, or all.'],
  [/data-arts-kind/, 'Artifacts of one kind (documents, code, pictures …).'],
  [/data-switch/, 'Threads list: opens the other threads, with their count.'],
  [/data-lp-open/, 'Launchpad: deploy this project, or see its deploy.'],
  [/a\[data-thread\]/, 'Opens the thread a message names.'],
  [/stg-grip/, 'Drag to resize the panel; double-click resets; arrows step it.'],
  [/data-stg-full/, 'Panel full size, and back.'],
  [/data-stg-close/, 'Closes the panel; focus goes back to its button.'],
  [/data-fr-fold/, 'Folds that part of the panel to a bar.'],
  [/data-ghost/, 'Opens a folded part of the panel again.'],
  [/data-gut/, 'Drag to share the panel\'s height between two parts; arrows step it.'],
  [/data-lp=ask/, 'Launchpad: asks an agent to make the project deployable.'],
  [/data-lp=stop/, 'Launchpad: stops the deploy after 3 s (Undo); says stopped only once Space confirms.'],
  [/data-lp=/, 'Launchpad: the step it names.'],
  [/data-open-files/, 'Opens Files: the project\'s whole tree beside the conversation.'],
  [/^#stage-map-tree$/, 'Map as a diagram.'],
  [/^#stage-map-graph$/, 'Map as a graph.'],
  [/data-dg/, 'The map: drag to move around, Ctrl/Cmd+scroll zooms.'],
  [/data-chat-fold/, 'Beside a file: folds the chat away (and back).'],
  [/mx-down/, 'Back to the latest message, when you\'ve scrolled up.'],
  [/data-fv-min/, 'Minimises Files back to the chat.'],
  [/data-fl-q/, 'Finds a loaded file by name.'],
  [/data-fl-new/, 'Makes a new file in that folder.'],
  [/data-fl-dir/, 'Opens or closes a folder in the tree.'],
  [/data-fl-file/, 'Opens that file in the viewer.'],
  [/fl-split/, 'Drag to resize the file tree.'],
  [/fv-cgrip/, 'Drag to resize the conversation beside Files.'],
  [/data-fv-tree/, 'Shows or folds the file tree.'],
  [/data-fl-rail=changes/, 'Files rail: what changed here.'],
  [/data-fl-rail=all/, 'Files rail: all files.'],
  [/data-fl-rail=find/, 'Files rail: find a file.'],
  [/data-vw-askfile/, 'Ask about this: puts the file in your message to the project, and the cursor in the box.'],
  [/data-vw-mode=preview/, 'Shows the document rendered.'],
  [/data-vw-mode=source/, 'Shows its source.'],
  [/data-vw-edit/, 'Edit: the file becomes editable in place.'],
  [/data-vw-more/, 'More: copy, download.'],
  [/data-vw-cancel/, 'Leaves editing; with edits, asks first (Keep editing is focused).'],
  [/data-vw-saveit/, 'Saves (Ctrl/Cmd+S); merges if the agent changed it meanwhile; never with a place still to choose.'],
  [/vw-body/, 'The file itself: scrolls; in Edit, the text you type in.'],
  [/^#at-N$/, 'Aims the message at that project (@).'],
  [/^#top-back$/, 'Back to the thread\'s project.'],
  [/data-resolve/, 'Marks the thread resolved: nothing more is owed.'],
  [/data-tmenu/, 'Thread menu: rename, label and more.'],
  [/data-ck/, 'Opens or folds the thread\'s checklist.'],
  [/data-tb/, 'Opens or folds a tool call\'s details.'],
  [/mx-work/, 'The working line: what the agent is doing now; opens its live steps.'],
  [/data-follow/, 'Changes: follows the newest change, or stops following.'],
  [/data-cx-open/, 'Opens the changed file in Files.'],
  [/data-cx/, 'Shows that change\'s diff.'],
  [/cx-pd/, 'The diff: scrolls; J/K move between changes.'],
  [/\.tb-cf|data-file/, 'Opens the file a tool touched.'],
  [/data-mx/, 'Opens the message in full.'],
  [/^#set-x$/, 'Closes Settings; focus goes back where it was.'],
  [/data-set/, 'Settings: shows that section.'],
  [/^#hops-tog$/, 'Shows how messages travel between coordinators, on the timeline.'],
  [/^#webpics-tog$/, 'Shows pictures from the web in messages.'],
  [/data-shp-preset/, 'Shape: what XO shows, from a preset.'],
  [/data-shp-reset/, 'Shape: back to the preset as it comes.'],
  [/data-shp-all/, 'Shape: show everything.'],
  [/data-shp-dense/, 'Compact or comfortable, on this device.'],
  [/summary\./, 'Opens or folds the section under it.'],
  [/data-shp-json/, 'Shape as JSON, for editing by hand.'],
  [/data-route=agent/, 'Routing: the coordinator reads each message and decides.'],
  [/data-route=decision/, 'Routing: a decision model routes messages.'],
  [/data-route=off/, 'Routing off: messages stay where you send them.'],
  [/data-dm-on/, 'Connects that decision model.'],
  [/data-rtd-default/, 'The default runtime for new work.'],
  [/data-rtd-allowed/, 'Allows or stops that runtime here.'],
  [/data-rule-off/, 'Revokes that standing permission.'],
  [/^#sound-tog$/, 'Soft sounds on or off.'],
  [/data-rebind/, 'Rebinds that shortcut: press the new keys.'],
  [/^a\.$/, 'A link out (opens in a new tab).'],
  // reached only in other states (errors, confirmations, other kinds of item): from their handlers
  [/data-limit/, 'A usage limit: carry on paid, wait, or switch, as the button says.'],
  [/data-older/, 'Loads older messages again after a failed read.'],
  [/data-rec-undo/, 'Undoes a record change (a resolve, a pin) within its window.'],
  [/data-dock-open/, 'Opens the dock (shells) it names.'],
  [/data-fv-restore/, 'Brings minimised Files back.'],
  [/data-fv-close/, 'Closes Files.'],
  [/data-crail/, 'Beside a file: unfolds the folded chat.'],
  [/data-tedit/, 'Thread menu: the title being renamed; Enter keeps, Esc cancels.'],
  [/data-tfield/, 'Thread menu: rename or label the thread.'],
  [/data-shell/, 'Opens a shell in the thread\'s worktree.'],
  [/data-tmove/, 'Continues the thread on another runtime (the move flow).'],
  [/data-fold/, 'Folds the docked decision away to read the thread first.'],
  [/data-unfold/, 'Unfolds the docked decision.'],
  [/data-dock-undo/, 'Undoes the decision just made in the dock (3 s).'],
  [/data-herald-undo/, 'Undo in a notice, within its window.'],
  [/data-a(\]|,)/, 'A notice\'s own action (Open, Retry …).'],
  [/data-ref(\]|,)/, 'Opens a file (and its lines) a message refers to.'],
  [/data-lref-x/, 'Takes the file (or lines) out of the message you\'re writing.'],
  [/data-set-open/, 'Opens Settings at that section.'],
  [/data-af/, 'Artifacts filter in the All list.'],
  [/data-all-done/, 'Marks every listed thread done.'],
  [/data-kreset/, 'Resets that shortcut to its default.'],
  [/^#keys-reset-all$/, 'Resets every shortcut to its default.'],
  [/data-ar-undo/, 'Undoes resolving a thread from the All list.'],
  [/data-nx-opt/, 'Home\'s next move: answers with that option.'],
  [/data-decide/, 'Home\'s next move: opens the decision in full.'],
  [/data-nx-back/, 'Home\'s next move: send back, with a note.'],
  [/data-nx-allow/, 'Home\'s next move: Allow (after its 300 ms).'],
  [/data-later/, 'Puts the decision off until later today.'],
  [/^#nx-note-in$/, 'Home\'s next move: the note sent back with it.'],
  [/data-nx-send/, 'Sends the note back.'],
  [/data-nx-cancel/, 'Cancels the note.'],
  [/data-open-all/, 'Opens the decisions panel at the next one.'],
  [/data-glances/, 'Opens only the quick (glance) decisions.'],
  [/data-bring(\]|,)/, 'Brings the put-off decisions back into today\'s list.'],
  [/data-bring-in/, 'Brings one put-off decision in now.'],
  [/data-interrupt/, 'Interrupts the run (it stops at its next step).'],
  [/data-unfreeze/, 'Picks a frozen thread back up.'],
  [/data-retry(\]|,)/, 'Sends a failed message again.'],
  [/data-edit(\]|,)/, 'Puts a failed message back in the box to edit.'],
  [/data-cx-all/, 'Changes: shows every changed file.'],
  [/data-cx-show/, 'Changes: shows the change the pill names.'],
  [/data-chat-retry/, 'Chats: sends a failed message again.'],
  [/data-chat-edit/, 'Chats: puts a failed message back to edit.'],
  [/data-chat-stop/, 'Chats: stops the turn.'],
  [/data-csmode/, 'Chats: send now, or add to the turn.'],
  [/data-cs-done/, 'Chats: closes the send-mode question.'],
  [/data-chc/, 'Chats: adds to the running turn instead.'],
  [/data-cp(\]|,)/, 'Create: the step it names (connect GitHub, pick a repo …).'],
  [/data-act/, 'Decision card: Allow, Send back, Try again, Done, Later, Open the thread (each after the 300 ms re-arm).'],
  [/data-opt/, 'Decision card: answers with that option (after the re-arm).'],
  [/data-iopt/, 'Decision card: answers a question with that option.'],
  [/data-qid/, 'Decision card: one question\'s answer field.'],
  [/data-name/, 'A form field (its name is the answer\'s key).'],
  [/data-iscope/, 'Decision card: how wide Allow teaches the rule.'],
  [/data-scope/, 'Decision card: teach exactly this command, or its kind.'],
  [/data-vig/, 'Decisions: take a break, or keep going (after a long run of them).'],
  [/data-nav/, 'Decisions: previous / next card.'],
  [/data-all(\]|,)/, 'Decisions: allow all the routine ones (asks to confirm).'],
  [/data-cf/, 'Decisions: confirms Allow all.'],
  [/data-fl-retry/, 'Files: reads the folder again.'],
  [/data-fl-unpick/, 'Files: leaves the picked change.'],
  [/data-fl-change/, 'Files: opens a changed file at its change.'],
  [/data-fl-touch/, 'Files: opens a file an agent touched.'],
  [/data-fl-pick/, 'Files: picks that change to follow.'],
  [/data-fl-back/, 'Files: back from the file to the tree.'],
  [/data-fl-mk/, 'Files: new file in this folder.'],
  [/data-fl-cp/, 'Files: copies the path.'],
  [/data-fl-name/, 'Files: the new file\'s name; Enter makes it, Esc cancels.'],
  [/data-fv-back/, 'Files: back.'],
  [/data-lrt/, 'Picker: chooses the runtime.'],
  [/data-lsimple/, 'Picker: back to the simple view (Auto).'],
  [/data-lfull/, 'Picker: more options.'],
  [/data-mv-cancel/, 'Picker: cancels moving the thread to another runtime.'],
  [/data-mv-go/, 'Picker: moves the thread to that runtime.'],
  [/data-ldone/, 'Picker: Done applies the choice.'],
  [/data-lroute/, 'Picker: how messages here are routed.'],
  [/data-lp-env/, 'Launchpad: an environment value (secret ones are never kept).'],
  [/data-lp-f/, 'Launchpad: a deploy setting (name, port, size, disk).'],
  [/data-lbx/, 'Picture viewer: previous / next / zoom / close, as it says.'],
  [/data-map-toggle/, 'Opens or closes the map.'],
  [/data-node/, 'Map: selects that agent or thread.'],
  [/data-mp-go/, 'Map: opens what the node is.'],
  [/data-mp-focus/, 'Map: centres on that node.'],
  [/data-mp-full/, 'Map: full size, and back.'],
  [/data-mp-close/, 'Map: closes it.'],
  [/data-stage(\]|,)/, 'Map: opens it in the panel.'],
  [/data-copy/, 'Copies the code block.'],
  [/data-mx-reply/, 'Replies to that message (quotes it in the box).'],
  [/data-mx-copy/, 'Copies the message.'],
  [/data-rec-got/, 'Since you were away: got it, the line goes.'],
  [/data-rec-more/, 'Shows more of what was made.'],
  [/data-made-open/, 'Opens the made file.'],
  [/data-made-pin/, 'Pins the made file on top (or unpins).'],
  [/^#made-q$/, 'Finds a made file by name.'],
  [/data-made-kind/, 'Made files of one kind.'],
  [/data-rtd-fallback/, 'Runtimes: what happens when the default can\'t run.'],
  [/data-rtd-pref/, 'Runtimes: a preference, typed.'],
  [/data-runs-back/, 'Runs: back to the list.'],
  [/data-runs-stop/, 'Runs: stops all of them (asks first).'],
  [/data-run-stop/, 'Runs: stops that run.'],
  [/data-runs/, 'Opens the runs this thread has going.'],
  [/data-run-call/, 'Opens a run\'s call in full.'],
  [/data-run(\]|,)/, 'Opens that run.'],
  [/data-close/, 'Closes it.'],
  [/data-rule-no/, 'Keeps the permission (cancels Revoke).'],
  [/data-rule-yes/, 'Revokes the permission.'],
  [/data-wt-no/, 'Keeps the worktree.'],
  [/data-wt-hold/, 'Hold to remove the worktree (it can\'t be undone).'],
  [/data-wt-yes/, 'Removes the worktree.'],
  [/data-wt(\]|,)/, 'Asks to remove that worktree.'],
  [/data-dm-off/, 'Asks to disconnect the decision model.'],
  [/data-dm-cancel/, 'Cancels connecting it.'],
  [/data-dm-no/, 'Keeps it connected.'],
  [/data-dm-yes/, 'Disconnects it.'],
  [/data-ov-clear/, 'Uses the Space\'s setting instead of this project\'s.'],
  [/data-shp-revert/, 'Shape JSON: back to what was saved.'],
  [/data-shp-save/, 'Shape JSON: saves it.'],
  [/data-shf-close/, 'Shape: closes the first-run question (shows everything).'],
  [/data-shf(\]|,)/, 'Shape: what you\'ll use XO for, on first run.'],
  [/data-shp-keep/, 'Shape: keeps yours when another device changed it.'],
  [/data-shp-switch/, 'Shape: switches to the other device\'s.'],
  [/data-change/, 'Panel: opens that change.'],
  [/data-rail/, 'Panel rail: opens that part.'],
  [/data-map-mode/, 'Map: diagram or graph.'],
  [/data-vw-copy-path/, 'Copies the file\'s path.'],
  [/data-vw-copy/, 'Copies the file.'],
  [/data-vw-download/, 'Downloads the file.'],
  [/data-vw-show/, 'The file, or its changes.'],
  [/data-vw-split/, 'The file and its changes side by side.'],
  [/data-vw-draftx/, 'Discards the draft you left.'],
  [/data-vw-update/, 'Updated · Show: reads the newer file in, keeping your place.'],
  [/data-vw-close/, 'Closes the file; focus goes back where it came from.'],
  [/data-vw-keep/, 'Keep editing: back to the text, the caret where it was.'],
  [/data-vw-discard/, 'Discards your edits; focus to Edit.'],
  [/data-vw-noconfirm/, 'Cancels saving a file that runs code.'],
  [/data-vw-confirm/, 'Saves a file that runs code, having said what that means.'],
  [/data-vw-undo/, 'Undoes the save; focus to Edit, whether it went or not.'],
  [/data-vw-tell/, 'Tells the agent you edited it, so it reads it again.'],
  [/data-vw-toastx/, 'Closes the Saved notice.'],
  [/data-vw-retry/, 'Reads the file again.'],
];
const doesOf = (k) => (DOES.find(([re]) => re.test(k)) || [null, ''])[1];
// my read of a "no" that is the design, checked by hand (Astra grades it all the same)
const NOTES = [
  [/^#(pf-in|cp-name|cp-desc|arts-q|say|jump-q)$|data-fl-q/, 'A text field: no hover by design; focus shows on its box (Jump\'s field is the dialog\'s only control, always focused).'],
  [/data-dmodel|data-deffort|data-lmore|data-lauto/, 'Focus moves by Tab and the arrows inside the picker (a roving ring, checked: rows → effort → more → rows); the crawler\'s direct focus() came after its press had re-drawn the picker.'],
  [/data-route=decision/, 'Disabled until its model is connected: no hover or press by design.'],
  [/data-shp-reset/, 'Disabled at the preset as it comes.'],
  [/#stage-map-tree|data-vw-mode=preview|data-mode=empty/, 'The selected segment: it doesn\'t answer hover; the other one does.'],
  [/data-dg\]|vw-body|cx-pd/, 'A region you scroll or drag, not a button: no hover by design; the keyboard ring shows when you Tab into it.'],
  [/data-rtd-allowed/, 'The box sits in a 34 px chip (its label) that answers hover and shows the ring; the 13 px box itself is not the target.'],
];
const noteOf = (k) => (NOTES.find(([re]) => re.test(k)) || [null, ''])[1];

// the handler: the first line in js/ that reaches this kind from an event (closest/matches/getElementById)
const JS = fs.readdirSync(path.join(ROOT, 'js')).filter((f) => f.endsWith('.js')).map((f) => [f, fs.readFileSync(path.join(ROOT, 'js', f), 'utf8').split('\n')]);
function handler(k) {
  let needles = [];
  const id = /^#([\w-]+)$/.exec(k);
  if (id) { const base = id[1].replace(/-N$/, '-'); needles = [`"#${base}`, `getElementById("${base}`, `$("#${base}`, `#${base}"`]; }
  else { const m = /\[([^\]]+)\]/.exec(k); if (m) needles = m[1].split(',').map((a) => `[${a.split('=')[0]}`); else needles = ['.' + k.split('.')[1]]; }
  for (const [f, lines] of JS) for (let i = 0; i < lines.length; i++) {
    const L = lines[i];
    if (!/closest|matches|addEventListener|getElementById|\$\(/.test(L) || /innerHTML|insertAdjacentHTML|`<|querySelectorAll\(`/.test(L)) continue;
    if (needles.some((n) => L.includes(n))) return `js/${f}:${i + 1}`;
  }
  return '';
}

const groups = new Map();
for (const [src, data] of [['desk', desk], ['phone', phone]]) {
  if (!data) continue;
  for (const x of data.controls) {
    const k = key(x);
    if (!groups.has(k)) groups.set(k, { k, first: x, states: new Set(), n: 0, desk: [], phone: [] });
    const g = groups.get(k);
    g.states.add(x.state); g.n++; g[src].push(x);
  }
}
const yes = (v) => (v === true ? 'yes' : v === false ? '**no**' : '–');
const sizeOf = (xs) => { if (!xs.length) return '–'; const hs = [...new Set(xs.map((x) => x.h))].sort((a, b) => a - b); const ws = xs.map((x) => x.w); return `${Math.min(...ws)}–${Math.max(...ws)} × ${hs.length > 3 ? hs[0] + '–' + hs.at(-1) : hs.join('/')}`.replace(/^(\d+)–\1 /, '$1 '); };
const any = (xs, f) => (xs.some((x) => x[f] === true) ? true : xs.some((x) => x[f] === false) ? false : null);
// where a kind lives: the region it shows in, named as a person would
const REG = { '#side': 'Sidebar', '#composer': 'Composer', '#stage': 'Panel', '#viewer': 'File viewer', '#settings': 'Settings', '#jump': 'Jump (Ctrl/Cmd+K)', '#iq-pop': 'Intelligence picker', '#create-dlg': 'Create', '#msgs': 'Conversation', '#thead': 'Thread head', '#home': 'Home', '#arts': 'Artifacts', page: 'Page', '#herald': 'Notices' };
const areaOf = (g) => REG[g.first.region] || g.first.region;
const ORDER = ['Sidebar', 'Home', 'Create', 'Jump (Ctrl/Cmd+K)', 'Page', 'Thread head', 'Conversation', 'Composer', 'Intelligence picker', 'Artifacts', 'Panel', 'File viewer', 'Settings'];
const byArea = new Map();
for (const g of groups.values()) { const a = areaOf(g); if (!byArea.has(a)) byArea.set(a, []); byArea.get(a).push(g); }
const areas = [...byArea.keys()].sort((a, b) => (ORDER.indexOf(a) + 1 || 99) - (ORDER.indexOf(b) + 1 || 99));

let n = 0;
const ids = new Map();
const rows = [];
for (const a of areas) for (const g of byArea.get(a)) { n++; ids.set(g.k, 'C' + String(n).padStart(3, '0')); }
const out = [];
out.push('# Every control, and how it answers', '');
out.push(`Built from the rendered app (tools/inventory.cjs crawls ${desk ? desk.states.length : 0} places at 1440 px${phone ? ` and ${phone.states.length} at 390 px` : ''}, read-only) and the code (tools/controls-md.cjs finds each control\'s handler). Regenerate: \`node tools/inventory.cjs dark 1440 && node tools/inventory.cjs dark 390 && node tools/controls-md.cjs\`.`, '');
out.push('One row per kind of control (every project row is one kind). **Hover**, **Press** and **Focus** say whether the control itself visibly changes when the pointer is over it, while it is pressed, and when the keyboard reaches it (`no` is a finding to check, not always a fault: a text field\'s ring can sit on its box). **Size** is width × height in CSS px. **Status** is graded by Astra, row by row; this file never marks a row passed on its own.', '');
const counts = { Unchecked: 0 };
for (const a of areas) {
  out.push(`## ${a}`, '', '| ID | Control | Does | Size | Hover | Press | Focus | Where it shows | Handler | Status |', '|---|---|---|---|---|---|---|---|---|---|');
  for (const g of byArea.get(a)) {
    const id = ids.get(g.k), xs = g.desk.length ? g.desk : g.phone;
    const st = status[id] || status[g.k] || 'Unchecked';
    counts[st.split(':')[0]] = (counts[st.split(':')[0]] || 0) + 1;
    const where = [...g.states].slice(0, 4).join(', ') + (g.states.size > 4 ? ` +${g.states.size - 4}` : '');
    const name = (g.first.name || '').replace(/\|/g, '/').slice(0, 48);
    out.push(`| ${id} | ${name}<br>\`${g.k.replace(/\|/g, '/')}\` | ${doesOf(g.k) || '**?**'}${noteOf(g.k) ? `<br>*${noteOf(g.k)}*` : ''} | ${sizeOf(g.desk)}${g.phone.length ? `<br>phone ${sizeOf(g.phone)}` : ''} | ${yes(any(g.desk, 'hover'))} | ${yes(any(g.desk, 'press'))} | ${yes(any(xs.filter((x) => x.gotFocus), 'ring'))}${xs.some((x) => x.focusable && x.gotFocus === false) && !xs.some((x) => x.gotFocus) ? ' (never took focus)' : ''} | ${where} | ${handler(g.k)} | ${st} |`);
  }
  out.push('');
}
// the flows Astra's fixtures drive (G1–G8 and after): rows of their own
out.push('## Flows (timing, focus, truth)', '', '| ID | Flow | Does | Locked by | Status |', '|---|---|---|---|---|');
const FLOWS = [
  ['F-G1', 'A decision\'s first 300 ms; a held key', 'Every Allow / Try again / Done / option / answer waits out the re-arm; a key repeat never decides', 'tests/browser/flows.test.cjs G1 (4 cases)'],
  ['F-G2', 'A card withdrawn while you type on it', 'The next card starts with its letter keys paused and says why', 'flows.test.cjs G2'],
  ['F-G3', 'Save with a place still to choose', 'Neither Ctrl/Cmd+S nor the button saves; markers never reach the file', 'flows.test.cjs G3 ×2 widths'],
  ['F-G4', 'A late save after opening another file', 'It lands only on its own file; the other file keeps its text and toolbar', 'flows.test.cjs G4 ×2'],
  ['F-G4b', 'Typing while a save is out', 'What was there at Save is saved; what you typed since stays, unsaved, against the new version', 'flows.test.cjs "Save while typing" ×2'],
  ['F-G5', 'A hop receipt racing the history read', 'A newer state is never overwritten by an older read; an early receipt is held', 'flows.test.cjs G5 ×2 ×2; tests/storm.test.mjs hops'],
  ['F-G6', 'Launchpad Stop', 'Stopped only on {stopped:true} or the stream\'s cancelled; refused or unconfirmed: says so, Stop again; the stream\'s end wins', 'flows.test.cjs G6 (3 cases) ×2'],
  ['F-G7', 'Focus after an editor outcome', 'Edit after a save or discard; Save through Saving… and a failure; Keep editing for Cancel\'s question; Edit after Undo, failed or not', 'flows.test.cjs G7 ×2 ×2'],
  ['F-G8', 'The file capsule\'s ×', 'Named for the file; a line range keeps its line words', 'flows.test.cjs G8 ×2'],
];
for (const [id, f, d, l] of FLOWS) out.push(`| ${id} | ${f} | ${d} | ${l} | ${status[id] || 'Failing until Astra passes it'} |`);
// the controls the code can draw that the crawl didn't reach (an error, an empty state, a dialog it didn't open):
// every <button>/<a>/<input>… in a template, by its hook, that no rendered kind has
const seenAttrs = new Set([...groups.keys()].flatMap((k) => (/\[([^\]]+)\]/.exec(k)?.[1] || '').split(',').map((a) => a.split('=')[0])).concat([...groups.keys()].filter((k) => k.startsWith('#')).map((k) => k.replace(/-N$/, ''))));
const SKIP = new Set(['data-w', 'data-k', 'data-fid', 'data-i', 'data-v', 'data-id', 'data-key', 'data-tip', 'data-file-name', 'data-fl-bytes', 'data-ref-a', 'data-ref-b']);
const unseen = new Map();
for (const [f, lines] of JS) lines.forEach((L, i) => {
  for (const m of L.matchAll(/<(button|a|input|textarea|select|summary)\b([^>]*)>/g)) {
    const attrs = [...m[2].matchAll(/\b(data-[\w-]+)/g)].map((x) => x[1]).filter((a) => !SKIP.has(a));
    const id = /\bid="([\w-]+)"/.exec(m[2]);
    const hook = attrs[0] || (id && '#' + id[1]);
    if (!hook || seenAttrs.has(hook) || /\$\{/.test(hook)) continue;
    if (!unseen.has(hook)) unseen.set(hook, { tag: m[1], at: `js/${f}:${i + 1}`, n: 0, text: (/>([^<]{2,40})</.exec(L.slice(m.index)) || [])[1] || '' });
    unseen.get(hook).n++;
  }
});
out.push('## In the code, not reached by the crawl', '', 'Controls the templates can draw that none of the crawled places showed (states like errors, empty lists, confirmations, other kinds of item). Each still needs its row checked in the state that shows it.', '', '| ID | Hook | Tag | First drawn at | Example text | Does | Status |', '|---|---|---|---|---|---|---|');
let u = 0;
for (const [h, v] of [...unseen.entries()].sort((a, b) => a[1].at.localeCompare(b[1].at))) {
  u++;
  const id = 'S' + String(u).padStart(3, '0');
  out.push(`| ${id} | \`${h}\` | ${v.tag} | ${v.at} | ${v.text.replace(/\|/g, '/').replace(/\$\{[^}]*\}/g, '…').trim()} | ${doesOf(`${v.tag}[${h}]`) || doesOf(h) || '**?**'} | ${status[id] || 'Unchecked'} |`);
}
out.push('', `**${n} kinds of control** rendered (${[...groups.values()].reduce((s, g) => s + g.n, 0)} instances seen), and **${u} more kinds** in the code that the crawl didn't reach.`, '');
fs.writeFileSync(path.join(DIR, 'CONTROLS.md'), out.join('\n'));
const missing = [...groups.keys()].filter((k) => !doesOf(k));
console.log('kinds', n, 'without words', missing.length, missing.slice(0, 30));
