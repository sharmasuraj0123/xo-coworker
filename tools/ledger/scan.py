"""The items a first-party file holds (exports, functions, ids, storage keys, routes, events, keys, globals), read from its text."""
import re
from collections import OrderedDict

R = {
    "imports":   re.compile(r"""(?:^|\n)\s*import\s+(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)|require\(\s*['"]([^'"]+)['"]\s*\)"""),
    "exports":   re.compile(r"""export\s+(?:default\s+)?(?:async\s+)?(?:function\*?|class|const|let|var)\s+([A-Za-z_$][\w$]*)|export\s*\{([^}]*)\}"""),
    "functions": re.compile(r"""^(?:export\s+)?(?:async\s+)?function\*?\s+([A-Za-z_$][\w$]*)""", re.M),
    "ids":       re.compile(r"""getElementById\(\s*['"`]([\w:-]+)['"`]|querySelector(?:All)?\(\s*['"`]#([\w-]+)|\bid=\\?["']([\w-]+)\\?["']"""),
    "storage":   re.compile(r"""(?:localStorage|sessionStorage)\.(?:getItem|setItem|removeItem)\(\s*['"`]([^'"`]+)['"`]|(?:localStorage|sessionStorage)\[\s*['"`]([^'"`]+)['"`]\]"""),
    "routes":    re.compile(r"""['"`](/api/[^'"`\s?]*)|\b(?:get|post|put|del|delete|patch|request|api|json|send|stream|req|fetchJson|call)\w*\(\s*[`'"](/[a-z][^`'"?]*)"""),
    "events":    re.compile(r"""new\s+CustomEvent\(\s*['"`]([\w:.-]+)['"`]|dispatchEvent\(\s*new\s+Event\(\s*['"`]([\w:.-]+)['"`]|addEventListener\(\s*['"`]([\w:.-]+)['"`]"""),
    "keys":      re.compile(r"""\.key\s*===?\s*['"`]([^'"`]{1,12})['"`]|\.code\s*===?\s*['"`]([^'"`]{1,16})['"`]"""),
    "globals":   re.compile(r"""\b(?:window|globalThis)\.([A-Za-z_$][\w$]*)\s*=(?!=)"""),
}
CSS = {
    "rules":     re.compile(r"""([^{}@][^{}]*)\{"""),
    "ids":       re.compile(r"""#([A-Za-z][\w-]*)(?![^{]*;)"""),
    "props_def": re.compile(r"""(--[\w-]+)\s*:"""),
    "props_use": re.compile(r"""var\(\s*(--[\w-]+)"""),
    "media":     re.compile(r"""@media\s*([^{]+)\{"""),
}
STD_EVENTS = set("""click dblclick mousedown mouseup mousemove mouseover mouseout mouseenter mouseleave pointerdown pointerup pointermove pointercancel pointerenter pointerleave pointerover pointerout gotpointercapture lostpointercapture keydown keyup keypress input change submit focus blur focusin focusout scroll wheel resize load unload beforeunload error message open close abort contextmenu dragstart dragend dragover dragenter dragleave drop touchstart touchend touchmove touchcancel transitionend transitionstart animationend animationstart visibilitychange online offline popstate hashchange storage copy paste cut selectionchange compositionstart compositionend toggle cancel beforeinput loadedmetadata play pause ended timeupdate select invalid readystatechange progress pagehide pageshow fullscreenchange""".split())
LEDGER_KINDS = ("exports", "functions", "ids", "storage", "routes", "custom_events", "keys", "globals")

def uniq(xs):
    return list(OrderedDict.fromkeys(x for x in xs if x))

def js_items(text):
    items = {}
    for k, rx in R.items():
        found = []
        for m in rx.finditer(text):
            if k == "exports" and m.group(2):
                found += [x.strip().split(" as ")[-1].strip() for x in m.group(2).split(",")]
            else:
                found += [x for x in m.groups() if x]
        items[k] = uniq(found)
    items["custom_events"] = [e for e in items.pop("events") if e not in STD_EVENTS]
    idents = re.findall(r"(?:localStorage|sessionStorage)\.(?:getItem|setItem|removeItem)\(\s*([A-Za-z_$][\w$.]*)", text)
    for ident in uniq(idents):
        m = re.search(r"(?:const|let|var)\s+" + re.escape(ident.split(".")[-1]) + r"\s*=\s*['\"`]([^'\"`]+)['\"`]", text)
        items["storage"] = uniq(items.get("storage", []) + [m.group(1) if m else f"<{ident}>"])
    items["routes"] = uniq(re.sub(r"\$\{[^}]*\}", "{}", r) for r in items.get("routes", []))
    return {k: v for k, v in items.items() if v}

def css_items(text):
    sels = [s.strip() for s in CSS["rules"].findall(re.sub(r"/\*[\s\S]*?\*/", "", text)) if s.strip() and not s.strip().startswith(("from", "to")) and not re.match(r"^[\d.]+%", s.strip())]
    return {
        "rule_blocks": len(sels),
        "ids": uniq(CSS["ids"].findall(" ".join(sels))),
        "custom_props_defined": uniq(CSS["props_def"].findall(text)),
        "custom_props_used": uniq(CSS["props_use"].findall(text)),
        "media": uniq(m.strip() for m in CSS["media"].findall(text)),
    }

def html_items(text):
    return {
        "ids": uniq(re.findall(r'\bid="([\w-]+)"', text)),
        "scripts": uniq(re.findall(r'<script[^>]*src="([^"]+)"', text)),
        "stylesheets": uniq(re.findall(r'<link[^>]*href="([^"]+\.css)"', text)),
    }

def items_of(path, text):
    if re.search(r"\.(m|c)?js$", path): return js_items(text)
    if path.endswith(".css"): return css_items(text)
    if path.endswith(".html"): return html_items(text)
    return {}
