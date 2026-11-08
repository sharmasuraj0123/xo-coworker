// node controls-md.cjs — CONTROLS.md from the crawler's inventories (inventory-<theme>-<width>.json) and the code.
// One row per kind of control: where it is, what it does, how it answers (hover, press, focus, size), a pointer to
// its handler, and its status.
// - Row IDs come from controls-ids.json, a committed registry from each kind's canonical key to its ID. IDs are only
//   ever appended: a new kind gets the next number, and a kind seen again (rendered or only in the code) keeps its
//   ID whatever order the crawl meets it in. A code-only kind that becomes rendered keeps its S-ID.
// - Statuses come from controls-status.json (Astra's grades); a row without one is "Unchecked". Nothing here marks
//   a row passed.
// - The summary's counts are counted from the rows written, not estimated.
const fs = require('fs'), path = require('path');
const DIR = path.join(__dirname, '..'), ROOT = path.join(DIR, '..', '..');
const readJson = (f, d = null) => (fs.existsSync(path.join(DIR, f)) ? JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')) : d);
const desk = readJson('inventory-dark-1440.json'), phone = readJson('inventory-dark-390.json');
const status = readJson('controls-status.json', {});
const REG_FILE = path.join(DIR, 'controls-ids.json');
const reg = readJson('controls-ids.json', { note: 'Canonical key → row ID. Append-only: never renumber, never reuse.', next: { C: 1, S: 1 }, ids: {} });

// ── one canonical key for a kind, the same whether it was rendered or read from a template ──
// values that name what a control does stay in its key; the rest (a project, a file, a row's id) make one kind
const KEEP = new Set(['data-mode', 'data-vw-mode', 'data-fl-rail', 'data-route', 'data-lp', 'data-shp-preset', 'data-to', 'data-fr-fold', 'data-ghost', 'data-map-mode', 'data-act', 'data-vig', 'data-dg', 'data-lbx', 'data-cp', 'data-csmode']);
const SKIP = new Set(['data-w', 'data-k', 'data-fid', 'data-fl-bytes', 'data-file-name', 'data-i', 'data-v', 'data-id', 'data-key', 'data-tip', 'data-ref-a', 'data-ref-b', 'data-inv', 'data-inv-now', 'data-lid', 'data-n', 'data-pid', 'data-change-project', 'data-limit-d']);
function canon(tag, id, attrs, cls) {
  if (id) return '#' + id.replace(/-\d+$/, '-N');
  const parts = [];
  for (const [n, v] of attrs) {
    if (SKIP.has(n)) continue;
    if (n === 'data-go') { parts.push(n + '=' + String(v).replace(/^(p|t|c):.*/, '$1:…')); continue; }
    parts.push(KEEP.has(n) && v && !/\$\{/.test(v) ? `${n}=${v}` : n);
  }
  if (parts.length) return `${tag}[${[...new Set(parts)].sort().join(',')}]`;
  return `${tag}.${(cls || '').split(/[.\s]/).filter((c) => c && !/^is-/.test(c)).slice(0, 2).join('.')}`;
}
const renderedKey = (x) => canon(x.tag, x.id, x.data.map((a) => { const i = a.indexOf('='); return i < 0 ? [a, ''] : [a.slice(0, i), a.slice(i + 1)]; }), x.cls);
const tokensOf = (k) => { if (k.startsWith('#')) return [k]; const m = /\[([^\]]+)\]/.exec(k); return m ? m[1].split(',') : [k]; };

// ── IDs: the registry, seeded once from the list as committed in 3a9cdca (so grades given there stay on their rows) ──
function seedFrom3a9cdca() {
  const md = path.join('/tmp', 'controls-3a9cdca.md');
  if (Object.keys(reg.ids).length || !fs.existsSync(md)) return;
  const legacy = {};
  for (const l of fs.readFileSync(md, 'utf8').split('\n')) {
    let m = /^\| (C\d+) \| .*?<br>`([^`]+)`/.exec(l); if (m) { legacy[m[1]] = { kind: 'C', key: m[2] }; continue; }
    m = /^\| (S\d+) \| `([^`]+)` \| (\w+) \|/.exec(l); if (m) legacy[m[1]] = { kind: 'S', key: m[2].startsWith('#') ? m[2] : `${m[3]}[${m[2]}]` };
  }
  reg.legacy = legacy; // the 3a9cdca keys, kept as aliases
  reg.next = { C: Math.max(0, ...Object.keys(legacy).filter((k) => k[0] === 'C').map((k) => +k.slice(1))) + 1, S: Math.max(0, ...Object.keys(legacy).filter((k) => k[0] === 'S').map((k) => +k.slice(1))) + 1 };
}
seedFrom3a9cdca();
// the 3a9cdca key function, for matching a kind to the ID it had there
function legacyKey(x) {
  if (x.id) return '#' + x.id.replace(/-\d+$/, '-N');
  const OLDKEEP = new Set(['data-mode', 'data-vw-mode', 'data-fl-rail', 'data-route', 'data-lp', 'data-shp-preset', 'data-to', 'data-fr-fold', 'data-ghost', 'data-stage-map']);
  const parts = [];
  for (const a of x.data) {
    const i = a.indexOf('='), n = i < 0 ? a : a.slice(0, i), v = i < 0 ? '' : a.slice(i + 1);
    if (['data-w', 'data-k', 'data-fid', 'data-fl-bytes', 'data-file-name'].includes(n)) continue;
    if (n === 'data-go') { parts.push(n + '=' + v.replace(/^(p|t|c):.*/, '$1:…')); continue; }
    parts.push(OLDKEEP.has(n) && v ? `${n}=${v}` : n);
  }
  if (parts.length) return `${x.tag}[${[...new Set(parts)].sort().join(',')}]`;
  return `${x.tag}.${x.cls.split('.').filter((c) => !/^is-/.test(c)).slice(0, 2).join('.')}`;
}
const byKey = new Map(Object.entries(reg.ids).map(([id, e]) => [e.key, id]));
for (const [id, e] of Object.entries(reg.ids)) for (const a of e.aliases || []) byKey.set(a, id);
function idFor(key, kind, legacyKeys = []) {
  if (byKey.has(key)) return byKey.get(key);
  // a kind that had an ID in 3a9cdca keeps it
  for (const lk of legacyKeys) for (const [lid, le] of Object.entries(reg.legacy || {})) if (le.key === lk && !reg.ids[lid]) { reg.ids[lid] = { key, aliases: [lk] }; byKey.set(key, lid); return lid; }
  for (const lk of legacyKeys) for (const [lid, le] of Object.entries(reg.legacy || {})) if (le.key === lk && reg.ids[lid]) { reg.ids[lid].aliases = [...new Set([...(reg.ids[lid].aliases || []), key])]; byKey.set(key, lid); return lid; }
  const id = kind + String(reg.next[kind]++).padStart(3, '0');
  reg.ids[id] = { key, aliases: [] };
  byKey.set(key, id);
  return id;
}

// ── what each kind does, by exact hook (attribute=value, attribute, or #id); each checked against its handler ──
const DOES = {
  '#theme': 'Switches light and dark.',
  '#nv-home': 'Home: what needs you and what was made; its label says how many need you.',
  '#nv-ws': 'The Workspace coordinator\'s chat.',
  '#nv-chats': 'Chats: one agent, one folder, without a project.',
  '#nv-arts': 'Artifacts: everything agents made, across projects.',
  '#side-add': 'New project: opens Create.',
  '#pf-in': 'Filters the project list as you type.',
  'data-go=p:…': 'Opens that project.',
  'data-go=t:…': 'Opens that thread.',
  'data-go=c:…': 'Opens that chat.',
  'data-go=home': 'Back to Home.',
  'data-go=ws': 'Opens the Workspace.',
  'data-go=chats': 'Opens Chats.',
  'data-go=artifacts': 'Opens Artifacts.',
  '#nv-shells': 'Shells: opens the dock\'s terminals.',
  '#set-side': 'Opens Settings.',
  '#set-phone': 'Phone: opens Settings.',
  '#pb-menu': 'Phone: opens the sidebar as a drawer.',
  '#top-menu': 'Phone: opens the sidebar as a drawer.',
  'data-create': 'Create XO Project: opens the create dialog.',
  'data-handled': 'Opens or folds the Handled section (threads handled or working).',
  'data-made-file': 'Opens the file an agent made, beside the conversation.',
  'data-made-go': 'Opens the thread that made it.',
  'data-made-pin': 'Pins the made file on top, or unpins it.',
  'data-made-open': 'Opens the Made panel.',
  '#made-q': 'Finds a made file by name.',
  'data-made-kind': 'Shows made files of one kind.',
  '#say': 'The message: Enter sends, Shift+Enter breaks a line, @ aims it at a project.',
  '#attach': 'Add files: picks files to attach.',
  '#target': 'Who the message goes to; opens the list of places to send it.',
  '#iq': 'Intelligence: the model and effort this conversation runs; opens the picker.',
  '#send': 'Sends the message; while a run goes it is Stop (its label says which).',
  'data-mode=send': 'Sends the message.',
  'data-mode=stop': 'Stops the run that\'s going.',
  'data-mode=empty': 'Create: start with an empty folder.',
  'data-mode=clone': 'Create: from a GitHub repository.',
  '#cp-name': 'The new project\'s name; it becomes its folder.',
  '#cp-desc': 'The project brief, one or two sentences.',
  '#cp-cancel': 'Closes Create without making anything.',
  '#cp-submit': 'Makes the project and opens it.',
  '#jump-q': 'Jump: type a place or an action; arrows move, Enter goes, Esc closes.',
  '#j-N': 'A Jump result: Enter or a click goes there (or does the action); the pointer selects it.',
  '#at-N': 'Aims the message at that project (@).',
  'data-stage-toggle': 'Opens or closes the panel: agents, map and changes.',
  'data-dmodel': 'Picker: that model (Done or Enter applies; Esc cancels).',
  'data-deffort': 'Picker: how hard it thinks (Quick … Deepest).',
  'data-lmore': 'Picker: shows or hides the runtime and routing rows.',
  'data-lauto': 'Picker: back to the default model.',
  'data-lrt': 'Picker: chooses the runtime.',
  'data-lsimple': 'Picker: back to the simple view.',
  'data-lfull': 'Picker: more options.',
  'data-mv-cancel': 'Picker: cancels moving the thread to another runtime.',
  'data-mv-go': 'Picker: moves the thread to that runtime.',
  'data-ldone': 'Picker: Done applies the choice.',
  'data-lroute': 'Picker: how messages here are routed.',
  '#arts-q': 'Finds an artifact by name as you type.',
  '#arts-pj': 'Shows artifacts from one project, or all.',
  'data-arts-kind': 'Shows artifacts of one kind.',
  'data-switch': 'Opens the All list of threads (or closes it).',
  'data-lp-open': 'Launchpad: opens the deploy section in the panel.',
  'data-thread': 'Opens the thread a message names.',
  'data-stg-full': 'Panel full size, and back.',
  'data-stg-close': 'Closes the panel; focus goes back to its button.',
  'data-fr-fold': 'Folds that part of the panel to a bar.',
  'data-ghost': 'Opens a folded part of the panel again.',
  'data-gut': 'Drag (or arrow keys) to share the panel\'s height between two parts.',
  'data-lp=ask': 'Launchpad: asks an agent to make the project deployable.',
  'data-lp=open': 'Launchpad: opens the app on Launchpad.',
  'data-lp=deploy': 'Launchpad: deploys (3 s to Undo first).',
  'data-lp=stop': 'Launchpad: stops the deploy after 3 s (Undo); says stopped only once Space confirms.',
  'data-lp=undo': 'Launchpad: undoes the deploy before it starts.',
  'data-lp=retry': 'Launchpad: deploys again.',
  'data-lp=again': 'Launchpad: deploys again with the same settings.',
  'data-lp=hide': 'Launchpad: hides the section; the deploy carries on.',
  'data-lp': 'Launchpad: the step its label names.',
  'data-open-files': 'Opens Files: the project\'s whole tree beside the conversation.',
  '#stage-map-tree': 'Map as a diagram.',
  '#stage-map-graph': 'Map as a graph.',
  'data-map-mode': 'Map: diagram or graph.',
  'data-dg': 'The map: drag to move around, Ctrl/Cmd+scroll zooms; its buttons switch the drawing and zoom.',
  'data-chat-fold': 'Beside a file: folds the chat away.',
  'data-fv-min': 'Minimises Files back to the chat.',
  'data-fv-restore': 'Brings minimised Files back.',
  'data-fv-close': 'Closes Files.',
  'data-fv-tree': 'Shows or folds the file tree.',
  'data-fv-back': 'Files: back.',
  'data-fl-q': 'Finds a loaded file by name.',
  'data-fl-new': 'Makes a new file in that folder.',
  'data-fl-dir': 'Opens or closes a folder in the tree.',
  'data-fl-file': 'Opens that file in the viewer.',
  'data-fl-rail=changes': 'Files rail: what changed here.',
  'data-fl-rail=all': 'Files rail: all files.',
  'data-fl-rail=find': 'Files rail: find a file.',
  'data-fl-retry': 'Files: reads the folder again.',
  'data-fl-unpick': 'Files: leaves the picked change and closes its file.',
  'data-fl-change': 'Files: opens a changed file.',
  'data-fl-touch': 'Files: opens a file an agent touched.',
  'data-fl-pick': 'Files: picks that change to follow.',
  'data-fl-back': 'Files: back from the file to the tree.',
  'data-fl-mk': 'Files menu: new file in this folder.',
  'data-fl-cp': 'Files menu: copies the path.',
  'data-fl-name': 'Files: the new file\'s name; Enter makes it, Esc cancels.',
  'data-vw-askfile': 'Ask about this: puts the file in your message to its project, and the cursor in the box.',
  'data-vw-mode=preview': 'Shows the document rendered.',
  'data-vw-mode=source': 'Shows its source.',
  'data-vw-edit': 'Edit: the file becomes editable in place.',
  'data-vw-more': 'More: copy, download.',
  'data-vw-cancel': 'Leaves editing; with edits, asks first (Keep editing is focused).',
  'data-vw-saveit': 'Saves (also Ctrl/Cmd+S); merges if the agent changed it meanwhile; never with a place still to choose.',
  'data-vw-copy-path': 'Copies the file\'s path.',
  'data-vw-copy': 'Copies the file.',
  'data-vw-download': 'Downloads the file.',
  'data-vw-show': 'Shows the file, or its changes.',
  'data-vw-split': 'The file and its changes side by side.',
  'data-vw-draftx': 'Discards the draft you left.',
  'data-vw-update': 'Updated · Show: reads the newer file in, keeping your place.',
  'data-vw-close': 'Closes the file; focus goes back where it came from.',
  'data-vw-keep': 'Keep editing: back to the text, the caret where it was.',
  'data-vw-discard': 'Discards your edits; focus goes to Edit.',
  'data-vw-noconfirm': 'Cancels saving a file that runs code.',
  'data-vw-confirm': 'Saves a file that runs code, having said what that means.',
  'data-vw-undo': 'Undoes the save; focus goes to Edit, whether it went or not.',
  'data-vw-tell': 'Tells the agent you edited it, so it reads it again.',
  'data-vw-toastx': 'Closes the Saved notice.',
  'data-vw-retry': 'Reads the file again.',
  '#top-back': 'Back to the thread\'s project.',
  'data-resolve': 'Marks the thread resolved (or open again).',
  'data-tmenu': 'Thread menu: rename, label and more.',
  'data-tedit': 'Thread menu: the title being renamed; Enter keeps, Esc cancels.',
  'data-tfield': 'Thread menu: rename or label the thread.',
  'data-shell': 'Opens a shell in the thread\'s worktree.',
  'data-tmove': 'Continues the thread on another runtime.',
  'data-ck': 'Opens or folds the thread\'s checklist.',
  'data-tb': 'Opens or folds a tool call\'s details.',
  'data-run': 'Opens that run.',
  'data-runs': 'The thread\'s sub-agent runs: opens their list.',
  'data-runs-back': 'Runs: back to the list.',
  'data-runs-stop': 'Runs: stops all of them (asks first).',
  'data-run-stop': 'Runs: stops that run.',
  'data-run-call': 'Opens a run\'s call in full.',
  'data-close': 'Closes the runs view.',
  'data-follow': 'Changes: follows the newest change, or stops following.',
  'data-cx-open': 'Opens the changed file in Files.',
  'data-cx': 'Shows that change\'s diff.',
  'data-cx-all': 'Changes: shows every changed file.',
  'data-cx-show': 'Changes: shows the change the pill names.',
  'data-change': 'Panel: opens that changed file in the viewer.',
  'data-rail': 'Panel rail: opens that part of the panel.',
  'data-file': 'Opens the file a tool touched.',
  'data-mx': 'Opens the picture or media in the viewer.',
  'data-mx-reply': 'Replies to that message (it shows above the box).',
  'data-mx-copy': 'Copies the message; says copied only once it is.',
  '#set-x': 'Closes Settings; focus goes back where it was.',
  'data-set': 'Settings: shows that section.',
  'data-set-open': 'Opens Settings at that section.',
  '#hops-tog': 'Shows how messages travel between coordinators, on the timeline.',
  '#webpics-tog': 'Shows pictures from the web in messages.',
  '#sound-tog': 'Soft sounds on or off.',
  'data-shp-preset': 'Shape: what XO shows, from that preset.',
  'data-shp-reset': 'Shape: back to the preset as it comes.',
  'data-shp-all': 'Shape: show everything.',
  'data-shp-dense': 'Compact or comfortable, on this device.',
  'data-shp-json': 'Shape as JSON, for editing by hand.',
  'data-shp-revert': 'Shape JSON: back to what was saved.',
  'data-shp-save': 'Shape JSON: saves it.',
  'data-shp-keep': 'Shape: keeps yours when another device changed it.',
  'data-shp-switch': 'Shape: switches to the other device\'s.',
  'data-shf-close': 'Shape, first run: closes the question (everything shows).',
  'data-shf': 'Shape, first run: what you\'ll use XO for.',
  'data-route=agent': 'Routing: the coordinator reads each message and decides.',
  'data-route=decision': 'Routing: a decision model routes messages.',
  'data-route=off': 'Routing off: messages stay where you send them.',
  'data-dm-on': 'Connects that decision model.',
  'data-dm-off': 'Asks to disconnect the decision model.',
  'data-dm-cancel': 'Cancels connecting it.',
  'data-dm-no': 'Keeps it connected.',
  'data-dm-yes': 'Disconnects it.',
  'data-ov-clear': 'Uses the Space\'s setting instead of this project\'s.',
  'data-rtd-default': 'The default runtime for new work.',
  'data-rtd-allowed': 'Allows or stops that runtime here.',
  'data-rtd-fallback': 'Runtimes: whether another runtime may take over when the default can\'t run.',
  'data-rtd-pref': 'Runtimes: a preference, typed.',
  'data-rule-off': 'Asks to revoke that standing permission.',
  'data-rule-no': 'Keeps the permission.',
  'data-rule-yes': 'Revokes the permission.',
  'data-wt': 'Asks to remove that worktree.',
  'data-wt-no': 'Keeps the worktree.',
  'data-wt-hold': 'Hold to remove the worktree (it can\'t be undone).',
  'data-wt-yes': 'Removes the worktree.',
  'data-rebind': 'Rebinds that shortcut: press the new keys.',
  'data-kreset': 'Resets that shortcut to its default.',
  '#keys-reset-all': 'Resets every shortcut to its default.',
  'data-limit': 'A usage limit: carry on paid, wait, or switch, as the button says.',
  'data-older': 'Loads older messages again after a failed read.',
  'data-rec-undo': 'Undoes a record change within its window.',
  'data-herald-undo': 'Undo in a notice, within its window.',
  'data-a': 'A notice\'s own action, as its label says.',
  'data-dock-open': 'Opens the dock it names.',
  'data-crail': 'Beside a file: unfolds the folded chat.',
  'data-fold': 'Folds the docked decision away to read the thread first.',
  'data-unfold': 'Unfolds the docked decision.',
  'data-dock-undo': 'Undoes the decision just made in the dock (3 s).',
  'data-ref': 'Opens a file (and its lines) a message refers to.',
  'data-lref-x': 'Takes the file (or the lines) out of the message you\'re writing.',
  'data-af': 'The All list of threads: shows the threads that filter names.',
  'data-all-done': 'The All list of threads: shows or folds the done ones.',
  'data-ar-undo': 'The All list of threads: undoes resolving that thread.',
  'data-nx-opt': 'Home\'s next move: answers with that option.',
  'data-decide': 'Home\'s next move: opens the decision in full.',
  'data-nx-back': 'Home\'s next move: send back, with a note.',
  'data-nx-allow': 'Home\'s next move: Allow (after its re-arm).',
  'data-later': 'Puts the decision off until later today.',
  '#nx-note-in': 'Home\'s next move: the note sent back with it.',
  'data-nx-send': 'Home\'s next move: sends the note back.',
  'data-nx-cancel': 'Home\'s next move: cancels the note.',
  'data-open-all': 'Opens the decisions panel at the next one.',
  'data-glances': 'Opens only the quick (glance) decisions.',
  'data-bring': 'Brings the put-off decisions back into today\'s list.',
  'data-bring-in': 'Brings one put-off decision in now.',
  'data-interrupt': 'Interrupts the run.',
  'data-unfreeze': 'Picks a frozen thread back up.',
  'data-retry': 'Sends a failed message again.',
  'data-edit': 'Puts a failed message back in the box to edit.',
  'data-chat-retry': 'Chats: sends a failed message again.',
  'data-chat-edit': 'Chats: puts a failed message back to edit.',
  'data-chat-stop': 'Chats: stops the turn.',
  'data-csmode': 'Chats: send now, or add to the running turn.',
  'data-cs-done': 'Chats: closes the send-mode question.',
  'data-chc': 'Chats: adds the message to the running turn instead.',
  'data-cp': 'Create: the step its label names (connect GitHub, pick a repository …).',
  'data-act=allow': 'Decision card: Allow (after the 300 ms re-arm).',
  'data-act=back': 'Decision card: Send back, with a note.',
  'data-act=retry': 'Decision card: Try again from the failing step (after the re-arm).',
  'data-act=done': 'Decision card: Done (after the re-arm).',
  'data-act=thread': 'Decision card: opens where it was asked.',
  'data-act': 'Decision card: the action its label names (each after the re-arm).',
  'data-opt': 'Decision card: answers with that option (after the re-arm).',
  'data-iopt': 'Decision card: answers a question with that option (after the re-arm).',
  'data-qid': 'Decision card: one question\'s answer field.',
  'data-name': 'A form field; its name is the answer\'s key.',
  'data-iscope': 'Decision card: how wide Allow teaches the rule.',
  'data-scope': 'Decision card: teach exactly this command, or its kind.',
  'data-vig=go': 'Decisions: keep going after a long run of them.',
  'data-vig': 'Decisions: take a break, or keep going.',
  'data-nav': 'Decisions: previous or next card.',
  'data-all': 'Decisions: allow all the routine ones (asks to confirm).',
  'data-cf': 'Decisions: confirms Allow all.',
  'data-lp-env': 'Launchpad: an environment value (secret ones are never kept).',
  'data-lp-f': 'Launchpad: a deploy setting (name, port, size, disk).',
  'data-lbx': 'Picture viewer: the step its label names (previous, next, zoom, close).',
  'data-map-toggle': 'Opens or closes the map.',
  'data-node': 'Map: selects that agent or thread.',
  'data-mp-go': 'Map: opens what the node is.',
  'data-mp-focus': 'Map: centres on that node.',
  'data-mp-full': 'Map: full size, and back.',
  'data-mp-close': 'Map: closes it.',
  'data-stage': 'Map: opens what it names in the panel.',
  'data-copy': 'Copies the code block; says copied only once it is.',
  'data-rec-got': 'Since you were away: got it; the line goes.',
  'data-rec-more': 'Shows more of what was made.',
};
// a kind's words: its most specific hook first (attribute=value, then attribute, then #id)
function doesOf(k) {
  const toks = tokensOf(k);
  for (const t of toks) if (t.includes('=') && DOES[t]) return DOES[t];
  for (const t of toks) { const n = t.split('=')[0]; if (DOES[n]) return DOES[n]; }
  if (DOES[k]) return DOES[k];
  return '';
}
// my read of a "no" that is the design, checked by hand (Astra grades it all the same)
const NOTES = {
  '#pf-in': 'text', '#cp-name': 'text', '#cp-desc': 'text', '#arts-q': 'text', '#say': 'text', 'data-fl-q': 'text', '#jump-q': 'jump',
  'data-route=decision': 'Disabled until its model is connected: no hover or press by design.',
  'data-shp-reset': 'Disabled while Shape is the preset as it comes.',
  '#stage-map-tree': 'sel', 'data-vw-mode=preview': 'sel', 'data-mode=empty': 'sel',
  'data-dg': 'region', 'data-rtd-allowed': 'The 13 px box sits in a 34 px chip (its label) that answers hover and shows the ring; the chip is the target.',
};
const NOTE_WORDS = { text: 'A text field: no hover by design; focus shows on its box.', jump: 'Jump\'s field is the dialog\'s only control and always has focus.', sel: 'The selected segment doesn\'t answer hover; the other one does.', region: 'A region you drag or scroll, not a button: no hover by design.' };
function noteOf(k, cls) {
  for (const t of [k, ...tokensOf(k)]) if (NOTES[t]) return NOTE_WORDS[NOTES[t]] || NOTES[t];
  if (/vw-body|cx-pd/.test(cls || '')) return NOTE_WORDS.region;
  return '';
}

// ── the handler pointer: the first line in js/ (not vendor) that names the hook in an event path. A text match ──
const JSFILES = [];
(function walk(d) { for (const f of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, f.name); if (f.isDirectory()) { if (f.name !== 'vendor') walk(p); } else if (f.name.endsWith('.js')) JSFILES.push(p); } })(path.join(ROOT, 'js'));
const JS = JSFILES.map((p) => [path.relative(ROOT, p), fs.readFileSync(p, 'utf8').split('\n')]);
function handler(k) {
  const toks = tokensOf(k);
  let needles;
  if (k.startsWith('#')) { const b = k.slice(1).replace(/-N$/, '-'); needles = [`"#${b}`, `getElementById("${b}`, `$("#${b}`]; }
  else if (k.includes('[')) needles = toks.map((t) => { const [n, v] = t.split('='); return v && !v.includes('…') ? `[${n}="${v}"` : `[${n}`; }).concat(toks.map((t) => `[${t.split('=')[0]}`));
  else needles = ['.' + k.split('.')[1]];
  for (const n of needles) for (const [f, lines] of JS) for (let i = 0; i < lines.length; i++) {
    const L = lines[i];
    if (!/closest|matches\(|addEventListener|getElementById|\$\("#/.test(L) || /innerHTML|insertAdjacentHTML|`<|querySelectorAll\(`/.test(L)) continue;
    if (L.includes(n)) return `${f}:${i + 1}`;
  }
  return '';
}

// ── the rendered kinds ──
const groups = new Map();
for (const [src, data] of [['desk', desk], ['phone', phone]]) {
  if (!data) continue;
  for (const x of data.controls) {
    const k = renderedKey(x);
    if (!groups.has(k)) groups.set(k, { k, first: x, states: new Set(), n: 0, desk: [], phone: [], legacy: new Set() });
    const g = groups.get(k);
    g.states.add(x.state); g.n++; g[src].push(x); g.legacy.add(legacyKey(x));
  }
}

// ── the kinds the code can draw: every <button>/<a href>/<input>/… in index.html and js/ (not vendor), by canonical key ──
const SRC = [['index.html', fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8').split('\n')], ...JS];
const sourceKinds = new Map();
for (const [f, lines] of SRC) lines.forEach((L, i) => {
  for (const m of L.matchAll(/<(button|a|input|textarea|select|summary|xo-select)\b([^>]*)>/g)) {
    const attrs = [...m[2].matchAll(/\b(data-[\w-]+)(?:="([^"]*)")?/g)].map((x) => [x[1], x[2] || '']);
    const idm = /\bid="([\w-]+)"/.exec(m[2]);
    const id = idm && !/\$\{/.test(idm[1]) ? idm[1] : '';
    if (!id && !attrs.some(([n]) => !SKIP.has(n))) continue; // nothing to name it by
    if (m[1] === 'a' && !/href=/.test(m[2])) continue;
    const key = canon(m[1], id, attrs, (/class="([^"]*)"/.exec(m[2]) || [])[1]);
    if (!sourceKinds.has(key)) sourceKinds.set(key, { key, tag: m[1], at: `${f}:${i + 1}`, text: ((/>([^<]{2,40})</.exec(L.slice(m.index)) || [])[1] || '').replace(/\$\{[^}]*\}/g, '…').trim() });
  }
});
// a code kind is reached when a rendered kind of the same tag carries all its hooks (with the same value where it has one)
const reached = (sk) => {
  if (groups.has(sk.key)) return groups.get(sk.key);
  if (sk.key.startsWith('#')) return null;
  const t = tokensOf(sk.key);
  for (const g of groups.values()) {
    if (g.first.tag !== sk.tag) continue;
    const gt = new Set(tokensOf(g.k)), names = new Set([...gt].map((x) => x.split('=')[0]));
    if (t.every((x) => (x.includes('=') ? gt.has(x) : names.has(x)))) return g;
  }
  return null;
};

// ── IDs, then the file ──
for (const g of [...groups.values()]) g.id = idFor(g.k, 'C', [...g.legacy]);
const codeOnly = [];
for (const sk of sourceKinds.values()) {
  if (reached(sk)) continue;
  const hook = sk.key.startsWith('#') ? sk.key : tokensOf(sk.key)[0].split('=')[0];
  sk.id = idFor(sk.key, 'S', [sk.key.startsWith('#') ? sk.key : `${sk.tag}[${hook}]`]);
  codeOnly.push(sk);
}
fs.writeFileSync(REG_FILE, JSON.stringify(reg, null, 1) + '\n');

const yes = (v) => (v === true ? 'yes' : v === false ? '**no**' : '–');
const sizeOf = (xs) => { if (!xs.length) return '–'; const hs = [...new Set(xs.map((x) => x.h))].sort((a, b) => a - b); const ws = xs.map((x) => x.w); const w = Math.min(...ws) === Math.max(...ws) ? `${ws[0]}` : `${Math.min(...ws)}–${Math.max(...ws)}`; return `${w} × ${hs.length > 3 ? hs[0] + '–' + hs.at(-1) : hs.join('/')}`; };
// a kind answers if any measured instance did; "no" only if measured and none did; "–" if never measured
const any = (xs, f) => (xs.some((x) => x[f] === true) ? true : xs.some((x) => x[f] === false) ? false : null);
const REGION = { '#side': 'Sidebar', '#composer': 'Composer', '#stage': 'Panel', '#viewer': 'File viewer', '#settings': 'Settings', '#jump': 'Jump (Ctrl/Cmd+K)', '#iq-pop': 'Intelligence picker', '#create-dlg': 'Create', '#msgs': 'Conversation', '#thead': 'Thread head', '#home': 'Home', '#arts': 'Artifacts', page: 'Page', '#herald': 'Notices' };
const ORDER = ['Sidebar', 'Home', 'Create', 'Jump (Ctrl/Cmd+K)', 'Page', 'Thread head', 'Conversation', 'Composer', 'Intelligence picker', 'Artifacts', 'Panel', 'File viewer', 'Settings'];
const areaOf = (g) => REGION[g.first.region] || g.first.region;
const byArea = new Map();
for (const g of [...groups.values()].sort((a, b) => a.id.localeCompare(b.id))) { const a = areaOf(g); if (!byArea.has(a)) byArea.set(a, []); byArea.get(a).push(g); }
const areas = [...byArea.keys()].sort((a, b) => (ORDER.indexOf(a) + 1 || 99) - (ORDER.indexOf(b) + 1 || 99));

const out = [], body = [];
let rowsC = 0, rowsS = 0, rowsF = 0;
const noWords = [];
for (const a of areas) {
  body.push(`## ${a}`, '', '| ID | Control | Does | Size | Hover | Press | Focus ring | Where it shows | Handler (text match) | Status |', '|---|---|---|---|---|---|---|---|---|---|');
  for (const g of byArea.get(a)) {
    rowsC++;
    const does = doesOf(g.k); if (!does) noWords.push(g.id + ' ' + g.k);
    const note = noteOf(g.k, g.first.cls);
    const ring = any(g.desk.filter((x) => x.gotFocus === true), 'ring');
    const ringCell = ring === null ? (g.desk.some((x) => x.focusable) ? '– (not measured)' : g.desk.length ? '– (not focusable)' : '–') : yes(ring);
    const dis = g.desk.length && g.desk.every((x) => x.disabled || x.ariaDisabled) ? ' (disabled where seen)' : '';
    const where = [...g.states].slice(0, 4).join(', ') + (g.states.size > 4 ? ` +${g.states.size - 4}` : '');
    const name = (g.first.name || '').replace(/\|/g, '/').slice(0, 48);
    body.push(`| ${g.id} | ${name}<br>\`${g.k.replace(/\|/g, '/')}\` | ${does || '**?**'}${note ? `<br>*${note}*` : ''} | ${sizeOf(g.desk)}${g.phone.length ? `<br>phone ${sizeOf(g.phone)}` : ''} | ${yes(any(g.desk, 'hover'))} | ${yes(any(g.desk, 'press'))}${dis} | ${ringCell} | ${where} | ${handler(g.k)} | ${status[g.id] || 'Unchecked'} |`);
  }
  body.push('');
}
body.push('## In the code, not reached by the crawl', '', 'Kinds the templates (index.html and js/, not vendor) can draw that no crawled place showed: errors, empty lists, confirmations, other kinds of item. Each needs its row checked in the state that shows it. Controls a library draws inside a shadow root (the diff\'s merge choices) are found only by the crawl.', '', '| ID | Key | Tag | First drawn at | Example text | Does | Status |', '|---|---|---|---|---|---|---|');
for (const sk of codeOnly.sort((a, b) => a.id.localeCompare(b.id))) {
  rowsS++;
  const does = doesOf(sk.key); if (!does) noWords.push(sk.id + ' ' + sk.key);
  body.push(`| ${sk.id} | \`${sk.key.replace(/\|/g, '/')}\` | ${sk.tag} | ${sk.at} | ${sk.text.replace(/\|/g, '/')} | ${does || '**?**'} | ${status[sk.id] || 'Unchecked'} |`);
}
body.push('', '## Flows (timing, focus, truth)', '', '| ID | Flow | Does | Locked by | Status |', '|---|---|---|---|---|');
const FLOWS = [
  ['F-G1', 'A decision\'s first 300 ms; a held key', 'Every Allow / Try again / Done / option / answer waits out the re-arm; a key repeat never decides', 'tests/browser/flows.test.cjs G1 (4 cases)'],
  ['F-G2', 'A card withdrawn while you type on it', 'The next card starts with its letter keys paused and says why', 'flows.test.cjs G2'],
  ['F-G3', 'Save with a place still to choose', 'Neither Ctrl/Cmd+S nor the button saves; markers never reach the file', 'flows.test.cjs G3 at 1440 and 390'],
  ['F-G4', 'A late save after opening another file', 'It lands only on its own file; the other file keeps its text and toolbar', 'flows.test.cjs G4 at 1440 and 390'],
  ['F-G4b', 'Typing while a save is out', 'What was there at Save is saved; what you typed since stays, unsaved, against the new version', 'flows.test.cjs "Save while typing" at 1440 and 390'],
  ['F-G5', 'A hop receipt racing the history read', 'A newer state is never overwritten by an older read; an early receipt is held', 'flows.test.cjs G5 (2 cases) at 1440 and 390; tests/storm.test.mjs hops'],
  ['F-G6', 'Launchpad Stop', 'Stopped only on {stopped:true} or the stream\'s cancelled; refused or unconfirmed: says so, with Stop again; the stream\'s end wins', 'flows.test.cjs G6 (3 cases) at 1440 and 390'],
  ['F-G7', 'Focus after an editor outcome', 'Edit after a save or discard; Save through Saving… and a failure; Keep editing for Cancel\'s question; Edit after Undo, failed or not', 'flows.test.cjs G7 (2 cases) at 1440 and 390'],
  ['F-G8', 'The file capsule\'s ×', 'Named for the file; a line range keeps its line words', 'flows.test.cjs G8 at 1440 and 390'],
];
for (const [id, f, d, l] of FLOWS) { rowsF++; body.push(`| ${id} | ${f} | ${d} | ${l} | ${status[id] || 'Failing until Astra passes it'} |`); }

const obsD = desk ? desk.controls.length : 0, obsP = phone ? phone.controls.length : 0;
const failedPlaces = (d) => (d ? d.states.filter((s) => s.error).map((s) => s.state) : []);
const fd = failedPlaces(desk), fp = failedPlaces(phone);
out.push('# Every control, and how it answers', '');
out.push('**Not complete yet.** Astra grades every row on its own; a row counts as done only once Astra has passed it.', '');
out.push(`Built from the rendered app and the code, not from memory: \`tools/inventory.cjs\` crawls the real app read-only (${desk ? `${desk.states.length} places at 1440 px, crawled ${desk.at}` : 'no 1440 crawl'}${phone ? `; ${phone.states.length} at 390 px, crawled ${phone.at}` : ''}), and \`tools/controls-md.cjs\` groups what it saw into kinds, words each kind, points at its handler and adds the kinds only the code shows. Regenerate: \`node tools/inventory.cjs dark 1440 && node tools/inventory.cjs dark 390 && node tools/controls-md.cjs\`.`, '');
out.push(`**In this file:** ${rowsC} rendered kinds (C rows), ${rowsS} kinds only in the code (S rows), ${rowsF} flow rows (F rows); ${obsD + obsP} observations behind the C rows (${obsD} at 1440, ${obsP} at 390).`, '');
out.push(fd.length || fp.length ? `**Places the crawl couldn't reach**, so their controls aren't measured here: ${[fd.length ? `1440: ${fd.join(', ')}` : '', fp.length ? `390: ${fp.join(', ')}` : ''].filter(Boolean).join('; ')}.` : '**Every place in the crawl was reached** at both widths.', '');
out.push('Row IDs come from `controls-ids.json`, a committed registry from each kind\'s canonical key to its ID: IDs are only appended, never renumbered, so a grade stays on its control. **Hover**, **Press** and **Focus ring** say whether the control (or its box, its parts, its pseudo-elements) visibly changes when the pointer is over it, while pressed, and when the keyboard focuses it: `no` was measured on the attached control; `–` was not measured (not focusable, or it never took focus there). Hover and press are measured at 1440 only (390 is touch). **Handler** is the first line in js/ that names the hook in an event path: a pointer to check, not proof. **Status** is Astra\'s.', '');
fs.writeFileSync(path.join(DIR, 'CONTROLS.md'), out.concat(body).join('\n') + '\n');
console.log(`C ${rowsC}, S ${rowsS}, F ${rowsF}, observations ${obsD + obsP} (${obsD}+${obsP}); places not reached: ${fd.length}+${fp.length}; without words: ${noWords.length}`, noWords.slice(0, 60));
