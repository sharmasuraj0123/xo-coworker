import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch


sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "tools" / "ledger"))
from homes import Homes
from git_environment import run_git


class TransferEvidence(unittest.TestCase):
    def setUp(self):
        scratch = tempfile.TemporaryDirectory()
        self.addCleanup(scratch.cleanup)
        self.root = Path(scratch.name)
        self.source = "original.js"
        self.home = "destination.js"
        self.key = f"{self.source}::functions::moveMe"
        self.shared = "const shared = 'an unrelated but distinctive shared line';\n"
        self.write(self.source, self.shared + "function moveMe() { return 42; }\n")
        self.git("init", "-q")
        self.git("add", self.source)
        self.git("-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", "commit", "-qm", "fixture")

    def git(self, *args):
        return run_git(args, cwd=self.root, capture_output=True, check=True, text=True).stdout.strip()

    def write(self, name, text):
        (self.root / name).write_text(text, encoding="utf-8")

    def check(self, key, anchor=None, reason="The new function owns the old operation."):
        entry = {"status": "moved", "home": self.home}
        if anchor is not None:
            entry["evidence"] = {self.home: {"anchor": anchor, "reason": reason}}
        homes = Homes(self.root, self.git("rev-parse", "HEAD"), {key: entry}, {self.source})
        return list(homes.problems(key, entry, {self.source}))

    def test_shared_file_content_does_not_verify_an_unrelated_item(self):
        self.write(self.home, self.shared + "function unrelated() { return 0; }\n")
        self.assertEqual(self.check(self.source), [])
        self.assertIn(self.key, self.check(self.key)[0])
        self.write(self.home, "function moveMe() { return 42; }\n")
        self.assertEqual(self.check(self.key), [])

    def test_function_identity_survives_extraction_into_a_closure_or_arrow(self):
        for body in (
            "function factory() {\n  function moveMe() { return 42; }\n  return moveMe;\n}\n",
            "export const moveMe = () => 42;\n",
            "function factory() { return function moveMe() { return 42; }; }\n",
            "function factory() { return async function moveMe() { return 42; }; }\n",
        ):
            with self.subTest(body=body):
                self.write(self.home, body)
                self.assertEqual(self.check(self.key), [])

    def test_return_function_lookalikes_do_not_prove_a_move(self):
        self.write(self.home, 'const text = "return async function moveMe() {}";\n'
                              '// return function moveMe() {}\n')
        self.assertTrue(self.check(self.key))

    def test_only_distinct_valid_settled_function_destinations_are_parsed(self):
        self.write("scratch.js", "function ***")
        self.write("planned.js", "function ***")
        self.write("value.js", "function ***")
        self.write(self.home, "function moveMe() {}\nfunction second() {}\n")
        moved = {"status": "moved", "home": self.home}
        entries = {
            self.key: moved,
            f"{self.source}::functions::second": moved,
            f"{self.source}::functions::later": {"status": "planned", "home": "planned.js"},
            f"{self.source}::exports::value": {"status": "moved", "home": "value.js"},
            f"{self.source}::functions::invalid": {"status": "moved", "home": "./scratch.js"},
        }
        tracked = {self.source}
        parsed = Homes.parse_functions
        with patch.object(Homes, "parse_functions", autospec=True, side_effect=parsed) as batch:
            homes = Homes(self.root, self.git("rev-parse", "HEAD"), entries, tracked)
        batch.assert_called_once_with(homes, [self.home])
        self.assertEqual(list(homes.problems(self.key, moved, tracked)), [])

    def test_requested_parse_failure_is_reported_without_stopping_the_batch(self):
        self.write(self.home, "function trackTransfer( {")
        self.write("valid.js", "function second() {}\n")
        moved = {"status": "moved", "home": self.home, "evidence": {
            self.home: {"anchor": "function trackTransfer(", "reason": "Example of a supplied anchor."},
        }}
        good_key = f"{self.source}::functions::second"
        good = {"status": "moved", "home": "valid.js"}
        tracked = {self.source}
        homes = Homes(self.root, self.git("rev-parse", "HEAD"), {self.key: moved, good_key: good}, tracked)
        issues = list(homes.problems(self.key, moved, tracked))
        self.assertEqual(len(issues), 1)
        self.assertIn("cannot parse JavaScript", issues[0])
        self.assertIn(self.home, issues[0])
        self.assertEqual(list(homes.problems(good_key, good, tracked)), [])

    def test_requested_read_failure_reports_the_destination(self):
        self.write(self.home, "function moveMe() {}")
        moved = {"status": "moved", "home": self.home}
        tracked = {self.source}
        parsed = Homes.parse_functions

        def disappear(homes, paths):
            (self.root / self.home).unlink()
            return parsed(homes, paths)

        with patch.object(Homes, "parse_functions", autospec=True, side_effect=disappear):
            homes = Homes(self.root, self.git("rev-parse", "HEAD"), {self.key: moved}, tracked)
        issues = list(homes.problems(self.key, moved, tracked))
        self.assertEqual(len(issues), 1)
        self.assertIn("cannot read JavaScript (ENOENT)", issues[0])
        self.assertIn(self.home, issues[0])

    def test_anchor_must_be_meaningful_and_unique(self):
        definition = "function trackTransfer() { return 42; }\n"
        self.write(self.home, definition)
        self.assertTrue(self.check(self.key, "a"))
        self.assertTrue(self.check(self.key, "function trackTransfer()", "  "))
        self.assertTrue(self.check(self.key, "unction trackTransfer()"))
        self.assertEqual(self.check(self.key, "function trackTransfer()"), [])
        self.write(self.home, definition * 2)
        self.assertTrue(self.check(self.key, "function trackTransfer()"))


if __name__ == "__main__":
    unittest.main()
