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
// the states only some controls show, opened in the browser suite's mock world (tools/inventory-states.cjs)
const mock = readJson('inventory-states-1440.json');
// my side of a row (what changed since Astra last saw it): controls-status.json. Astra's verdicts come from its own
// ledgers, read-only: the main grader's consolidated ledger (ASTRA_LEDGER, default consolidated-verdicts.json: every
// grader's rows in one count, each at its own evidence revision),
// and the Files/editor/diffs/Map grader's latest (FILES_LEDGER, default its newest *-verdicts.json), which wins for
// the rows it grades. Each verdict names the revision its evidence is from. Without them, "Unchecked".
const myNotes = readJson('controls-status.json', {});
const WT = path.join(ROOT, '..');
const LEDGER = process.env.ASTRA_LEDGER || path.join(WT, 'thread-cmsg_942e352acb4d4ba2', 'ui-mockups', 'lg-audit', 'consolidated-verdicts.json');
const FILES_DIR = path.join(WT, 'thread-cmsg_e3415cae12ea4e70', 'audit-files');
const FILES_LEDGER = process.env.FILES_LEDGER || (() => { try { return fs.readdirSync(FILES_DIR).filter((f) => /-verdicts\.json$/.test(f)).map((f) => path.join(FILES_DIR, f)).sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0]; } catch { return null; } })();
let astra = {}, filesV = {}, ledgerRev = '', filesRev = '';
try { const d = JSON.parse(fs.readFileSync(LEDGER, 'utf8')); ledgerRev = d.inventoryRevision || ''; for (const r of d.rows) astra[r.opusId] = r; } catch { astra = {}; }
try { const d = JSON.parse(fs.readFileSync(FILES_LEDGER, 'utf8')); filesRev = String(d.latestRevision || '').slice(0, 7); for (const r of d.rows) filesV[r.id] = r; } catch { filesV = {}; }
const RETIRED = {}; // rows a grader found retired or unreachable: kept, marked
for (const [id, r] of Object.entries(filesV)) if (/retired|not.?applicable|n\/a|unreachable/i.test(String(r.status))) RETIRED[id] = r.reason || r.status;
const verdictOf = (id) => {
  const f = filesV[id], r = astra[id];
  let v, why = '', rev = '';
  if (f) {
    v = /retired|not.?applicable|n\/a|unreachable/i.test(String(f.status)) ? 'Retired' : String(f.status).toUpperCase();
    rev = f.evidenceRevision || filesRev; why = f.reason || '';
  } else if (r) {
    v = r.behaviorVerdict === 'FAIL' || r.inventoryVerdict === 'FAIL' ? 'FAIL' : r.behaviorVerdict === 'PASS' ? 'PASS (scoped)' : 'Unverified';
    rev = r.inventoryRevision || ledgerRev; why = v === 'Unverified' && !/CLOSED/.test(r.reason || '') ? '' : r.reason || '';
    if (v === 'PASS (scoped)' && r.acceptanceScope) why = `scope: ${r.acceptanceScope}`;
  }
  // a pass is closed, unless a grader has since failed it (my note names that FAIL, newer than the ledger's PASS:
  // Astra S062 at 2354917 under a Files PASS at 69f8f2a): then the row shows the note, never a stale PASS alone
  const reopened = !!myNotes[id] && /FAIL at /.test(myNotes[id]);
  const closed = !reopened && ((r && /CLOSED/.test(r.reason || '')) || (f && /PASS/i.test(f.status)));
  const mine = myNotes[id] && !closed ? ` · ${myNotes[id]}, awaiting Astra` : '';
  if (!v) return `Unchecked${mine}`;
  const words = Array.isArray(why) ? why.map((w) => (typeof w === 'string' ? w : w && (w.id || w.result) || '')).filter(Boolean).join(', ') : typeof why === 'object' && why ? JSON.stringify(why) : String(why || '');
  return `Astra${f ? ' (Files grader)' : ''} ${v}${/^[0-9a-f]{7,40}$/i.test(String(rev)) ? ` at ${String(rev).slice(0, 7)}` : ''}${words ? `: ${words.replace(/\|/g, '/').replace(/\s+/g, ' ').slice(0, 120)}` : ''}${mine}`;
};
const status = new Proxy({}, { get: (_, id) => verdictOf(String(id)) });
// --dry: write the list and the registry to /tmp (to look before committing a registry)
const DRY = process.argv.includes('--dry');
const REG_FILE = DRY ? '/tmp/controls-ids.dry.json' : path.join(DIR, 'controls-ids.json');
const reg = readJson('controls-ids.json', { note: 'Canonical key → row ID. Append-only: never renumber, never reuse.', next: { C: 1, S: 1 }, ids: {} });
// rows a grader added under its own IDs (EDITOR-…, M-…): the same control here, found by its key (a gesture, by
// name), so its grade lands on this list's row; my notes may use either ID
const GRADER_ALIAS = { 'M-ATT-DROP': 'gesture: drop files', 'M-INT-MODEL': 'div[data-mvm]', 'M-INT-EFFORT': 'button[data-mvp]' };
{
  const byKey = new Map();
  for (const [id, e] of Object.entries(reg.ids)) { byKey.set(e.key, id); for (const al of e.aliases || []) byKey.set(al, id); }
  for (const [src, field] of [[astra, 'key'], [filesV, 'selector']]) for (const [gid, r] of Object.entries({ ...src })) {
    if (reg.ids[gid]) continue;
    const id = byKey.get(GRADER_ALIAS[gid] || r[field]);
    if (id && !src[id]) src[id] = r;
    if (id && myNotes[gid] && !myNotes[id]) myNotes[id] = myNotes[gid];
  }
}

// ── one canonical key for a kind, the same whether it was rendered or read from a template ──
// values that name what a control does stay in its key; the rest (a project, a file, a row's id) make one kind
const KEEP = new Set(['data-a', 'data-lsimple', 'data-cs', 'data-mode', 'data-vw-mode', 'data-fl-rail', 'data-route', 'data-lp', 'data-shp-preset', 'data-to', 'data-fr-fold', 'data-ghost', 'data-map-mode', 'data-act', 'data-vig', 'data-dg', 'data-lbx', 'data-cp', 'data-csmode']);
const SKIP = new Set(['data-w', 'data-k', 'data-fid', 'data-fl-bytes', 'data-file-name', 'data-i', 'data-v', 'data-id', 'data-key', 'data-tip', 'data-ref-a', 'data-ref-b', 'data-inv', 'data-inv-now', 'data-lid', 'data-n', 'data-pid', 'data-change-project', 'data-limit-d']);
const FAMILY = /^(tab|radio|option|menuitem|menuitemradio|menuitemcheckbox)$/;
function canon(tag, id, attrs, cls, role = '') {
  // a tab, a radio, an option or a menu item that carries its family's data- hook is keyed by that hook, not by
  // its id: an id given for ARIA (aria-controls …) never splits one kind into one row per member (C098)
  if (id && !(FAMILY.test(role) && attrs.some(([n]) => !SKIP.has(n)))) return '#' + id.replace(/-\d+$/, '-N');
  const parts = [];
  for (const [n, v] of attrs) {
    if (SKIP.has(n)) continue;
    if (n === 'data-go') { parts.push(n + '=' + (/\$\{/.test(v) || !v ? '…' : String(v).replace(/^(p|t|c):.*/, '$1:…'))); continue; }
    parts.push(KEEP.has(n) && v && !/\$\{/.test(v) ? `${n}=${v}` : n);
  }
  // data-lp is two hooks: the conversation's long-press menu (role=menuitem: Copy, Select text) and Launchpad's.
  // Launchpad's address Copy is its own kind, never the menu's Copy (Astra on 0612310: S170 mixed the two)
  if (role !== 'menuitem' && parts.includes('data-lp=copy') && /\blp-ib\b/.test(cls || '')) return `${tag}.lp-ib[${[...new Set(parts)].sort().join(',')}]`;
  if (parts.length) return `${tag}[${[...new Set(parts)].sort().join(',')}]`;
  return `${tag}.${(cls || '').split(/[.\s]/).filter((c) => c && !/^is-/.test(c)).slice(0, 2).join('.')}`;
}
const renderedKey = (x) => canon(x.tag, x.id, x.data.map((a) => { const i = a.indexOf('='); return i < 0 ? [a, ''] : [a.slice(0, i), a.slice(i + 1)]; }), x.cls, x.role);
const tokensOf = (k) => { if (k.startsWith('#')) return [k]; const m = /\[([^\]]+)\]/.exec(k); return m ? m[1].split(',') : [k]; };

// ── IDs: the registry, seeded once from the list as committed in 3a9cdca (so grades given there stay on their rows) ──
function seedFrom3a9cdca() {
  if (Object.keys(reg.ids).length) return;
  let text = '';
  try { text = require('child_process').execSync('git show 3a9cdca:design-research/2026-11-lg/CONTROLS.md', { cwd: ROOT, encoding: 'utf8' }); } catch { return; }
  const legacy = {};
  for (const l of text.split('\n')) {
    let m = /^\| (C\d+) \| .*?<br>`([^`]+)`/.exec(l); if (m) { legacy[m[1]] = { kind: 'C', key: m[2] }; continue; }
    m = /^\| (S\d+) \| `([^`]+)` \| (\w+) \|/.exec(l); if (m) legacy[m[1]] = { kind: 'S', key: m[2].startsWith('#') ? m[2] : `${m[3]}[${m[2]}]` };
  }
  reg.legacy = legacy; // the 3a9cdca keys, kept as aliases
  // every 3a9cdca row keeps its ID from the start, under its 3a9cdca key; a new key for the same kind is added
  // as an alias when it's matched (so no row, and no grade, is ever dropped)
  for (const [lid, le] of Object.entries(legacy)) reg.ids[lid] = { key: le.key, aliases: [] };
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
// one ID, one row: an ID claimed by a key in this run isn't given to another (a 3a9cdca kind now split by its
// action, data-act=allow / =back …, keeps its ID on the general key; each action gets its own)
const claimed = new Map();
const claim = (id, key) => { claimed.set(id, key); return id; };
const exactId = (key) => { const id = byKey.get(key); return id && (!claimed.has(id) || claimed.get(id) === key) ? claim(id, key) : null; };
// the ID a key already has (in the registry, or in 3a9cdca), recorded under this key too; null if none
function existingId(key, legacyKeys = []) {
  const ex = exactId(key); if (ex) return ex;
  for (const lk of legacyKeys) for (const [lid, le] of Object.entries(reg.legacy || {})) {
    if (le.key !== lk || (claimed.has(lid) && claimed.get(lid) !== key)) continue;
    claim(lid, key);
    if (!reg.ids[lid]) reg.ids[lid] = { key, aliases: [lk] };
    else reg.ids[lid].aliases = [...new Set([...(reg.ids[lid].aliases || []), key])];
    byKey.set(key, lid);
    return lid;
  }
  return null;
}
function idFor(key, kind, legacyKeys = []) {
  const ex = existingId(key, legacyKeys); if (ex) return ex;
  const id = kind + String(reg.next[kind]++).padStart(3, '0');
  reg.ids[id] = { key, aliases: [] };
  byKey.set(key, id);
  return claim(id, key);
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
  'data-lsimple=auto': 'Picker, simple view: Auto, the router\'s pick (it applies at once and closes).',
  'data-lsimple=deep': 'Picker, simple view: Think deeper, the strongest model it has at a deeper effort (it applies at once and closes).',
  'data-lsimple': 'Picker, simple view: Auto or Think deeper (it applies at once and closes).',
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
  'data-lp=open': 'Launchpad (Deploy, in its section\'s head): opens and unfolds the Launchpad section in the panel, focus on its body (it doesn\'t open the app).',
  'data-lp=deploy': 'Launchpad: deploys (3 s to Undo first).',
  'data-lp=stop': 'Launchpad: stops the deploy after 3 s (Undo); says stopped only once Space confirms.',
  'data-lp=undo': 'Launchpad: undoes the deploy before it starts.',
  'data-lp=retry': 'Launchpad: deploys again.',
  'data-lp=again': 'Launchpad: deploys again with the same settings.',
  'data-lp=hide': 'Launchpad: hides the section; the deploy carries on.',
  'data-lp=copy': 'Conversation, a phone\'s long-press menu on a message: copies its words (says Copied only once they\'re on the clipboard).',
  'data-lp=select': 'Conversation, a phone\'s long-press menu on a message: selects its words with the browser\'s own selection.',
  'button.lp-ib[data-lp=copy]': 'Launchpad: copies the app\'s address.',
  'data-lp=edit': 'Launchpad: opens the live app\'s settings to change.',
  'data-lp=edit-cancel': 'Launchpad: leaves the settings as they were.',
  'data-lp=cmd-copy': 'Launchpad: copies the command shown.',
  'data-lp=recheck-gh': 'Launchpad: checks GitHub again.',
  'data-lp=recheck': 'Launchpad: checks the project again.',
  'data-lp=env-all': 'Launchpad: shows every environment value, not only the ones to fill.',
  'data-lp=reconnect': 'Launchpad: connects GitHub again (a device code).',
  'data-lp=pick': 'Launchpad: picks an app on Launchpad to link.',
  'data-lp=pick-cancel': 'Launchpad: back from picking an app.',
  'data-lp=link': 'Launchpad: links that app.',
  'data-lp=machine-open': 'Launchpad: shows the machine settings (size, disk).',
  'data-lp=disk-add': 'Launchpad: adds a disk.',
  'data-lp=disk-remove': 'Launchpad: removes the disk.',
  'data-lp=use-name': 'Launchpad: uses the suggested name.',
  'data-lp=rewatch': 'Launchpad: follows the running deploy again.',
  'data-lp=unlink': 'Launchpad: unlinks the app (3 s to Undo; the app keeps running).',
  'data-lp=menu': 'Launchpad: the app\'s menu.',
  'data-lp=code-copy': 'Launchpad: copies the GitHub device code.',
  'data-lp=device-cancel': 'Launchpad: stops connecting GitHub.',
  'data-lp': 'Launchpad: the step its label names.',
  'data-open-files': 'Opens Files: the project\'s whole tree beside the conversation.',
  '#stage-map-tree': 'Map as a diagram.',
  '#stage-map-graph': 'Map as a graph.',
  'data-map-mode': 'Map: diagram or graph.',
  'data-dg=in': 'Map: zooms in.',
  'data-dg=out': 'Map: zooms out.',
  'data-dg=fit': 'Map: fits everything in view.',
  'data-dg=follow': 'Map: follows the working agent, or stops following.',
  'data-dg=tree': 'Map: draws it as a diagram.',
  'data-dg=graph': 'Map: draws it as a graph.',
  'data-dg': 'The map: drag to move around, Ctrl/Cmd+scroll zooms.',
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
  'data-fl-unpick': 'Files: from the project you picked, back to the list of projects.',
  'data-fl-change': 'Files: opens a changed file.',
  'data-fl-touch': 'Files: opens a file an agent touched.',
  'data-fl-pick': 'Files: opens that project\'s files.',
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
  'data-vw-split': 'Changes: side by side (before and after), or in one column.',
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
  'data-vw-retry': 'Draws the file again after its view failed to show it.',
  'data-vw-diff-retry': 'Reads a change again after it failed to read.',
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
  'data-dm-submit': 'Settings › Routing: sends the pasted API key to connect a decision model; once while it asks.',
  'data-runs-stop': 'Runs: stops all of its sub-agents in 3 s, with Undo in the sheet until then (no question first); the thread\'s own agent keeps working.',
  'data-run-stop': 'Runs: stops that run.',
  'data-run-call': 'Opens a run\'s call in full.',
  'data-close': 'Closes the runs view.',
  'data-follow': 'Changes: follows the newest change, or stops following.',
  'data-cx-open': 'Opens the changed file in Files.',
  'data-cx': 'Shows that change\'s diff.',
  'data-cx-all': 'Changes: shows the rest of the changed files (it says how many more).',
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
  'data-shp-keep': 'Shape, asked before a preset replaces your own changes: Keep mine keeps your shape as it is, and the preset you picked isn\'t applied.',
  'data-shp-switch': 'Shape, asked before a preset replaces your own changes: Switch applies that preset and clears your own changes; what you set on this device stays.',
  'data-shf-close': 'Shape, first run: closes the question (everything shows).',
  'data-shf': 'Shape, first run: what you\'ll use XO for.',
  'data-route=agent': 'Routing: the coordinator reads each message and decides.',
  'data-route=decision': 'Routing: a decision model routes messages.',
  'data-route=off': 'Routing off: chats using this setting refuse new messages (one with its own routing keeps it); replies inside threads still work.',
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
  'data-a=view': 'An attachment: previews it.',
  'data-a=retry': 'An attachment that failed to upload: uploads it again.',
  'data-a=x': 'An attachment: takes it off the message.',
  'data-a=inline': 'Pasted text kept as an attachment: puts it back in the message as text.',
  'data-a': 'An attachment\'s action (Preview, Retry, Remove, As text), as its label says.',
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
  'data-lp-f': 'Launchpad: a deploy setting typed in (name, port, disk).',
  'xo-select[data-lp-f]': 'Launchpad: the app\'s size, from the sizes Launchpad allows (Launchpad\'s default first).',
  'select[data-lp-f]': 'Launchpad: the app\'s size, as a plain select (before it became the Size xo-select, S236).',
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
  'data-go=…': 'Opens the place it names.',
  'data-hn': 'A notice: opens what it is about (or the decision it asks for).',
  '#side-x': 'Phone: closes the drawer.',
  'data-fl-more': 'Files: the folder\'s menu (new file, copy the path).',
  'data-content': 'The file\'s text in the viewer (drawn by the diff library): scrolls; in Edit, where you type.',
  '#att-input': 'Add files: the file picker the + opens.',
  '#send-now': 'Chats: send now, rather than after the running turn (it toggles).',
  '#pn-x': 'Closes the decisions panel.',
  '#cp-repo': 'Create from GitHub: the repository to clone.',
  '#cp-stop': 'Create: stops making the project.',
  '#all-q': 'The All list of threads: finds a thread by name as you type.',
  '#tw-edit': 'The thread\'s title, being renamed in place: Enter keeps, Esc cancels.',
  '#rtd-pref': 'Runtimes: how coordinators choose, in your words; saved when you leave the field.',
  'data-cs=cwd': 'Chats: the folder this chat\'s agent works in.',
  'data-cs=agent': 'Chats: which agent (runtime) this chat runs.',
  'data-cs=model': 'Chats: the model it runs.',
  'data-cs=effort': 'Chats: how hard it thinks.',
  'data-cs': 'Chats: a setting for this chat, as its label says.',
  'data-abstain': 'Routing: how sure the decision model must be before it routes; below that it asks.',
  'data-sh-tab': 'Shells: switches to that shell.',
  'data-sh-detach': 'Shells: detaches that shell; it keeps running.',
  'data-sh-name': 'Shells: the shell\'s name; Enter keeps it.',
  'data-sh-rename': 'Shells: renames that shell.',
  'data-sh-close': 'Shells: asks to close that shell.',
  'data-sh-min': 'Shells: minimises or restores the dock.',
  'data-sh-hide': 'Shells: hides the dock; the shells keep running.',
  'data-sh-no': 'Shells: keeps it open.',
  'data-sh-yes': 'Shells: closes it (or the detached ones).',
  'data-sh-retry': 'Shells: connects that shell again.',
  'data-sh-filter': 'Shells (Show every shell): clears the project filter, every shell shows again.',
  'data-sh-closedet': 'Shells: asks to close the detached shells.',
  'data-sh-new': 'Shells: a new shell here.',
  'data-sh-open': 'Shells: opens a detached shell again.',
  'data-vw-mode=actual': 'A picture at its actual size, and back to fit.',
  'div.fl-split': 'Drag (or arrow keys) to resize the file tree.',
  'div.fv-cgrip': 'Drag to resize the conversation beside Files.',
  'div.stg-grip': 'Drag (or arrow keys) to resize the panel; double-click resets it.',
  'button.mx-work.mx-tail': 'The working line: what the agent is doing now; opens its steps at the latest.',
  'button.mx-work': 'The working line: what the agent is doing now; opens its steps at the latest.',
  'div.cx-pd': 'The diff: scrolls with the keys once focused; J and K move between changes.',
  'div.vw-body': 'The file: scrolls with the keys once focused.',
  'div.vw-body.vw-file': 'The file: scrolls with the keys once focused.',
  'summary.': 'Opens or folds the section under it.',
  'a.': 'A link in the text; it opens in a new tab.',
  'data-mvm': 'Picker, moving a thread: the model it continues on there.',
  'data-runs-retry': 'Runs: reads the list of sub-agents again after a failed read.',
  'data-runs-undo': 'Runs: undoes a stop still in its 3 s window; it keeps working.',
  'data-mvp': 'Picker, moving a thread: how hard it thinks there.',
  'button.mx-down': 'Back to the latest message, when you\'ve scrolled up.',
  'button.dis-h': 'Opens or folds the details under it.',
  '#c-note-N': 'Decision card: the note sent back with it; Enter sends, Esc closes it.',
};
// a kind's words: its most specific hook first (attribute=value, then attribute, then #id)
const MANUAL_DOES = () => Object.fromEntries((typeof MANUAL !== 'undefined' ? MANUAL : []).map((m) => [m.key, m.does]));
function doesOf(k) {
  const md = MANUAL_DOES(); if (md[k]) return md[k];
  if (DOES[k]) return DOES[k]; // a whole key's own words first (two kinds that share a hook, told apart)
  const toks = tokensOf(k);
  for (const t of toks) if (t.includes('=') && DOES[t]) return DOES[t];
  for (const t of toks) { const n = t.split('=')[0]; if (DOES[n]) return DOES[n]; }
  if (DOES[k]) return DOES[k];
  return '';
}
// my read of a "no" that is the design, checked by hand (Astra grades it all the same)
const NOTES = {
  '#pf-in': 'text', '#cp-name': 'text', '#c-note-N': 'text', '#cp-desc': 'text', '#arts-q': 'text', '#say': 'text', 'data-fl-q': 'text', '#jump-q': 'jump',
  'data-route=decision': 'Disabled until its model is connected: no hover or press by design.',
  'data-shp-reset': 'Disabled while Shape is the preset as it comes.',
  '#stage-map-tree': 'sel', 'data-vw-mode=preview': 'sel', 'data-mode=empty': 'sel',
  'data-dg': 'region', 'data-content': 'region', 'data-rtd-allowed': 'The 13 px box sits in a 34 px chip (its label) that answers hover and shows the ring; the chip is the target.',
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
for (const [src, data, tag] of [['desk', desk, ''], ['phone', phone, ''], ['desk', mock, 'mock: ']]) {
  if (!data) continue;
  for (const x0 of data.controls) {
    const x = tag ? { ...x0, state: tag + x0.state } : x0;
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
  for (const m of L.matchAll(/<(button|a|input|textarea|select|summary|xo-select|div|span|li|label)\b([^>]*)>/g)) {
    const role = (/\brole="([\w-]+)"/.exec(m[2]) || [])[1] || '';
    if (/^(div|span|li|label)$/.test(m[1]) && !/^(button|radio|tab|option|menuitem|menuitemradio|menuitemcheckbox|switch|checkbox|link)$/.test(role)) continue;
    const attrs = [...m[2].matchAll(/\b(data-[\w-]+)(?:="([^"]*)")?/g)].map((x) => [x[1], x[2] || '']);
    const idm = /\bid="([\w-]+)"/.exec(m[2]);
    const id = idm && !/\$\{/.test(idm[1]) ? idm[1] : '';
    if (!id && !attrs.some(([n]) => !SKIP.has(n))) continue; // nothing to name it by
    if (m[1] === 'a' && !/href=/.test(m[2])) continue;
    const key = canon(m[1], id, attrs, (/class="([^"]*)"/.exec(m[2]) || [])[1], role);
    if (!sourceKinds.has(key)) sourceKinds.set(key, { key, tag: m[1], firstData: (attrs.find(([n]) => !SKIP.has(n)) || [])[0] || '', at: `${f}:${i + 1}`, text: (((t) => (/\$\{|`|\}/.test(t) ? '' : t))(((/>([^<]{2,40})</.exec(L.slice(m.index)) || [])[1] || '').replace(/\$\{[^}]*\}/g, '…').trim())) });
  }
});
const MANUAL = [
  { key: 'button[data-unfold]', tag: 'button', at: 'js/app.js:1503', text: 'Open the decision', does: 'A folded decision in the dock: opens it again.' },
  { key: 'gesture: drop files', tag: 'drop', at: 'js/app.js:1923', text: '', does: 'Dropping files on the conversation attaches them to the message (only where that message box is in reach: not under Settings, a sheet or a dialog).' },
  // the move picker's choices: their hooks are passed in (modelRow's attrs.row, depthHtml's attr), so the scan can't see them
  { key: 'div[data-mvm]', tag: 'div', at: 'js/intel.js:279', text: '', does: 'Picker, moving a thread: the model it continues on there.' },
  { key: 'button[data-mvp]', tag: 'button', at: 'js/intel.js:279', text: '', does: 'Picker, moving a thread: how hard it thinks there.' },
  { key: 'diffs-container input[data-search]', tag: 'input', at: 'js/vendor/pierre-diffs/edit.js:46', text: 'Find', does: 'Editor search (Ctrl/Cmd+F): finds as you type and counts the matches.' },
  { key: 'diffs-container button[aria-label="Match Case"]', tag: 'button', at: 'js/vendor/pierre-diffs/edit.js:46', text: 'Match Case', does: 'Editor search: match case on or off.' },
  { key: 'diffs-container button[aria-label="Whole Word"]', tag: 'button', at: 'js/vendor/pierre-diffs/edit.js:46', text: 'Whole Word', does: 'Editor search: whole words only, on or off.' },
  { key: 'diffs-container button[aria-label="Regexp"]', tag: 'button', at: 'js/vendor/pierre-diffs/edit.js:46', text: 'Regexp', does: 'Editor search: the query as a regular expression, on or off.' },
  { key: 'diffs-container button[aria-label="Next"]', tag: 'button', at: 'js/vendor/pierre-diffs/edit.js:46', text: 'Next', does: 'Editor search: the next match.' },
  { key: 'diffs-container button[aria-label="Previous"]', tag: 'button', at: 'js/vendor/pierre-diffs/edit.js:46', text: 'Previous', does: 'Editor search: the previous match.' },
  { key: 'diffs-container button[data-replace-toggle]', tag: 'button', at: 'js/vendor/pierre-diffs/edit.js:46', text: 'Replace', does: 'Editor search: shows or hides Replace.' },
  { key: 'diffs-container input[data-replace]', tag: 'input', at: 'js/vendor/pierre-diffs/edit.js:46', text: 'Replace with', does: 'Editor search: what replaces each match.' },
  { key: 'diffs-container button[aria-label="Replace"]', tag: 'button', at: 'js/vendor/pierre-diffs/edit.js:46', text: 'Replace', does: 'Editor search: replaces the current match.' },
  { key: 'diffs-container button[aria-label="Replace All"]', tag: 'button', at: 'js/vendor/pierre-diffs/edit.js:46', text: 'Replace All', does: 'Editor search: replaces every match.' },
  { key: 'diffs-container button[data-search-close]', tag: 'button', at: 'js/vendor/pierre-diffs/edit.js:46', text: 'Close', does: 'Editor search: closes it; focus goes back to the text.' },
  { key: '#mx-return', tag: 'button', at: 'js/app.js:2503', text: 'Back to where you were', does: 'Back to where you were: brings the message you left from into view, and focus to it.' },
  { key: 'button.mx-r-x', tag: 'button', at: 'js/msgx.js:482', text: '×', does: 'Takes the reply off the message you\'re writing (Esc too).' },
  { key: 'button.mx-qpop', tag: 'button', at: 'js/msgx.js:549', text: 'Reply to this', does: 'Reply to this: quotes the words you selected in a message.' },
  { key: 'xo-select .dd-btn', tag: 'button', at: 'js/dropdown.js:59', text: '', does: 'A dropdown: opens its list; arrows and typing pick, Enter keeps, Esc closes.' },
  { key: 'xo-select .dd-row', tag: 'div', at: 'js/dropdown.js:139', text: '', does: 'A dropdown\'s option: the pointer and the arrows move to it; Enter or a click picks it.' },
  { key: 'diffs-container [contenteditable]', tag: 'div', at: 'js/viewer.js:308', text: '', does: 'The file\'s text in Edit (the diff library\'s editor): where you type.' },
  { key: 'button.xd-mbtn', tag: 'button', at: 'js/diffview.js:164', text: 'Keep yours / Take the agent\'s / Keep both', does: 'A merge: keeps yours, the agent\'s, or both, for that place.' },
  // Launchpad's next steps, drawn from Space's action (data-lp="${…}" in actionHtml and rec(), so the scan sees only
  // the hook), and the links out of the panel (no data- hook to name them by), and the Shells grip (a separator):
  // the 11 families Astra's inventory check on 43f400e found missing (its LPX01–LPX17). aliases: each family's
  // other drawings, under the selectors Astra's cases use
  { key: 'button[data-lp=settings]', tag: 'button', at: 'js/launchpad.js:373', text: 'Change the settings / Pick another name', does: 'Launchpad, a deploy\'s next step: back to its settings, focus on the field to change (the name, or the size).', aliases: ['LPX01-settings'] },
  { key: 'button[data-lp=create-repo]', tag: 'button', at: 'js/launchpad.js:373', text: 'Create the private repo', does: 'Launchpad, a deploy\'s next step: deploys again, creating the private repository on GitHub (3 s to Undo first).', aliases: ['LPX02-create-repo'] },
  { key: 'button[data-lp=link-same]', tag: 'button', at: 'js/launchpad.js:373', text: 'Link it', does: 'Launchpad, a deploy\'s next step: links the app Launchpad already has under this name; Deploy is next.', aliases: ['LPX03-link-same'] },
  { key: 'button[data-lp=ask-fix]', tag: 'button', at: 'js/launchpad.js:519', text: 'Ask an agent', does: 'Launchpad, a failed deploy: starts a new thread where an agent reads the log and fixes the cause (one thread per ask).', aliases: ['LPX04-ask-fix'] },
  { key: 'button[data-lp=recreate]', tag: 'button', at: 'js/launchpad.js:502', text: 'Create it again', does: 'Launchpad: creates the app again from the same repository with the same settings (3 s to Undo first).', aliases: ['LPX05-recreate'] },
  { key: 'button[data-lp=fix-port]', tag: 'button', at: 'js/launchpad.js:523', text: 'Use port …', does: 'Launchpad, a failed deploy: deploys again on the port the image listens on (3 s to Undo first).', aliases: ['LPX06-fix-port'] },
  { key: 'a.lpm-host', tag: 'a', at: 'js/launchpad.js:337', text: 'the app\'s address', does: 'Launchpad: opens the live app in a new tab (its address, or its Open it icon, wherever the panel shows it).', aliases: ['LPX10-open-host', 'a.lp-hh', 'LPX07-folded-host', '.lpm-addr a.lp-ib', 'LPX09-open-icon', '.lp-ha a.fr-ib', 'LPX13-head-open-icon', '.lpv-addr a.lp-ib', 'LPX14-wide-open-icon'] },
  { key: 'a.lp-ln', tag: 'a', at: 'js/launchpad.js:294', text: 'Logs', does: 'Launchpad: opens the build\'s log in a new tab (Logs, Logs on GitHub, Open the build log).', aliases: ['.lpm a.lp-ln', 'LPX08-build-log', '.lpv a.lp-ln', 'LPX17-wide-build-log', '.lp-or a.lp-b', 'LPX16-failed-build-log', '.lp-acts a.lp-go'] },
  { key: '.lp-acts a.lp-b', tag: 'a', at: 'js/launchpad.js:511', text: 'Open in Launchpad', does: 'Launchpad: opens the app on Launchpad itself in a new tab.', aliases: ['LPX11-launchpad-link'] },
  { key: 'a.lp-go.lp-wide', tag: 'a', at: 'js/launchpad.js:573', text: 'Open GitHub', does: 'Launchpad, connecting GitHub: opens GitHub\'s device page in a new tab, where the code goes.', aliases: ['LPX12-device-link'] },
  { key: 'div.shd-grip', tag: 'div', at: 'js/shells/dock.js:57', text: '', does: 'Shells: resizes the shells panel (drag it, or ↑ ↓ on it).', aliases: ['.shd-grip', 'LPX15-shell-resize'] },
];
for (const m of MANUAL) if (!sourceKinds.has(m.key)) sourceKinds.set(m.key, { ...m });
// a code kind is reached when a rendered kind of the same tag carries all its hooks (with the same value where it has one)
const reached = (sk) => {
  if (groups.has(sk.key)) return groups.get(sk.key);
  if (sk.key.startsWith('button.') && groups.has(sk.key)) return groups.get(sk.key);
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
// IDs: a rendered kind keeps the ID it had; one without, reached from a code kind that had an S-ID in 3a9cdca,
// takes that S-ID (a code-only row that became rendered keeps its grade); only then are new IDs appended
// a code kind's 3a9cdca key was its tag and first data- hook (or its #id)
const legacySrc = (sk) => [sk.key.startsWith('#') ? sk.key : `${sk.tag}[${tokensOf(sk.key)[0].split('=')[0]}]`, sk.firstData ? `${sk.tag}[${sk.firstData}]` : ''].filter(Boolean);
// exact keys first (so a general key keeps its ID before any split one asks), then the 3a9cdca aliases
for (const g of groups.values()) g.id = exactId(g.k);
for (const sk of sourceKinds.values()) if (!reached(sk)) sk.id = exactId(sk.key);
for (const g of groups.values()) if (!g.id) g.id = existingId(g.k, [...g.legacy]);
for (const sk of sourceKinds.values()) { const g = reached(sk); if (g && !g.id) g.id = existingId(sk.key, legacySrc(sk)); }
for (const g of groups.values()) if (!g.id) g.id = idFor(g.k, 'C', []);
const codeOnly = [];
for (const sk of sourceKinds.values()) {
  if (reached(sk)) continue;
  if (!sk.id) sk.id = idFor(sk.key, 'S', legacySrc(sk));
  codeOnly.push(sk);
}
// a manual kind's other drawings, recorded as aliases of its ID (append-only, like the IDs)
for (const m of MANUAL) if (m.aliases) { const id = byKey.get(m.key); if (id && reg.ids[id]) reg.ids[id].aliases = [...new Set([...(reg.ids[id].aliases || []), ...m.aliases])]; }
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
const emitted = new Set([...groups.values()].map((g) => g.id).concat(codeOnly.map((sk) => sk.id)));
const unseen = Object.entries(reg.ids).filter(([id]) => !emitted.has(id)).sort((a, b) => a[0].localeCompare(b[0]));
let rowsGone = 0;
if (unseen.length) {
  body.push('', '## Rows from before that this crawl and scan didn\'t show', '', 'Kinds with an ID that neither this crawl nor the template scan produced this time: a control that shows only in some states (an agent working, a scrolled-up chat), or one now listed under a more exact row. Their IDs and grades stay; each still needs checking where it shows.', '', '| ID | Key | Does | Status |', '|---|---|---|---|');
  for (const [id, e] of unseen) { rowsGone++; body.push(`| ${id} | \`${e.key.replace(/\|/g, '/')}\` | ${doesOf(e.key) || doesOf((e.aliases || [])[0] || '') || '**?**'} | ${status[id] || 'Unchecked'} |`); }
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
  ['F-G9', 'A late conflict while you type', 'The editor goes; focus goes to the explanation (only if you were in the editor), and keys you go on typing can\'t choose an answer', 'flows.test.cjs G9 at 1440 and 390'],
];
for (const [id, f, d, l] of FLOWS) { rowsF++; body.push(`| ${id} | ${f} | ${d} | ${l} | ${status[id] || 'Failing until Astra passes it'} |`); }

const obsD = desk ? desk.controls.length : 0, obsP = phone ? phone.controls.length : 0, obsM = mock ? mock.controls.length : 0;
const failedPlaces = (d) => (d ? d.states.filter((s) => s.error).map((s) => s.state) : []);
const fd = failedPlaces(desk).concat(failedPlaces(mock).map((s) => 'mock: ' + s)), fp = failedPlaces(phone);
out.push('# Every control, and how it answers', '');
out.push('**Not complete yet.** Astra grades every row on its own; a row counts as done only once Astra has passed it.', '');
out.push(`Built from the rendered app and the code, not from memory: \`tools/inventory.cjs\` crawls the real app read-only (${desk ? `${desk.states.length} places at 1440 px, crawled ${desk.at}` : 'no 1440 crawl'}${phone ? `; ${phone.states.length} at 390 px, crawled ${phone.at}` : ''}), and \`tools/controls-md.cjs\` groups what it saw into kinds, words each kind, points at its handler and adds the kinds only the code shows. Regenerate: \`node tools/inventory.cjs dark 1440 && node tools/inventory.cjs dark 390 && node tools/controls-md.cjs\`.`, '');
out.push(`**In this file:** ${rowsC} rendered kinds, ${rowsS} kinds only in the code, ${rowsGone} kinds from before not shown this time, ${rowsF} flow rows (${rowsC + rowsS + rowsGone + rowsF} rows); ${obsD + obsP + obsM} observations behind the rendered rows (${obsD} in the real app at 1440, ${obsP} at 390, and ${obsM} in ${mock ? mock.states.length : 0} states opened in the test suite's mock world at 1440, marked "mock:" where they show).`, '');
out.push(fd.length || fp.length ? `**Places the crawl couldn't reach**, so their controls aren't measured here: ${[fd.length ? `1440: ${fd.join(', ')}` : '', fp.length ? `390: ${fp.join(', ')}` : ''].filter(Boolean).join('; ')}.` : '**Every place in the crawl was reached** at both widths.', '');
out.push('Row IDs come from `controls-ids.json`, a committed registry from each kind\'s canonical key to its ID: IDs are only appended, never renumbered, so a grade stays on its control. **Hover**, **Press** and **Focus ring** say whether the control (or its box, its parts, its pseudo-elements) visibly changes when the pointer is over it, while pressed, and when the keyboard focuses it: `no` was measured on the attached control; `–` was not measured (not focusable, or it never took focus there). Hover and press are measured at 1440 only (390 is touch). **Handler** is the first line in js/ that names the hook in an event path: a pointer to check, not proof. **Status** is Astra\'s.', '');
fs.writeFileSync(DRY ? '/tmp/CONTROLS.dry.md' : path.join(DIR, 'CONTROLS.md'), out.concat(body).join('\n') + '\n');
console.log(`C ${rowsC}, S ${rowsS}, kept ${rowsGone}, F ${rowsF}, observations ${obsD + obsP + obsM} (${obsD}+${obsP}+${obsM}); places not reached: ${fd.length}+${fp.length}; without words: ${noWords.length}`, noWords.slice(0, 60));
