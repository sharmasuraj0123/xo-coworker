// Drive the UI against xo-space's real project-file API on its sandbox (:5092 behind a serve.py of this
// branch on SANDBOX, default :5263, started with QUIRQ_STATE_ROOT=/tmp/pierre-side/state so it sends the
// sandbox's writer key). The app itself runs on the normal backend; only the project-file routes of one
// thread are answered by the sandbox, its project and worktree names swapped both ways in paths, queries,
// bodies and answers. Saves change only the sandbox (xo-space's permission, 5 Nov).
//   const S = require('./sandbox.cjs'); await S.route(page, { thread: 'cmsg_…' })
const SANDBOX = process.env.SANDBOX || 'http://127.0.0.1:5263';
exports.route = async (page, { project = 'xo-coworker', thread, to = { project: 'demo', worktree: 'thread-demo' } } = {}) => {
  const wt = `thread-${thread}`;
  const there = (t) => t.split(`/xo-projects/${project}/`).join(`/xo-projects/${to.project}/`).split(wt).join(to.worktree);
  const back = (t) => t.split(`"project_id":"${to.project}"`).join(`"project_id":"${project}"`).split(to.worktree).join(wt);
  const log = [];
  await page.route(new RegExp(`/api/xo-projects/${project}/(changes|file|tree|edits|download|image)`), async (r) => {
    const req = r.request(), u = new URL(req.url());
    if (!u.search.includes(wt) && !(req.postData() || '').includes(wt) && !/\/edits\//.test(u.pathname)) return r.fallback();
    const url = SANDBOX + there(u.pathname + u.search);
    const body = req.postData();
    const res = await fetch(url, { method: req.method(), headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? there(body) : undefined });
    const text = await res.text();
    log.push(`${req.method()} ${u.pathname.replace(/.*xo-projects\/[^/]+/, '')} ${res.status}`);
    return r.fulfill({ status: res.status, contentType: res.headers.get('content-type') || 'application/json', body: back(text) });
  });
  return log;
};
