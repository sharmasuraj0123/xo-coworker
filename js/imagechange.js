// An image in a place's changes (the owner, 6 Nov: "when I click on an image, it doesn't show there"). Git
// keeps no line diff for a picture, so Space sends it as binary with no patch, and the panel's Changes and
// Files' Changes view said only "Binary file". They show the image itself now, as it is in the place, read
// through Space's /image (the types a browser shows; SVG is text and keeps its diff). Space's /image reads
// only the working tree, so a changed image says the earlier version can't be shown yet, and a deleted one
// has nothing to show. Other binary files keep "Binary file" and Download.
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

/** What the change is, in words: {what, note, shows (there's an image in the place to show)}. */
export function imageWords(f) {
  if (f.status === "added" || f.status === "untracked") return { what: "New image", note: "", shows: true };
  if (f.status === "deleted") return { what: "Deleted image", note: EARLIER, shows: false };
  if (f.status === "renamed") return { what: `Renamed from ${base(f.old_path)}`, note: "", shows: true };
  return { what: "Changed image", note: EARLIER, shows: true };
}

/**
 * Draw a change's image into host: the image fitted on a checkerboard, and a line under it (what changed,
 * its size in pixels and bytes, and what can't be shown). Read only now, when it's picked. open: a click on
 * the image (the panel: Open in Files). Returns {drop()}, which stops a read on its way and lets the image's
 * object URL go; call it before drawing anything else in host.
 */
export function drawImageChange(host, { project, rel, file, open = null }) {
  const w = imageWords(file), ctl = new AbortController();
  let url = null, gone = false;
  host.innerHTML = `<figure class="ximg">` +
    `<div class="ximg-c">${w.shows ? `<p class="ximg-say"><i class="spin" aria-hidden="true"></i>Reading the image…</p>` : `<p class="ximg-say">Nothing here to show: it was deleted.</p>`}</div>` +
    `<figcaption class="ximg-cap"><b>${esc(w.what)}</b><span class="ximg-m"></span>${w.note ? `<span class="ximg-n">${esc(w.note)}</span>` : ""}</figcaption></figure>`;
  const box = host.querySelector(".ximg-c"), meta = host.querySelector(".ximg-m");
  const say = (text) => { box.innerHTML = `<p class="ximg-say">${esc(text)}</p>`; };
  if (w.shows) {
    api.projectImage(project, rel, { signal: ctl.signal }).then((blob) => {
      if (gone) return;
      url = URL.createObjectURL(blob);
      meta.textContent = size(blob.size);
      const img = new Image();
      img.alt = base(file.path);
      img.draggable = false;
      img.decoding = "async";
      img.onload = () => { if (!gone) meta.textContent = `${img.naturalWidth} × ${img.naturalHeight} · ${size(blob.size)}`; };
      img.onerror = () => { if (!gone) say("This image couldn't be shown: the file may be damaged, or in a format this browser can't read."); };
      img.src = url;
      if (open) {
        const b = document.createElement("button");
        b.type = "button"; b.className = "ximg-open"; b.title = "Open in Files"; b.setAttribute("aria-label", `Open ${base(file.path)} in Files`);
        b.addEventListener("click", () => open(b));
        b.append(img);
        box.replaceChildren(b);
      } else box.replaceChildren(img);
    }).catch((err) => {
      if (gone || (err && err.name === "AbortError")) return;
      say(err && err.status === 404 ? "This image isn't there any more." : err && err.status === 413 ? "Too large to show here (over 25 MB): download it to see it." : "Couldn't read this image.");
    });
  }
  host.querySelector(".ximg").setAttribute("aria-label", `${w.what}: ${base(file.path)}`);
  return { drop() { gone = true; ctl.abort(); if (url) URL.revokeObjectURL(url); url = null; } };
}
