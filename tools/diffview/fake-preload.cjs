// node -r tools/diffview/fake-preload.cjs <a QA probe>: the QA probes (qa-reports/2026-11-05/opus-tools)
// run with Space's /changes answered from real worktrees (fake-changes.cjs), so the chips carry their counts
// while the probe scrolls. QA_LIB names the probes' lib.cjs; WT_ROOT the worktrees' folder; BASE the git base.
const path = require('node:path');
const { changesFor } = require('./fake-changes.cjs');
const L = require(process.env.QA_LIB || '/home/coder/qa-reports/2026-11-05/opus-tools/lib.cjs');
const ROOT = process.env.WT_ROOT || '/home/coder/xo-coworker/.xo/worktrees';
const BASE = process.env.BASE || 'HEAD~3';
const open = L.open;
L.open = async (...a) => {
  const r = await open(...a);
  let n = 0;
  await r.page.route(/\/api\/xo-projects\/[^/]+\/changes(\?|$)/, (route) => {
    const u = new URL(route.request().url()), wt = u.searchParams.get('worktree');
    if (!wt) return route.fulfill({ status: 200, contentType: 'application/json', body: '{"root":"","files":[]}' });
    try { n++; return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(changesFor(path.join(ROOT, wt), BASE, { root: `.xo/worktrees/${wt}`, path: u.searchParams.get('path') })) }); }
    catch (e) { return route.fulfill({ status: 404, contentType: 'application/json', body: '{"detail":{"code":"no_such_worktree"}}' }); }
  });
  process.on('exit', () => console.error(`(fake /changes answered ${n} reads)`));
  return r;
};
