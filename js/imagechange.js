// An image in a place's changes (the owner, 6 Nov: "when I click on an image, it doesn't show there"). Git
// keeps no line diff for a picture, so Space sends it as binary with no patch, and the panel's Changes and
// Files' Changes view said only "Binary file". They show the image itself now:
//   · a new image: as it is (Space's /image, the working copy);
//   · a changed one: Before beside Now. Before is the file at /changes' base_commit, from the coworker
//     service's version route (xo-space, 6 Nov); Now is /image;
//   · a deleted one: Before;
//   · a renamed one: as it is, with the name it had.
// Where the version route isn't there yet (xo-space not restarted), or a version can't be read, the earlier
// version is said in words in place of Before. SVG is text and keeps its diff; any other binary file keeps
// "Binary file" and Download.
//
// changesframe.js (the panel) and viewer.js (Files) call drawImageChange; both ask isImageChange first.

import { esc } from "./util.js";
import { api } from "./api.js";

// Space's /image types, but SVG (a text file: it has a diff)
const SHOWN = /\.(png|jpe?g|gif|webp|avif|bmp|ico)$/i;
const EARLIER = "The earlier version can't be shown yet.";
const base = (p) => String(p || "").split("/").pop();
const size = (n) => (n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(1)} MB`);

/** A change Space sends without a patch because it's binary, to a picture a browser shows. */
export const isImageChange = (f) => !!f && (!!f.binary || f.patch_omitted === "binary") && SHOWN.test(String(f.path || ""));

/** What the change is, in words, and which versions it has: {what, before, now}. */
export function imageWords(f) {
  if (f.status === "added" || f.status === "untracked") return { what: "New image", before: false, now: true };
  if (f.status === "deleted") return { what: "Deleted image", before: true, now: false };
  if (f.status === "renamed") return { what: `Renamed from ${base(f.old_path)}`, before: false, now: true };
  return { what: "Changed image", before: true, now: true };
}

/** The version route answered with the server's own 404: it isn't there (xo-space not restarted yet). */
export const noRoute = (err) => !!err && err.status === 404 && err.code === "http_404";
// when it last wasn't there: Before isn't asked for again for a while, so the picture doesn't jump each time
let missingAt = 0;
const MISSING_FOR = 5 * 60 * 1000;

/** Why a version couldn't be shown, in words. */
function whyNot(err, which) {
  if (err && err.status === 413) return "Too large to show here (over 25 MB): download it to see it.";
  if (err && err.status === 404 && which === "before") return "The earlier version isn't in the repository.";
  if (err && err.status === 404) return "This image isn't there any more.";
  return which === "before" ? "Couldn't read the earlier version." : "Couldn't read this image.";
}

/**
 * Draw a change's image into host: the image fitted on a checkerboard (two, Before and Now, for a changed
 * one), and a line under it (what changed; each version's size in pixels and bytes; what can't be shown).
 * Read only now, when it's picked. at: /changes' base_commit (for Before). open: a click on an image (the
 * panel: Open in Files). Returns {drop()}, which stops reads on their way and lets the images' object URLs
 * go; call it before drawing anything else in host.
 */
export function drawImageChange(host, { project, rel, file, at = null, open = null }) {
  const w = imageWords(file), ctl = new AbortController(), urls = [];
  let gone = false;
  const sides = [w.before && at && Date.now() - missingAt > MISSING_FOR && "before", w.now && "now"].filter(Boolean);
  const note = w.before && !sides.includes("before") ? EARLIER : "";
  host.innerHTML = `<figure class="ximg${sides.length > 1 ? " is-two" : ""}" aria-label="${esc(`${w.what}: ${base(file.path)}`)}"><div class="ximg-row">` +
    (sides.length ? sides.map((k) => `<div class="ximg-c" data-side="${k}"><p class="ximg-say"><i class="spin" aria-hidden="true"></i>Reading…</p></div>`).join("")
      : `<div class="ximg-c"><p class="ximg-say">Nothing here to show: it was deleted.</p></div>`) +
    `</div><figcaption class="ximg-cap"><b>${esc(w.what)}</b>${sides.map((k) => `<span class="ximg-m" data-m="${k}"></span>`).join("")}` +
    `<span class="ximg-n"${note ? "" : " hidden"}>${esc(note)}</span></figcaption></figure>`;
  const fig = host.querySelector(".ximg");
  const two = () => fig.classList.contains("is-two");
  const label = (k) => (two() ? (k === "before" ? "Before" : "Now") : "");
  const metaText = {};
  const writeMeta = (k) => { const m = fig.querySelector(`[data-m="${k}"]`); if (m && metaText[k]) m.textContent = [label(k), metaText[k]].filter(Boolean).join(" "); };

  /** Before isn't there to show: the figure goes back to one picture, and says so. */
  function oneLess(words) {
    fig.querySelector('.ximg-c[data-side="before"]')?.remove();
    fig.querySelector('[data-m="before"]')?.remove();
    fig.classList.remove("is-two");
    for (const t of fig.querySelectorAll(".ximg-tag")) t.remove();
    if (!fig.querySelector(".ximg-c")) fig.querySelector(".ximg-row").innerHTML = `<div class="ximg-c"><p class="ximg-say">Nothing here to show: it was deleted.</p></div>`;
    const n = fig.querySelector(".ximg-n");
    n.textContent = words; n.hidden = false;
    writeMeta("now");
  }

  function show(k, blob) {
    const box = fig.querySelector(`.ximg-c[data-side="${k}"]`);
    if (!box) return;
    const url = URL.createObjectURL(blob);
    urls.push(url);
    metaText[k] = size(blob.size); writeMeta(k);
    const img = new Image();
    img.alt = `${label(k) || w.what}: ${base(file.path)}`;
    img.draggable = false;
    img.decoding = "async";
    img.onload = () => { if (gone) return; metaText[k] = `${img.naturalWidth} × ${img.naturalHeight} · ${size(blob.size)}`; writeMeta(k); };
    img.onerror = () => { if (!gone) box.innerHTML = `<p class="ximg-say">This image couldn't be shown: the file may be damaged, or in a format this browser can't read.</p>`; };
    img.src = url;
    const tag = two() ? `<span class="ximg-tag" aria-hidden="true">${label(k)}</span>` : "";
    if (open) {
      const b = document.createElement("button");
      b.type = "button"; b.className = "ximg-open"; b.title = "Open in Files"; b.setAttribute("aria-label", `Open ${base(file.path)} in Files`);
      b.addEventListener("click", () => open(b));
      b.append(img);
      box.replaceChildren(b);
    } else box.replaceChildren(img);
    if (tag) box.insertAdjacentHTML("afterbegin", tag);
  }

  for (const k of sides) {
    const read = k === "now"
      ? api.projectImage(project, rel, { signal: ctl.signal })
      : api.projectVersion(project, rel, { commit: at, was: file.status === "renamed" ? file.old_path : null }, { signal: ctl.signal });
    read.then((blob) => { if (!gone) show(k, blob); }).catch((err) => {
      if (gone || (err && err.name === "AbortError")) return;
      if (k === "before" && noRoute(err)) { missingAt = Date.now(); oneLess(EARLIER); return; }
      const box = fig.querySelector(`.ximg-c[data-side="${k}"]`);
      if (box) box.innerHTML = `<p class="ximg-say">${esc(whyNot(err, k))}</p>`;
    });
  }
  return { drop() { gone = true; ctl.abort(); for (const u of urls) URL.revokeObjectURL(u); urls.length = 0; } };
}
