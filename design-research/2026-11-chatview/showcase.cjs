// The chat view's showcase: one question and one agent reply that holds everything a working notebook needs
// (math inline and display, code, a table, a chart, a diagram, a picture), on the browser suite's mock world
// (nothing reaches a Space). Shoots it in the document view and in bubbles, dark and light, 1440×900 and 390×844.
//   node design-research/2026-11-chatview/showcase.cjs [out-dir]
// env: VIEWS=doc,bubbles  THEMES=dark,light  WIDTHS=1440,390  AT=top|latest  TALL=<viewport height> (the whole reply)
"use strict";
const fs = require("fs"), path = require("path"), zlib = require("zlib");
const PW = process.env.PLAYWRIGHT_CORE || "/tmp/pw/node_modules/playwright-core";
const { chromium } = require(PW);
const H = require("../../tests/browser/harness.cjs");

const OUT = path.resolve(process.argv[2] || path.join(__dirname, "shots"));
fs.mkdirSync(OUT, { recursive: true });

// a small picture made here (a soft gradient with a curve), served for the reply's web image
function png(w, h) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0;
    for (let x = 0; x < w; x++) {
      const i = y * (w * 3 + 1) + 1 + x * 3, t = x / w, s = y / h;
      const wave = Math.abs(s - (0.55 - 0.28 * Math.sin(t * Math.PI * 2.2) * Math.exp(-t * 1.2))) < 0.012;
      raw[i] = wave ? 250 : Math.round(24 + 60 * t + 30 * s);
      raw[i + 1] = wave ? 250 : Math.round(40 + 90 * (1 - s) * (0.4 + 0.6 * t));
      raw[i + 2] = wave ? 250 : Math.round(70 + 120 * (1 - t) * (1 - s * 0.5));
    }
  }
  const crc = (b) => { let c, k, r = ~0; for (const x of b) { c = (r ^ x) & 255; for (k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; r = (r >>> 8) ^ c; } return ~r >>> 0; };
  const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ih), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}
const PIC = png(960, 540);

const REPLY = String.raw`Here's the damped oscillator worked through, with the fit from your run.

The displacement is $x(t) = A e^{-\gamma t}\cos(\omega_d t + \varphi)$, where the damped frequency is $\omega_d = \sqrt{\omega_0^2 - \gamma^2}$. The energy decays as

$$
E(t) = \tfrac{1}{2} k A^2 e^{-2\gamma t}, \qquad Q = \frac{\omega_0}{2\gamma} \approx 14.1
$$

## Fit

` + "```python" + String.raw`
import numpy as np
from scipy.optimize import curve_fit

def model(t, A, gamma, wd, phi):
    return A * np.exp(-gamma * t) * np.cos(wd * t + phi)

params, _ = curve_fit(model, t, x, p0=[1.0, 0.1, 2.0, 0.0])
print(f"gamma = {params[1]:.3f} s^-1")  # gamma = 0.071 s^-1
` + "```" + String.raw`

| Parameter | Fitted | Expected | Error |
|---|--:|--:|--:|
| $A$ (m) | 0.982 | 1.000 | 1.8% |
| $\gamma$ (s⁻¹) | 0.071 | 0.070 | 1.4% |
| $\omega_d$ (rad/s) | 1.998 | 2.000 | 0.1% |

` + "```chart" + `
{"type": "line", "title": "Amplitude envelope over time", "x": {"label": "t (s)", "values": [0, 5, 10, 15, 20, 25, 30, 35, 40]},
 "y": {"label": "amplitude (m)"},
 "series": [{"name": "Measured", "values": [0.98, 0.69, 0.48, 0.34, 0.24, 0.17, 0.12, 0.085, 0.06]},
            {"name": "Model", "values": [1.0, 0.70, 0.49, 0.35, 0.24, 0.17, 0.12, 0.083, 0.058]}]}
` + "```" + `

` + "```mermaid" + `
flowchart LR
  A[Raw samples] --> B{Detrend}
  B --> C[Fit envelope]
  B --> D[FFT peak]
  C --> E((Q factor))
  D --> E
` + "```" + `

![The measured trace](https://pictures.example.test/trace.png)

The fit is within 2% on every parameter, so the spring constant from the earlier step holds.`;

const MSGS = [
  { id: "q1", seq: 1, chat_id: "chat_demo", thread_ts: null, author_kind: "owner", author_id: "owner", author_session_id: null, text: "Can you fit the damped oscillator from yesterday's run and show me how good the fit is?", reply_to: null, extra: {}, created_at: H.NOW },
  { id: "a1", seq: 2, chat_id: "chat_demo", thread_ts: null, author_kind: "agent", author_id: "project-coordinator", author_session_id: null, text: REPLY, reply_to: null, extra: {}, created_at: H.NOW },
];

(async () => {
  const VIEWS = (process.env.VIEWS || "doc,bubbles").split(","), THEMES = (process.env.THEMES || "dark,light").split(","), WIDTHS = (process.env.WIDTHS || "1440,390").split(",").map(Number);
  const browser = await H.launch(chromium);
  if (!browser) { console.error("no browser"); process.exit(2); }
  console.log("browser pid", browser._process?.pid ?? "?");
  const server = await H.serve();
  const BASE = `http://127.0.0.1:${server.address().port}`;
  const report = [];
  try {
    for (const view of VIEWS) for (const theme of THEMES) for (const width of WIDTHS) {
      const W = {
        messages: MSGS,
        beforeLoad: async (page) => {
          await page.context().addInitScript((v) => { try { localStorage.setItem("cv-bubbles", v === "bubbles" ? "on" : "off"); } catch { /* none */ } }, view);
          await page.route("https://pictures.example.test/**", (r) => r.fulfill({ status: 200, contentType: "image/png", body: PIC }));
        },
      };
      const tall = +(process.env.TALL || 0);
      const page = await H.openApp(browser, BASE, W, { width, height: tall || (width < 600 ? 844 : 900), theme, motion: false });
      await page.evaluate(() => { const st = window.__t.world.state; st.conn = "live"; st.error = null; st.statusError = null; window.__t.render(); window.__t.go("p:demo"); });
      await page.waitForFunction(() => document.querySelectorAll("#msgs .m").length >= 2, null, { timeout: 15000 });
      // the heavy renderers wait for a pause in input: give them it, and their modules time to load
      await page.waitForTimeout(+(process.env.SETTLE || 3500));
      const stat = await page.evaluate(() => ({
        msgx: document.documentElement.dataset.msgx,
        math: document.querySelectorAll("#msgs .katex").length,
        mathLeft: document.querySelectorAll("#msgs .md-math:not(.is-done)").length,
        chart: document.querySelectorAll("#msgs .md-chart svg").length,
        diagram: document.querySelectorAll("#msgs .md-diagram svg").length,
        img: [...document.querySelectorAll("#msgs img")].filter((i) => i.complete && i.naturalWidth).length,
        code: document.querySelectorAll("#msgs .md-code").length,
        // where opening landed, once everything was drawn: px left below the view (0 = at the latest)
        below: (() => { const s = document.getElementById("scroller"); return Math.round(s.scrollHeight - s.scrollTop - s.clientHeight); })(),
        hscroll: (() => { const s = document.getElementById("scroller"); return s.scrollWidth - s.clientWidth; })(),
      }));
      // the mock world has no live stream: say it's live, so the shot shows the conversation, not a connection notice
      await page.evaluate(() => { const st = window.__t.world.state; st.conn = "live"; st.error = null; st.statusError = null; window.__t.render(); });
      await page.waitForTimeout(400);
      const tag = `${view}-${theme}-${width}`;
      const at = process.env.AT || "both";
      if (at === "landed") await page.screenshot({ path: path.join(OUT, `${tag}-landed.png`) });
      if (at === "both" || at === "top") {
        await page.evaluate(() => { const s = document.getElementById("scroller"); s.scrollTop = 0; });
        await page.waitForTimeout(300);
        await page.screenshot({ path: path.join(OUT, `${tag}-top.png`) });
      }
      if (at === "both" || at === "latest") {
        await page.evaluate(() => { const s = document.getElementById("scroller"); s.scrollTop = s.scrollHeight; });
        await page.waitForTimeout(300);
        await page.screenshot({ path: path.join(OUT, `${tag}-latest.png`) });
      }
      if (process.env.FULL) {
        const full = await page.evaluate(() => { const s = document.getElementById("scroller"); return s.scrollHeight; });
        report.push({ tag, full });
      }
      report.push({ tag, ...stat, errors: page.errors });
      console.log(tag, JSON.stringify(stat), page.errors.length ? "ERR " + page.errors.join(" | ") : "");
      await page.context().close();
    }
  } finally {
    await browser.close();
    server.close();
  }
  fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
})().catch((e) => { console.error(e); process.exit(1); });
