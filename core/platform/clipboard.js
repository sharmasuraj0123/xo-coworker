// @ts-check

/** Copy, even without the async clipboard (plain http): true only once the text is on the clipboard, false when the browser refused both ways. @param {string} text */
export async function copyText(text) {
  if (navigator.clipboard && isSecureContext) {
    try { await navigator.clipboard.writeText(text); return true; } catch { /* the selection's own copy, below */ }
  }
  return legacy(text);
}
export const COPY_REFUSED = "Couldn't copy: the browser didn't allow it here. Select the text and copy it instead.";
/** @param {string} text */
function legacy(text) {
  const back = /** @type {HTMLElement | null} */ (document.activeElement);
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.setAttribute("readonly", "");
  ta.style.cssText = "position:fixed;top:0;left:0;opacity:0;pointer-events:none";
  document.body.appendChild(ta);
  ta.select();
  let ok = false;
  try { ok = document.execCommand("copy"); } catch { ok = false; }
  ta.remove();
  if (back && back !== document.body && back.isConnected && back.focus) back.focus({ preventScroll: true });
  return !!ok;
}
