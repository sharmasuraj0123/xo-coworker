import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
LEDGER_DIR = ROOT / "tools" / "ledger"


class LedgerHomes(unittest.TestCase):
    def check(self, updates, final=False):
        ledger = json.loads((LEDGER_DIR / "ledger.json").read_text())
        for section, key, entry in updates:
            ledger[section][key] = entry
        with tempfile.TemporaryDirectory(prefix="xo-ledger-test-") as scratch:
            ledger_path = Path(scratch) / "ledger.json"
            ledger_path.write_text(json.dumps(ledger))
            args = [sys.executable, str(LEDGER_DIR / "check_ledger.py"), "--repo", str(ROOT), "--ledger", str(ledger_path)]
            if final:
                args.append("--final")
            return subprocess.run(args, capture_output=True, text=True)

    def test_settled_file_and_item_homes_must_exist(self):
        results = self.check([
            ("files", "js/app.js", {"status": "split", "home": ["boot.js", "missing split home.js"]}),
            ("items", "js/app.js::functions::runGlobal", {"status": "moved", "home": "__missing_item__.js"}),
        ])
        self.assertEqual(results.returncode, 1, results.stderr)
        self.assertIn("js/app.js -> missing split home.js", results.stdout)
        self.assertIn("js/app.js::functions::runGlobal -> __missing_item__.js", results.stdout)

    def test_settled_homes_require_a_file_and_a_transfer(self):
        results = self.check([
            ("files", "js/app.js", {"status": "split", "home": ["js/app.js", "shell", "README.md"]}),
            ("items", "js/app.js::functions::runGlobal", {"status": "moved", "home": "js/app.js"}),
            ("files", "js/keys.js", {"status": "moved", "home": "README.md"}),
            ("items", "js/app.js::functions::focusOverlay", {"status": "moved", "home": "tools/check.mjs"}),
        ])
        self.assertEqual(results.returncode, 1, results.stderr)
        self.assertIn("home is a directory: js/app.js -> shell", results.stdout)
        self.assertIn("home has no source content or verified transfer evidence: js/keys.js -> README.md", results.stdout)
        self.assertIn("home has no source content or verified transfer evidence: js/app.js -> README.md", results.stdout)
        self.assertIn("moved home is still its source: js/app.js::functions::runGlobal -> js/app.js", results.stdout)
        self.assertIn("home has no source content or verified transfer evidence: js/app.js::functions::focusOverlay -> tools/check.mjs", results.stdout)

    def test_rewritten_transfer_requires_live_evidence(self):
        source = "tests/key-layer.test.mjs"
        home = "shell/tests/key-layer.test.mjs"
        results = self.check([
            ("files", source, {"status": "moved", "home": home, "evidence": {
                home: {"anchor": "mutation of the asserted Tab behavior", "reason": "Rewritten as a behavior test."},
            }}),
        ])
        self.assertEqual(results.returncode, 1, results.stderr)
        self.assertIn(f"home has no source content or verified transfer evidence: {source} -> {home}", results.stdout)

    def test_planned_home_may_be_absent_until_final_validation(self):
        updates = [("files", "index.html", {"status": "planned", "home": "__future_home__.js"})]
        plan = self.check(updates)
        final = self.check(updates, final=True)
        self.assertEqual(plan.returncode, 0, plan.stdout + plan.stderr)
        self.assertEqual(final.returncode, 1, final.stderr)
        self.assertIn("status 'planned' not allowed in --final: index.html", final.stdout)


if __name__ == "__main__":
    unittest.main()
