// @ts-check

/** @param {HTMLElement} body @param {import("./page-types.d.ts").GalleryDeps["sk"]["tile"]} tile */
export function artsMetrics(body, tile) {
  let probe = body.querySelector(":scope > .ar-probe");
  if (!probe) {
    probe = document.createElement("div");
    probe.className = "ar-probe";
    probe.setAttribute("aria-hidden", "true");
    probe.innerHTML = `<h2 class="ar-gh">Today</h2><ul class="md-grid ar-grid">${tile("page")}</ul>`;
    body.prepend(probe);
  }
  const list = /** @type {HTMLElement} */ (probe.querySelector("ul"));
  const style = getComputedStyle(list);
  const header = /** @type {HTMLElement} */ (probe.firstElementChild);
  const headH = header.offsetHeight;
  const card = /** @type {HTMLElement} */ (list.firstElementChild);
  return {
    cols: Math.max(1, style.gridTemplateColumns.split(" ").filter(Boolean).length),
    gap: parseFloat(style.rowGap) || 0,
    headH,
    cardH: card.offsetHeight,
  };
}
