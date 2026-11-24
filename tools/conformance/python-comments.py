import ast
import json
import sys
import tokenize
from pathlib import Path


def comments(path):
    with tokenize.open(path) as source:
        text = source.read()
    out = [
        (token.start[0], token.end[0], token.string[1:])
        for token in tokenize.generate_tokens(iter(text.splitlines(keepends=True)).__next__)
        if token.type == tokenize.COMMENT and not token.string.startswith("#!")
    ]
    for node in ast.walk(ast.parse(text, filename=str(path))):
        if not isinstance(node, (ast.Module, ast.ClassDef, ast.FunctionDef, ast.AsyncFunctionDef)):
            continue
        if node.body and ast.get_docstring(node, clean=False) is not None:
            doc = node.body[0]
            out.append((doc.lineno, doc.end_lineno, ast.get_source_segment(text, doc)))
    return [
        {"startLine": start, "endLine": end, "value": value}
        for start, end, value in sorted(out)
    ]


if __name__ == "__main__":
    root = Path(sys.argv[1])
    print(json.dumps({file: comments(root / file) for file in json.load(sys.stdin)}))
