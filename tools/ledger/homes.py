import re
import subprocess
from functools import cache
from pathlib import Path

from scan import items_of


SPACE = re.compile(rb"\s+")
NON_CODE = (b"//", b"# ", b"/*", b"* ", b"import ")
IDENTIFIER = re.compile(r"[\w$]+")
MIN_ANCHOR_CHARACTERS = 8
FUNCTION = re.compile(
    r"^\s*(?:export\s+(?:default\s+)?)?(?:async\s+)?function\s*\*?\s+([\w$]+)\s*\("
    r"|^\s*(?:export\s+)?(?:const|let|var)\s+([\w$]+)\s*=\s*(?:async\s+)?"
    r"(?:function\b|\([^;]*?\)\s*=>|[\w$]+\s*=>)",
    re.MULTILINE,
)


def verified_anchor(evidence, data):
    if not isinstance(evidence, dict):
        return False
    anchor, reason = evidence.get("anchor"), evidence.get("reason")
    if not isinstance(anchor, str) or not isinstance(reason, str) or not reason.strip():
        return False
    tokens = IDENTIFIER.findall(anchor)
    if anchor != anchor.strip() or len(tokens) < 2 or sum(map(len, tokens)) < MIN_ANCHOR_CHARACTERS:
        return False
    left = r"(?<![\w$])" if IDENTIFIER.match(anchor) else ""
    right = r"(?![\w$])" if IDENTIFIER.fullmatch(anchor[-1:]) else ""
    matches = re.finditer(f"(?={left}{re.escape(anchor)}{right})", data.decode("utf-8", "replace"))
    return next(matches, None) is not None and next(matches, None) is None


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
        source = self.contents(path).decode("utf-8", "replace")
        items = items_of(path, source)
        if Path(path).suffix in {".js", ".mjs", ".cjs"}:
            code = re.sub(r"/\*[\s\S]*?\*/", "", source)
            items["functions"] = {left or right for left, right in FUNCTION.findall(code)}
        return items

    def problems(self, key, entry, tracked):
        source, *item = key.split("::", 2)
        if source not in tracked:
            yield f"home has no base source: {key}"
            return
        if item and len(item) != 2:
            yield f"invalid item key: {key}"
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
        if status == "moved" and path == source:
            return "moved home is still its source"
        if item:
            kind, name = item
            if name in self.items(path).get(kind, ()):
                return None
        elif path == source or self.related(source, path):
            return None
        evidence = entry.get("evidence", {})
        if isinstance(evidence, dict) and verified_anchor(evidence.get(path), self.contents(path)):
            return None
        return "home has no source content or verified transfer evidence"
