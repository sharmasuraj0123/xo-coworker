// Astra's P3 phone findings, re-measured without writing anywhere: saves are answered in the browser (a 409
// for a file deleted while you edit, then a 200), reads come from the sandbox (sandbox.cjs). At 390 × 844:
// the head keeps Cancel and Save on screen with the error under it; the Saved toast's close is 28 × 28 and
// the file's name reads whole.
//   THREAD=cmsg_deadce65e4fe4027 node tools/diffview/p3phone.cjs <base url>
const H = require('./panel.cjs');
const S = require('./sandbox.cjs');
(async () => {
  for (const theme of ['dark', 'light']) {
    const { browser, page, log } = await H.open(theme, { width: 390, height: 844, dpr: 3, mobile: true, ls: { 'xo-stage': JSON.stringify({ open: true }) } });
    await S.route(page, { thread: process.env.THREAD || 'cmsg_deadce65e4fe4027' });
    let answer = 'gone';
    await page.route(/\/api\/xo-projects\/[^/]+\/file$/, (r) => {
      if (r.request().method() !== 'PUT') return r.fallback();
      if (answer === 'gone') return r.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ detail: { code: 'file_changed', message: 'The file changed.', current: null } }) });
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ relative_path: 'x', version: 'sha256:fake', size_bytes: 10, saved_at: new Date().toISOString(), edit_id: 'e_fake', unchanged: false }) });
    });
    await H.thread(page); await H.panel(page);
    await page.evaluate(() => [...document.querySelectorAll('#stage .cx-r')].find((r) => /crlf\.txt/.test(r.innerText))?.click());
    await page.waitForTimeout(600);
    await page.evaluate(() => document.querySelector('[data-cx-open]')?.click());
    await page.waitForTimeout(1500);
    await page.evaluate(() => document.querySelector('[data-vw-show="file"]')?.click());
    await page.waitForTimeout(1500);
    await page.evaluate(() => document.querySelector('[data-vw-edit]')?.click());
    await page.waitForFunction(() => document.querySelector('[data-vw-saveit]'), null, { timeout: 8000 });
    await page.waitForTimeout(300);
    await page.keyboard.type('x');
    await page.evaluate(() => document.querySelector('[data-vw-saveit]').click());
    await page.waitForFunction(() => document.querySelector('.xd-errline'), null, { timeout: 5000 });
    await page.waitForTimeout(300);
    const err = await page.evaluate(() => {
      const vw = document.querySelector('.viewer').getBoundingClientRect(), top = document.querySelector('.vw-top').getBoundingClientRect();
      const r = (s) => { const e = document.querySelector(s)?.getBoundingClientRect(); return e && { l: Math.round(e.left), r: Math.round(e.right), w: +e.width.toFixed(2) }; };
      const line = document.querySelector('.xd-errline'), lr = line.getBoundingClientRect(), span = line.querySelector('span');
      return { head: `${Math.round(top.width)} of ${Math.round(vw.width)}`, cancel: r('[data-vw-cancel]'), save: r('[data-vw-saveit]'), inView: r('[data-vw-saveit]').r <= vw.right, line: `${Math.round(lr.width)}×${Math.round(lr.height)}`, clipped: span.scrollWidth > span.clientWidth + 1, text: line.innerText };
    });
    await page.screenshot({ path: `/tmp/p3-phone-error-${theme}.png` });
    answer = 'ok';
    await page.evaluate(() => document.querySelector('[data-vw-saveit]').click());
    await page.waitForFunction(() => document.querySelector('.xd-toast .toast'), null, { timeout: 5000 });
    await page.waitForTimeout(400);
    const toast = await page.evaluate(() => {
      const t = document.querySelector('.xd-toast .toast').getBoundingClientRect(), x = document.querySelector('.xd-tx').getBoundingClientRect();
      const name = document.querySelector('.xd-toast .t-m'), vw = document.querySelector('.viewer').getBoundingClientRect();
      return { toast: `${Math.round(t.width)}×${Math.round(t.height)}`, inView: t.left >= vw.left && t.right <= vw.right, close: `${+x.width.toFixed(2)}×${+x.height.toFixed(2)}`, nameWhole: name.scrollWidth <= name.clientWidth + 1, text: document.querySelector('.xd-toast').innerText.replace(/\s+/g, ' ') };
    });
    await page.screenshot({ path: `/tmp/p3-phone-toast-${theme}.png` });
    console.log(theme, JSON.stringify({ err, toast, errors: log.errors }));
    await browser.close();
  }
})().catch((e) => { console.error(e); process.exit(1); });
