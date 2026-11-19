#!/usr/bin/env python3
"""tools/ledger/reconcile.py: an entry closes only when the tree shows it done; python3 tests/ledger-reconcile.test.py"""
import json, os, subprocess, sys, tempfile, unittest
from pathlib import Path

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TOOL = os.path.join(ROOT, "tools/ledger/reconcile.py")
REGION = "assign to its region's home when this file moves (see its analysis)"

def write(repo, path, text):
    full = Path(repo, path)
    full.parent.mkdir(parents=True, exist_ok=True)
    full.write_text(text)

class Reconcile(unittest.TestCase):
    def setUp(self):
        self.dir = tempfile.TemporaryDirectory()
        self.repo = self.dir.name
        write(self.repo, "js/a.js", "export function kept() {}\n")
        write(self.repo, "core/ui/a.js", "export function moved() {}\nfunction plain() {}\nexport const BAR = 1;\n")
        write(self.repo, "js/shim.js", 'export * from "../core/ui/a.js";\nexport { BAR } from "../core/ui/a.js";\n')
        write(self.repo, "modules/conv/media/cards.js", "export function hydrate() {}\n")
        write(self.repo, "modules/conv/index.js", 'document.getElementById("dock");\n')
        write(self.repo, "core/services/new.js", "export const x = 1;\n")
        write(self.repo, "core/services/other.js", "export const y = 1;\n")
        self.ledger = {"commit": "c", "files": {
            "js/gone.js": {"status": "planned", "home": "core/services/new.js"},
            "js/split.js": {"status": "planned", "home": ["core/services/new.js", "core/services/other.js (rest)"]},
            "js/half.js": {"status": "planned", "home": ["core/services/new.js", "modules/nowhere/x.js"]},
            "js/probe.js": {"status": "planned", "home": "delete: a one-off probe (owner D6)"},
            "js/a.js": {"status": "planned", "home": "core/ui/a.js"},
            "js/left.js": {"status": "planned", "home": "core/services/new.js"},
        }, "items": {
            "js/a.js::functions::moved": {"status": "planned", "home": "core/ui/a.js"},
            "js/a.js::functions::kept": {"status": "planned", "home": "core/ui/a.js"},
            "js/a.js::exports::plain": {"status": "planned", "home": "core/ui/a.js (render)"},
            "js/a.js::functions::lost": {"status": "planned", "home": "core/ui/a.js"},
            "js/shim.js::exports::BAR": {"status": "planned", "home": "core/ui/a.js"},
            "js/m.js::functions::hydrate": {"status": "split-region", "home": ["modules/conv/media/", "core/ui/media (layout)"], "note": REGION},
            "js/m.js::ids::dock": {"status": "split-region", "home": ["modules/conv/latest.js"], "note": REGION},
            "js/a.js::keys::Home": {"status": "planned", "home": "drop (history)"},
            "js/elsewhere.js::functions::lost": {"status": "planned", "home": "modules/nowhere/x.js (was in core/ui/a.js)"},
            "js/b.js::functions::moved": {"status": "planned", "home": "dropdown: core/ui/a.js"},
            "js/left.js::functions::unplaced": {"status": "planned", "home": "core/services/new.js"},
            "js/a.js::functions::done": {"status": "moved", "home": "core/ui/a.js"},
        }}
        write(self.repo, "tools/ledger/ledger.json", json.dumps(self.ledger, indent=1) + "\n")

    def tearDown(self):
        self.dir.cleanup()

    def run_tool(self, *args):
        r = subprocess.run([sys.executable, TOOL, "--repo", self.repo, *args], capture_output=True, text=True)
        self.assertEqual(r.returncode, 0, r.stderr)
        return r.stdout, json.loads(Path(self.repo, "tools/ledger/ledger.json").read_text())

    def test_dry_run_writes_nothing(self):
        out, L = self.run_tool()
        self.assertEqual(L, self.ledger)
        self.assertIn("planned -> moved: js/a.js::functions::moved -> core/ui/a.js", out)

    def test_items(self):
        out, L = self.run_tool("--write")
        it = L["items"]
        self.assertEqual(it["js/a.js::functions::moved"], {"status": "moved", "home": "core/ui/a.js"})
        self.assertEqual(it["js/a.js::functions::kept"]["status"], "planned", "still defined at its source")
        self.assertEqual(it["js/a.js::exports::plain"], {"status": "moved", "home": "core/ui/a.js"}, "an export may land as a plain function")
        self.assertEqual(it["js/a.js::functions::lost"]["status"], "planned", "gone, but nowhere at its home")
        self.assertIn("not found at its home: js/a.js::functions::lost", out)
        self.assertEqual(it["js/shim.js::exports::BAR"], {"status": "moved", "home": "core/ui/a.js"}, "a re-export is not a definition")
        self.assertEqual(it["js/m.js::functions::hydrate"], {"status": "moved", "home": "modules/conv/media/cards.js"})
        self.assertEqual(it["js/m.js::ids::dock"]["status"], "split-region", "a home file that doesn't exist is no home, nor is its folder")
        self.assertEqual(it["js/elsewhere.js::functions::lost"]["status"], "planned", "only the first path of a home counts")
        self.assertEqual(it["js/b.js::functions::moved"], {"status": "moved", "home": "core/ui/a.js"}, "dropdown is not drop")
        self.assertEqual(it["js/a.js::keys::Home"], {"status": "deleted", "reason": "drop (history)"})
        self.assertEqual(it["js/a.js::functions::done"], self.ledger["items"]["js/a.js::functions::done"])

    def test_files(self):
        _, L = self.run_tool("--write")
        f = L["files"]
        self.assertEqual(f["js/gone.js"], {"status": "moved", "home": "core/services/new.js"})
        self.assertEqual(f["js/split.js"], {"status": "split", "home": ["core/services/new.js", "core/services/other.js"]})
        self.assertEqual(f["js/half.js"]["status"], "planned", "one of its homes does not exist")
        self.assertEqual(f["js/probe.js"], {"status": "deleted", "reason": "a one-off probe (owner D6)"})
        self.assertEqual(f["js/a.js"]["status"], "planned", "the file is still there")
        self.assertEqual(f["js/left.js"]["status"], "planned", "one of its items is still open")

if __name__ == "__main__":
    unittest.main()
