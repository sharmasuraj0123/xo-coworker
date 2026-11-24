import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "tools" / "ledger"))
from homes import Homes


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
        return subprocess.run(["git", *args], cwd=self.root, capture_output=True, check=True, text=True).stdout.strip()

    def write(self, name, text):
        (self.root / name).write_text(text, encoding="utf-8")

    def check(self, key, anchor=None, reason="The new function owns the old operation."):
        entry = {"status": "moved", "home": self.home}
        if anchor is not None:
            entry["evidence"] = {self.home: {"anchor": anchor, "reason": reason}}
        homes = Homes(self.root, self.git("rev-parse", "HEAD"))
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
