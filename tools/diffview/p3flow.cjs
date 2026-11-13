// P3 end to end against xo-space's real project-file API, on its sandbox (sandbox.cjs): Edit → Save → Saved ·
// Undo; a file the agent changed meanwhile (merged without a clash, then with one, in the merge view); a file
// that runs code (asks once); a place XO keeps (read only). "The agent" is this script writing the sandbox's
// file on disk, as an agent's tool would. Every save goes to the sandbox only.
//   THREAD=cmsg_deadce65e4fe4027 node tools/diffview/p3flow.cjs http://127.0.0.1:5262/ /tmp/p3 [theme]
const H = require('./panel.cjs');
const S = require('./sandbox.cjs');
const fs = require('node:fs');
const path = require('node:path');
const DIR = process.argv[3] || '/tmp/p3';
const THEME = process.argv[4] || 'dark';
const WT = '/tmp/pierre-side/projects/demo/.xo/worktrees/thread-demo';
fs.mkdirSync(DIR, { recursive: true });
const shot = (page, name) => page.screenshot({ path: path.join(DIR, `p3-${name}-${THEME}.png`) });
const wait = (page, fn, arg, ms = 8000) => page.waitForFunction(fn, arg, { timeout: ms });
const head = (page) => page.evaluate(() => document.querySelector('.vw-top')?.innerText.replace(/\s+/g, ' ').trim());

async function openFile(page, rel) {
  // through the tree: its folders, then the file (hidden ones included)
  const parts = rel.split('/');
  for (let i = 0; i < parts.length - 1; i++) {
    const dir = parts.slice(0, i + 1).join('/');
    await page.evaluate((d) => { const b = document.querySelector(`[data-fl-dir="${d}"]`); if (b && b.getAttribute('aria-expanded') !== 'true') b.click(); }, dir);
    await page.waitForTimeout(700);
  }
  await page.evaluate((f) => document.querySelector(`[data-fl-file="${f}"]`)?.click(), rel);
  await wait(page, (n) => document.querySelector('.vw-top h2')?.textContent === n && !document.querySelector('.vw-body .spin'), rel.split('/').pop());
  await page.waitForTimeout(700);
}
async function edit(page, line, text) {
  await page.evaluate(() => document.querySelector('[data-vw-edit]').click());
  await wait(page, () => document.querySelector('.vw-top [data-vw-saveit]'));
  await page.waitForTimeout(400);
  const at = await page.evaluate((n) => { const r = document.querySelector('.vw-file diffs-container')?.shadowRoot?.querySelector(`[data-line="${n}"]`)?.getBoundingClientRect(); return r && { x: r.x + 4, y: r.y + r.height / 2 }; }, line);
  await page.mouse.click(at.x, at.y);
  await page.keyboard.press('Home');
  await page.keyboard.type(text);
  await page.waitForTimeout(300);
}

(async () => {
  const out = {};
  const keep = { crlf: fs.readFileSync(path.join(WT, 'crlf.txt')), server: fs.readFileSync(path.join(WT, 'server.py')), skill: fs.readFileSync(path.join(WT, '.agents/skills/code-writer/SKILL.md')) };
  const { browser, page, log } = await H.open(THEME, { dpr: 2, ls: { 'xo-stage': JSON.stringify({ open: false }) } });
  const slog = await S.route(page, { thread: process.env.THREAD || 'cmsg_deadce65e4fe4027' });
  try {
    await H.thread(page);
    await page.evaluate(() => document.querySelector('[data-stage-toggle]')?.click());
    await page.waitForTimeout(1500);
    out.panel = await page.evaluate(() => [...document.querySelectorAll('#stage .cx-r')].map((r) => r.innerText.replace(/\s+/g, ' ').trim()));
    await shot(page, 'panel-real');
    await page.evaluate(() => [...document.querySelectorAll('#stage .cx-r')].find((r) => /crlf\.txt/.test(r.innerText))?.click());
    await page.waitForTimeout(600);
    await page.evaluate(() => document.querySelector('[data-cx-open]')?.click());
    await page.waitForTimeout(1500);
    await page.evaluate(() => document.querySelector('[data-vw-show="file"]')?.click());
    await wait(page, () => document.querySelector('.vw-file diffs-container')?.shadowRoot?.querySelector('[data-line]'));
    await page.waitForTimeout(600);

    // 1 · edit, save, undo (a CRLF file: its endings come back as they were)
    out.viewHead = await head(page);
    await edit(page, 1, 'NEW ');
    out.editHead = await head(page);
    await shot(page, 'editing');
    await page.keyboard.press('Control+s');
    await wait(page, () => document.querySelector('.xd-toast'));
    out.savedToast = await page.evaluate(() => document.querySelector('.xd-toast')?.innerText.replace(/\s+/g, ' ').trim());
    out.savedOnDisk = JSON.stringify(fs.readFileSync(path.join(WT, 'crlf.txt'), 'utf8'));
    await shot(page, 'saved');
    await page.evaluate(() => document.querySelector('[data-vw-undo]').click());
    await page.waitForTimeout(1500);
    out.undoneOnDisk = JSON.stringify(fs.readFileSync(path.join(WT, 'crlf.txt'), 'utf8'));
    out.undoneMatches = fs.readFileSync(path.join(WT, 'crlf.txt')).equals(keep.crlf);

    // 2 · the agent changed another line while you edited: both kept, no question
    await wait(page, () => document.querySelector('[data-vw-edit]'));
    await edit(page, 1, 'MINE ');
    fs.writeFileSync(path.join(WT, 'crlf.txt'), keep.crlf.toString('utf8').replace('CRLF file', 'CRLF file (agent)'));
    await page.keyboard.press('Control+s');
    await wait(page, () => document.querySelector('.xd-toast'));
    out.mergedToast = await page.evaluate(() => document.querySelector('.xd-toast')?.innerText.replace(/\s+/g, ' ').trim());
    out.mergedOnDisk = JSON.stringify(fs.readFileSync(path.join(WT, 'crlf.txt'), 'utf8'));
    fs.writeFileSync(path.join(WT, 'crlf.txt'), keep.crlf);
    await page.evaluate(() => document.querySelector('[data-vw-toastx]')?.click());

    // 3 · the agent changed the same line: the merge view, you choose
    await page.evaluate(() => document.querySelector('[data-fv-back]')?.click());
    await page.waitForTimeout(600);
    await page.evaluate(() => document.querySelector('[data-cx-open]')?.click());
    await page.waitForTimeout(1200);
    await page.evaluate(() => document.querySelector('[data-vw-show="file"]')?.click());
    await wait(page, () => document.querySelector('.vw-file diffs-container')?.shadowRoot?.querySelector('[data-line]'));
    await page.waitForTimeout(500);
    await edit(page, 1, 'MINE ');
    fs.writeFileSync(path.join(WT, 'crlf.txt'), keep.crlf.toString('utf8').replace('line', 'AGENT line'));
    await page.keyboard.press('Control+s');
    await wait(page, () => document.querySelector('.xd-merge'), null, 10000);
    await page.waitForTimeout(600);
    out.conflictHead = await head(page);
    out.conflictBar = await page.evaluate(() => document.querySelector('.xd-bar')?.innerText);
    await shot(page, 'conflict');
    await page.evaluate(() => document.querySelector('.xd-merge .xd-mbtn.is-mine').click());
    await page.waitForTimeout(500);
    out.resolvedHead = await head(page);
    await page.evaluate(() => document.querySelector('[data-vw-saveit]').click());
    await wait(page, () => document.querySelector('.xd-toast'));
    out.resolvedOnDisk = JSON.stringify(fs.readFileSync(path.join(WT, 'crlf.txt'), 'utf8'));
    fs.writeFileSync(path.join(WT, 'crlf.txt'), keep.crlf);
    await page.evaluate(() => document.querySelector('[data-vw-toastx]')?.click());

    // 4 · a file that runs code: marked before you edit, asked once when you save
    await openFile(page, '.agents/skills/code-writer/SKILL.md');
    out.runsHead = await head(page);
    await page.evaluate(() => document.querySelector('[data-vw-mode="source"]')?.click());
    await page.waitForTimeout(800);
    await edit(page, 1, '');
    await page.keyboard.press('End'); await page.keyboard.type(' ');
    await page.keyboard.press('Control+s');
    await wait(page, () => document.querySelector('.xd-pop'));
    await page.waitForTimeout(450);
    out.confirm = await page.evaluate(() => document.querySelector('.xd-pop')?.innerText.replace(/\s+/g, ' ').trim());
    await shot(page, 'runs-confirm');
    await page.keyboard.press('Control+s'); // ⌘S again in the open popover means Save
    await wait(page, () => document.querySelector('.xd-toast'));
    out.runsSaved = !fs.readFileSync(path.join(WT, '.agents/skills/code-writer/SKILL.md')).equals(keep.skill);
    fs.writeFileSync(path.join(WT, '.agents/skills/code-writer/SKILL.md'), keep.skill);

    // 5 · a place XO keeps: read only, said in words, no Edit
    await openFile(page, '.git');
    out.readOnlyHead = await head(page);
    out.noEdit = await page.evaluate(() => !document.querySelector('[data-vw-edit]'));
    await shot(page, 'read-only');
  } finally {
    for (const [f, b] of [['crlf.txt', keep.crlf], ['server.py', keep.server], ['.agents/skills/code-writer/SKILL.md', keep.skill]]) fs.writeFileSync(path.join(WT, f), b);
    console.log(JSON.stringify({ ...out, sandbox: slog, blocked: log.blocked, errors: log.errors }, null, 1));
    await browser.close();
  }
})().catch((e) => { console.error(e); process.exit(1); });
