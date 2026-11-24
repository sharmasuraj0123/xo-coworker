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
            ("items", "test::exports::missing", {"status": "moved", "home": "__missing_item__.js"}),
        ])
        self.assertEqual(results.returncode, 1, results.stderr)
        self.assertIn("js/app.js -> missing split home.js", results.stdout)
        self.assertIn("test::exports::missing -> __missing_item__.js", results.stdout)

    def test_planned_home_may_be_absent_until_final_validation(self):
        updates = [("files", "index.html", {"status": "planned", "home": "__future_home__.js"})]
        plan = self.check(updates)
        final = self.check(updates, final=True)
        self.assertEqual(plan.returncode, 0, plan.stdout + plan.stderr)
        self.assertEqual(final.returncode, 1, final.stderr)
        self.assertIn("status 'planned' not allowed in --final: index.html", final.stdout)


if __name__ == "__main__":
    unittest.main()
