// @ts-check

/** @typedef {{ html: string, theme: string, w: number | null }} Drawing */

/** @typedef {(tex: string, display: boolean) => Promise<string>} DrawMath */

/** @typedef {(source: string) => Promise<Drawing | {error: string}>} DrawDiagram */

/** @typedef {{signal: AbortSignal, report: (error: unknown) => void}} DrawingOwner */

const DIAGRAM_SOURCE = ":scope > .md-dg-src";

export class RichInputError extends Error {}

/** @param {HTMLElement} element */
function inputOf(element) {
  const math = element.classList.contains("md-math");
  return {
    math,
    display: math && element.classList.contains("is-block"),
    source: (math ? element.dataset.tex : element.querySelector(DIAGRAM_SOURCE)?.textContent) ?? "",
  };
}

/** @typedef {ReturnType<typeof inputOf> & {owner: DrawingOwner | undefined}} Request */

/** @param {DrawMath} drawMath @param {DrawDiagram} diagramFor */
export function createRichElements(drawMath, diagramFor) {
  /** @type {WeakMap<HTMLElement, DrawingOwner>} */
  const owners = new WeakMap();
  /** @type {WeakMap<HTMLElement, Request>} */
  const drawing = new WeakMap();
  /** @param {HTMLElement} element @param {AbortSignal} signal @param {(error: unknown) => void} report */
  function ownRichElement(element, signal, report) { owners.set(element, { signal, report }); }
  /** @param {HTMLElement} element */
  const attached = (element) => element.isConnected && !owners.get(element)?.signal.aborted;
  /** @param {HTMLElement} element @param {Request | undefined} request */
  function matches(element, request) {
    if (!request || owners.get(element) !== request.owner) return false;
    const { math, display, source } = inputOf(element);
    return math === request.math && display === request.display && source === request.source;
  }
  /** @param {HTMLElement} element */
  const isDrawing = (element) => matches(element, drawing.get(element));
  /** @param {HTMLElement} element */
  async function drawRichElement(element) {
    if (!attached(element) || isDrawing(element) || element.classList.contains("is-failed")) return;
    const request = { ...inputOf(element), owner: owners.get(element) };
    drawing.set(element, request);
    const current = () => attached(element) && drawing.get(element) === request && matches(element, request);
    try {
      if (request.math) {
        const markup = await drawMath(request.source, request.display);
        if (current()) drawMathEl(element, markup);
      } else {
        const result = await diagramFor(request.source);
        if (current()) drawDiagramEl(element, result);
      }
    } catch (error) {
      if (!current()) return;
      element.classList.add("is-failed");
      if (error instanceof RichInputError) return;
      if (request.owner) request.owner.report(error);
      else console.warn("rich:", error);
    } finally {
      if (drawing.get(element) === request) drawing.delete(element);
    }
  }

  /** @param {HTMLElement} el @param {string} html */
  function drawMathEl(el, html) {
    el.innerHTML = html;
    el.classList.add("is-done");
  }

  /** @param {HTMLElement} fig @param {Drawing | {error: string}} got */
  function drawDiagramEl(fig, got) {
    if ("html" in got) {
      // swap the drawing in one step: the old one (another theme's) stays until this one is ready
      for (const old of fig.querySelectorAll(":scope > svg")) old.remove();
      fig.insertAdjacentHTML("afterbegin", got.html);
      fig.dataset.dgTheme = got.theme;
      if (got.w) fig.style.setProperty("--dg-w", got.w + "px"); else fig.style.removeProperty("--dg-w");
      fig.classList.add("is-done");
    } else {
      fig.classList.add("is-failed");
      if (!fig.querySelector(":scope > .md-dg-why")) fig.insertAdjacentHTML("afterbegin", `<figcaption class="md-dg-why"></figcaption>`);
      /** @type {Element} */ (fig.querySelector(":scope > .md-dg-why")).textContent = `This diagram couldn't be drawn: ${got.error}`;
    }
  }

  return { ownRichElement, drawRichElement, attached, isDrawing };
}
