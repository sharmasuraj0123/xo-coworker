import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
from contextlib import contextmanager
from http.client import HTTPConnection
from pathlib import Path

@contextmanager
def server(root, mode):
    env = {**os.environ, "PORT": "0", "HOST": "127.0.0.1", "XO_SERVE_RAW": ""}
    proc = subprocess.Popen([sys.executable, "-u", root / "serve.py"], stdout=subprocess.PIPE, env=env, text=True)
    try:
        line = proc.stdout.readline()
        assert f"serving {mode}" in line, line
        port = int(re.search(r"http://127.0.0.1:(\d+)", line)[1])

        def fetch(path):
            conn = HTTPConnection("127.0.0.1", port, timeout=5)
            try:
                conn.request("GET", path)
                response = conn.getresponse()
                return response.status, response.getheader("Cache-Control"), response.read()
            finally:
                conn.close()

        yield fetch, re.search(r"serving (?:release|source) ([0-9a-f]{12})", line)[1]
    finally:
        proc.terminate()
        proc.wait(timeout=5)
        proc.stdout.close()


def install(dist, version):
    stage = Path(tempfile.mkdtemp(dir=dist))
    assets = ["index.html", f"js/editor-{version}.js", "js/shared.js"]
    (stage / "js").mkdir()
    for file in assets:
        (stage / file).write_text(version)
    (stage / "js/debug.js.map").write_text("private")
    (stage / ".build.json").write_text(json.dumps({"version": version, "files": assets}))
    subprocess.run([sys.executable, Path(__file__).with_name("publish.py"), stage, version], check=True, capture_output=True)
    if stage.exists():
        shutil.rmtree(stage)


def check(root):
    shutil.copyfile(Path(__file__).resolve().parents[2] / "serve.py", root / "serve.py")
    (root / "js").mkdir()
    source = root / "js/shared.js"
    source.write_text("before")
    with server(root, "source") as (fetch, digest):
        path = f"/v/{digest}/js/shared.js"
        assert fetch(path) == (200, "no-cache", b"before")
        source.write_text("after")
        assert fetch(path) == (200, "no-cache", b"after")
    dist = root / "dist"
    dist.mkdir()
    first, second, third = ("a" * 12, "b" * 12, "c" * 12)
    for version in [first, second, second]:
        install(dist, version)
    immutable = "public, max-age=31536000, immutable"
    with server(root, "release " + second) as (fetch, _):
        for version in [first, second]:
            for asset in [f"editor-{version}.js", "shared.js"]:
                assert fetch(f"/v/{version}/js/{asset}") == (200, immutable, version.encode())
            assert fetch(f"/v/{version}/js/debug.js.map")[0] == 404
        assert fetch("/js/shared.js") == (200, "no-cache", second.encode())
    install(dist, third)
    assert {p.name for p in dist.iterdir() if p.is_dir()} == {second, third}
    with server(root, "release " + third) as (fetch, _):
        assert fetch(f"/v/{first}/js/shared.js")[0] == 404
        assert fetch(f"/v/{second}/js/editor-{second}.js")[0] == 200
    (dist / "current").write_text(first + "\n")
    result = subprocess.run([sys.executable, root / "serve.py"], capture_output=True, text=True, timeout=5,
                            env={**os.environ, "PORT": "0", "XO_SERVE_RAW": ""})
    assert result.returncode and first in result.stderr, result.stderr


with tempfile.TemporaryDirectory() as folder:
    check(Path(folder))
