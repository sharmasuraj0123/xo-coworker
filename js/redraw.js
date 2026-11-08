// Redraw a region in place.
//
// `el.innerHTML = html` replaces every node in a region, so the control a person is on is destroyed and focus
// falls to the page (with a field's caret, selection and half-typed value). redraw(el, html) instead brings the
// region's DOM to the new HTML by updating the nodes that stay: a node whose tag and key match is kept and its
// attributes and children are updated; only what's new is created and only what's gone is removed. The control
// with focus is never moved or replaced while it is still in the new HTML, so focus, caret and scroll stay.
//
// A node's key: its id, else its data-key, else its data- hooks (the control's identity in this codebase);
// nodes without one match by tag, in order. A custom element (xo-select …) owns its insides: only its attributes
// are updated. A text field the person is in keeps what they typed: its value isn't overwritten. A checkbox or
// radio always takes `checked` from the new HTML, focused or not: it has no draft to keep.
// Returns true if anything changed.

export function redraw(el, html) {
  const tpl = document.createElement("template");
  tpl.innerHTML = html;
  const focus = deepActive();
  return syncChildren(el, tpl.content, focus);
}

const VOLATILE = /^data-(inv|inv-now)$/;
function deepActive() { let a = document.activeElement; while (a && a.shadowRoot && a.shadowRoot.activeElement) a = a.shadowRoot.activeElement; return a; }
function keyOf(n) {
  if (n.nodeType !== 1) return null;
  if (n.id) return "#" + n.id;
  const k = n.getAttribute("data-key");
  if (k != null) return "k:" + k;
  let hooks = "";
  for (const a of n.attributes) if (a.name.startsWith("data-") && !VOLATILE.test(a.name)) hooks += `[${a.name}=${a.value}]`;
  return hooks || null;
}
const same = (a, b) => a.nodeType === b.nodeType && (a.nodeType !== 1 || (a.tagName === b.tagName && keyOf(a) === keyOf(b)));

// A node the page's own script added (it carries data-own: a decorator's buttons, say) isn't drawn from the HTML:
// it stays where it is, is never matched, moved or removed, and what is drawn goes around it.
const own = (n) => n.nodeType === 1 && n.hasAttribute("data-own");
function syncChildren(from, to, focus) {
  let changed = false;
  let cur = from.firstChild;
  while (cur && own(cur)) cur = cur.nextSibling; // own nodes at the start stay first
  for (const want of [...to.childNodes]) {
    let match = null;
    for (let c = cur; c; c = c.nextSibling) if (!own(c) && same(c, want)) { match = c; break; }
    if (match) {
      // bring it to this place without moving it when it holds focus: move what's in between instead
      if (match !== cur) {
        if (focus && match.contains(focus)) { while (cur && cur !== match) { const next = cur.nextSibling; if (!own(cur)) from.appendChild(cur); cur = next; } changed = true; }
        else { from.insertBefore(match, cur); changed = true; }
      }
      if (syncNode(match, want, focus)) changed = true;
      cur = match.nextSibling;
    } else {
      from.insertBefore(want, cur); // adopted from the template: it's new
      changed = true;
    }
  }
  // what's left wasn't in the new HTML (but what the page's own script added stays)
  while (cur) { const next = cur.nextSibling; if (!own(cur)) { from.removeChild(cur); changed = true; } cur = next; }
  return changed;
}

function syncNode(node, want, focus) {
  if (node.nodeType === 3 || node.nodeType === 8) {
    if (node.nodeValue !== want.nodeValue) { node.nodeValue = want.nodeValue; return true; }
    return false;
  }
  if (node.nodeType !== 1) return false;
  let changed = false;
  for (const a of [...node.attributes]) if (!want.hasAttribute(a.name) && !VOLATILE.test(a.name)) { node.removeAttribute(a.name); changed = true; }
  for (const a of want.attributes) if (node.getAttribute(a.name) !== a.value) { node.setAttribute(a.name, a.value); changed = true; }
  const tag = node.tagName;
  // a box or a radio has no draft: it always shows what the new HTML says, focused or not (a refused toggle
  // shows the saved state again, and Space retries)
  if (tag === "INPUT" && (node.type === "checkbox" || node.type === "radio")) {
    if (node.checked !== want.hasAttribute("checked")) { node.checked = want.hasAttribute("checked"); changed = true; }
  } else if ((tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") && node !== focus) {
    // a field keeps what's typed in it while the person is in it; otherwise it shows the new value
    const v = tag === "TEXTAREA" ? want.textContent : want.getAttribute("value");
    if (v != null && node.value !== v) { node.value = v; changed = true; }
  }
  if (tag === "TEXTAREA") return changed;
  if (tag.includes("-")) return changed; // a custom element draws its own insides
  return syncChildren(node, want, focus) || changed;
}
