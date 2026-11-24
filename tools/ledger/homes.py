import re
import subprocess
from functools import cache
from pathlib import Path

from scan import items_of


SPACE = re.compile(rb"\s+")
NON_CODE = (b"//", b"# ", b"/*", b"* ", b"import ")


def source_lines(data):
    return {SPACE.sub(b"", line) for line in map(bytes.strip, data.splitlines())
            if len(line) >= 24 and not line.startswith(NON_CODE)}


class Homes:
    def __init__(self, root, commit):
        self.root = Path(root).resolve()
        self.commit = commit

    @cache
    def original(self, source):
        return subprocess.run(
            ["git", "-C", self.root, "show", f"{self.commit}:{source}"],
            check=True, capture_output=True,
        ).stdout

    @cache
    def contents(self, path):
        return (self.root / path).read_bytes()

    @cache
    def related(self, source, path):
        old, new = self.original(source), self.contents(path)
        return old == new or bool(source_lines(old) & source_lines(new))

    @cache
    def items(self, path):
        return items_of(path, self.contents(path).decode("utf-8", "replace"))

    def problems(self, key, entry, tracked):
        source, *item = key.split("::", 2)
        if source not in tracked:
            yield f"home has no base source: {key}"
            return
        home = entry["home"]
        paths = home if isinstance(home, list) else [home]
        status = entry["status"]
        if status == "split" and len({str(path) for path in paths}) < 2:
            yield f"split requires multiple distinct homes: {key}"
            return
        if status != "split" and len(paths) != 1:
            yield f"{status} requires one home: {key}"
            return
        for path in paths:
            problem = self.problem(source, item, entry, path)
            if problem:
                yield f"{problem}: {key} -> {path}"

    def problem(self, source, item, entry, path):
        if not isinstance(path, str) or not path:
            return "home must be a repository-relative file"
        relative = Path(path)
        if relative.is_absolute() or ".." in relative.parts or relative.as_posix() != path:
            return "home must be a canonical repository-relative file"
        target = self.root / relative
        if target.is_dir():
            return "home is a directory"
        if not target.is_file() or target.is_symlink() or not target.resolve().is_relative_to(self.root):
            return "home does not exist as a repository file"
        status = entry["status"]
        if status == "kept":
            return None if path == source else "kept home differs from its source"
        if status == "vendor":
            return None if self.original(source) == self.contents(path) else "vendor home changes the original bytes"
        if path == source:
            return "moved home is still its source" if status == "moved" else None
        if item and item[1] in self.items(path).get(item[0], ()):
            return None
        if self.related(source, path):
            return None
        evidence = entry.get("evidence", {}).get(path, {})
        anchor, reason = evidence.get("anchor"), evidence.get("reason")
        if anchor and reason and anchor.encode() in self.contents(path):
            return None
        return "home has no source content or verified transfer evidence"
