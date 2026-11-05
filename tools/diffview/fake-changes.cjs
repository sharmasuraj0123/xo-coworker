// A stand-in for Space's GET /api/xo-projects/{p}/changes, for the browser harness until xo-space ships the
// route: the agreed shape (design-research/2026-11-vision/pierre/README.md, "What Space has agreed"), worked
// out by git from a real folder, so the UI is driven by real patches. Never served by the app; the harness
// answers the page's request with it (page.route).
//
//   changesFor(dir, base, {root, path}) → the JSON body
const { execFileSync } = require('node:child_process');
const git = (dir, args, opts = {}) => execFileSync('git', ['-c', 'core.quotePath=false', ...args], { cwd: dir, encoding: 'utf8', maxBuffer: 1 << 28, ...opts });
const DIFF = ['diff', '-M', '--no-relative', '--no-color', '--no-ext-diff', '--no-textconv', '--src-prefix=a/', '--dst-prefix=b/'];

exports.changesFor = (dir, base, { root = '', path = null, budget = 4 << 20 } = {}) => {
  const baseCommit = git(dir, ['rev-parse', base]).trim();
  const head = git(dir, ['rev-parse', 'HEAD']).trim();
  const z = git(dir, [...DIFF, '--numstat', '-z', baseCommit, ...(path ? ['--', path] : [])]).split('\0');
  const files = [];
  for (let i = 0; i < z.length;) {
    const rec = z[i++];
    if (!rec) continue;
    const [a, d, p] = rec.split('\t');
    let old = null, now = p;
    if (p === '') { old = z[i++]; now = z[i++]; } // a rename: "a\td\t" then old and new paths
    const binary = a === '-';
    files.push({ path: now, ...(old ? { old_path: old } : {}), additions: binary ? null : +a, deletions: binary ? null : +d, binary, version: null, patch: null });
  }
  const st = git(dir, [...DIFF, '--name-status', '-z', baseCommit, ...(path ? ['--', path] : [])]).split('\0');
  for (let i = 0; i < st.length;) {
    const s = st[i++];
    if (!s) continue;
    const p = s[0] === 'R' || s[0] === 'C' ? (i++, st[i++]) : st[i++];
    const f = files.find((x) => x.path === p);
    if (f) f.status = { A: 'added', M: 'modified', D: 'deleted', R: 'renamed', T: 'type_changed' }[s[0]] || 'modified';
  }
  let used = 0;
  for (const f of files) {
    if (f.binary) { f.patch_omitted = 'binary'; continue; }
    const patch = git(dir, [...DIFF, '-p', baseCommit, '--', ...(f.old_path ? [f.old_path] : []), f.path]);
    if (!path && used + patch.length > budget) { f.patch_omitted = 'response_budget'; continue; }
    used += patch.length;
    f.patch = patch;
  }
  return { root, base_ref: 'main', base_commit: baseCommit, head_commit: head, computed_at: new Date().toISOString(), truncated: false, total_files: files.length, files };
};
