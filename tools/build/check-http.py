import hashlib
import http.client
import json
import re
import sys
import threading
from pathlib import Path
from urllib.parse import quote
from unittest.mock import patch

sys.path.insert(0, sys.argv[1])
import serve


class Handler(serve.Handler):
    def log_message(self, *args):
        pass


def check():
    assert bool(serve.PUBLIC_DIR) == (sys.argv[2] == "production"), "Unexpected server mode"
    root = Path(serve.ROOT)
    files = set(json.load(sys.stdin))
    if serve.PUBLIC_DIR:
        files.update(serve.BUILD_FILES - {"index.html"})
    with patch.object(serve, "versioned_files", side_effect=AssertionError("Request digest walked the tree")):
        assert serve.tree_version() == serve.STARTUP_VERSION
    with serve.Server(("127.0.0.1", 0), Handler) as server:
        threading.Thread(target=server.serve_forever, daemon=True).start()
        port = server.server_port

        def get(path):
            conn = http.client.HTTPConnection("127.0.0.1", port, timeout=10)
            try:
                conn.request("GET", path, headers={"Origin": f"http://127.0.0.1:{port}"})
                response = conn.getresponse()
                return response.status, response.headers, response.read()
            finally:
                conn.close()

        try:
            status, headers, index = get("/")
            assert status == 200 and headers["Cache-Control"] == "no-cache"
            version = re.search(rb"/v/([0-9a-f]{12})/", index)[1].decode()
            if serve.PUBLIC_DIR:
                assert version == serve.BUILD_VERSION
            for file in sorted(files):
                expected = hashlib.sha256((root / file).read_bytes()).digest()
                for prefix in (("", f"/v/{version}") if serve.PUBLIC_DIR else ("",)):
                    status, headers, body = get(prefix + "/" + quote(file))
                    assert status == 200 and hashlib.sha256(body).digest() == expected, file
                    if file.endswith((".js", ".mjs")):
                        assert "javascript" in headers["Content-Type"], file
                    if prefix:
                        assert headers["Cache-Control"] == serve.IMMUTABLE, file
            if serve.PUBLIC_DIR:
                maps = sorted((root / "js").glob("*.js.map"))
                assert maps and all(json.loads(path.read_text())["sources"] for path in maps), "Missing diagnostic maps"
                url = "/js/" + maps[0].name
                assert get(url)[0] == 404 and get(f"/v/{version}" + url)[0] == 404
                for path in ["/.build.json", "/js/app.js", "/core/kernel/kernel.js", "/serve.py"]:
                    assert get(path)[0] == 404, path
        finally:
            server.shutdown()
    print(f"{len(files)} public files served from {root}")


if __name__ == "__main__":
    check()
