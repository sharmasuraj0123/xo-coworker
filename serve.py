#!/usr/bin/env python3
"""Serve the XO UI and proxy its API, event streams and terminal WebSockets."""

from __future__ import annotations

import gzip
import hashlib
import http.client
import ipaddress
import json
import mimetypes
import os
import posixpath
import re
import socket
import sys
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import unquote, urlsplit

SOURCE_ROOT = os.path.dirname(os.path.abspath(__file__))
HOST = os.environ.get("HOST", "127.0.0.1")
PORT = int(os.environ.get("PORT", "5180"))
XO_API = os.environ.get("XO_API", "http://127.0.0.1:5002").rstrip("/")
_UP = urlsplit(XO_API)
if _UP.scheme not in ("http", "https") or not _UP.hostname:
    sys.exit(f"XO_API must be an http(s) URL, got {XO_API!r}")

# The proxy validates origin itself and omits browser origin and hop-by-hop headers upstream.
DROP_REQUEST = {
    "host", "connection", "keep-alive", "proxy-connection", "te", "trailer",
    "transfer-encoding", "upgrade", "origin", "referer", "accept-encoding",
    "content-length", "sec-fetch-site", "sec-fetch-mode", "sec-fetch-dest",
    "sec-fetch-user",
    # Coder's app proxy consumes this token before requests reach the backend.
    "coder-session-token",
    # The UI's writer key is this server's to add (`writer_key`), never a page's to send.
    "x-xo-ui-writer",
}
# The same token in a query string (EventSource can't send headers).
TOKEN_PARAM = "coder_session_token"


def strip_token(path: str) -> str:
    """`path` without the Coder token in its query, for forwarding and logs."""
    base, sep, query = path.partition("?")
    if not sep:
        return path
    kept = [p for p in query.split("&") if p.split("=", 1)[0] != TOKEN_PARAM]
    return base + ("?" + "&".join(kept) if kept else "")
DROP_RESPONSE = {
    "connection", "keep-alive", "transfer-encoding", "content-length", "server", "date",
    "access-control-allow-origin", "access-control-allow-credentials",
}
WRITE_METHODS = {"POST", "PUT", "PATCH", "DELETE"}
NEVER_FORWARD = [
    ("GET", re.compile(r"^/api/secrets/env$")),
    ("GET", re.compile(r"^/api/secrets/.+/reveal$")),
    ("PUT", re.compile(r"^/api/secrets/env$")),
    ("PUT", re.compile(r"^/api/secrets$")),
    ("POST", re.compile(r"^/api/files/content$")),
    ("POST", re.compile(r"^/api/files/content-binary$")),
    ("POST", re.compile(r"^/api/files/list-directory$")),
    # writes anywhere under $HOME; this UI creates folders only with /api/files/mkdir
    ("POST", re.compile(r"^/api/files/save$")),
    ("POST", re.compile(r"^/api/files/upload$")),
    # An agent profile's secrets file, unmasked (Hermes), and its whole-file replace: every method.
    ("*", re.compile(r"^/api/agents/[^/]+/[^/]+/secrets$")),
]


# Add the writer key only to matching routes after the origin check.
WRITER_ROUTES = [
    ("PUT", re.compile(r"^/api/xo-projects/[^/]+/file$")),
    ("POST", re.compile(r"^/api/xo-projects/[^/]+/edits/[^/]+/undo$")),
    ("POST", re.compile(r"^/api/xo-projects/[^/]+/files/(?:rename|delete|mkdir)$")),
    # deleting a thread and taking it back (xo-space asks for the key)
    ("DELETE", re.compile(r"^/api/chat/chats/[^/]+/threads/[^/]+$")),
    ("POST", re.compile(r"^/api/chat/chats/[^/]+/threads/[^/]+/restore$")),
    # installing, granting, updating and removing apps; an agent's curl may read the list, never change it
    ("POST", re.compile(r"^/api/apps/installs(?:/[^/]+/confirm)?$")),
    ("POST", re.compile(r"^/api/apps/[^/]+/(?:update|rollback|stop|start)$")),
    ("PUT", re.compile(r"^/api/apps/[^/]+/(?:grants|settings)$")),
    ("DELETE", re.compile(r"^/api/apps/[^/]+(?:/grants)?$")),
    # an app view's calls, made for the person by this page's bridge: every method
    ("*", re.compile(r"^/api/coworker/apps/[^/]+/.+$")),
]
_WRITER = {"stamp": None, "key": None}


def clean_path(path: str) -> str:
    """Normalize the route to the spelling used by the proxy's checks."""
    p = unquote(unquote(re.split(r"[?#]", path, maxsplit=1)[0]))
    return re.sub(r"/+", "/", p).rstrip("/") or "/"


# Space's runtime sign-in routes, which it serves outside /api: forwarded only in this exact spelling.
SIGN_IN = re.compile(r"^/connect/(claude-code|codex|antigravity)(/callback)?$")


def sign_in_route(method: str, path: str) -> bool:
    """True for a runtime sign-in: POST to start one or send its code, DELETE to cancel it."""
    return method in ("POST", "DELETE") and bool(SIGN_IN.match(path.split("?", 1)[0]))


def writer_route(method: str, path: str) -> bool:
    """True for a request that carries the writer key upstream: a file save or an undo, in any spelling."""
    p = clean_path(path)
    return any(m in (method, "*") and rx.match(p) for m, rx in WRITER_ROUTES)


def writer_key_path() -> str:
    """Find the UI writer key in the Space state directory."""
    root = (os.environ.get("QUIRQ_STATE_ROOT") or "").strip() or os.path.join(os.path.expanduser("~"), ".quirq")
    return os.path.join(os.path.expanduser(root), "secrets", "ui-writer.key")


def writer_key() -> str | None:
    """Read the key again when its file changes, or return None if it is unusable."""
    path = writer_key_path()
    try:
        st = os.stat(path)
    except OSError:
        return None
    stamp = (st.st_ino, st.st_mtime_ns, st.st_size)
    if _WRITER["stamp"] != stamp:
        try:
            with open(path, encoding="ascii") as fh:
                value = fh.read().strip()
        except (OSError, UnicodeDecodeError):
            value = ""
        _WRITER["stamp"], _WRITER["key"] = stamp, value if re.fullmatch(r"[0-9a-f]{64}", value) else None
    return _WRITER["key"]


def never_forward(method: str, path: str) -> bool:
    """Check whether the requested route is blocked by the proxy."""
    p = clean_path(path)
    return any(m in (method, "*") and rx.match(p) for m, rx in NEVER_FORWARD)


def odd_path(path: str) -> bool:
    """Reject fragment markers or dot segments before routing."""
    p = unquote(unquote(path.split("?", 1)[0]))
    return "#" in path or "#" in p or any(seg in (".", "..") for seg in p.split("/"))


def host_port(value: str) -> tuple[str, int | None] | None:
    """Parse and normalize a Host header, or return None for a malformed value."""
    if not value or any(c.isspace() for c in value):
        return None
    try:
        parts = urlsplit("//" + value)
        host, port = parts.hostname, parts.port
    except ValueError:
        return None
    if not host or parts.path or parts.query or parts.fragment or parts.username is not None:
        return None
    return host, port


def is_localhost_or_ip(host: str) -> bool:
    """`localhost` or an IP literal: names DNS rebinding cannot point anywhere, since it needs a DNS name."""
    if host == "localhost":
        return True
    try:
        ipaddress.ip_address(host)
    except ValueError:
        return False
    return True


def is_loopback(peer: str) -> bool:
    """True for a TCP peer on this machine (127.0.0.0/8, ::1, or 127.x mapped into IPv6)."""
    try:
        ip = ipaddress.ip_address(peer)
    except ValueError:
        return False
    return (getattr(ip, "ipv4_mapped", None) or ip).is_loopback


HOSTNAME = re.compile(r"^[a-z0-9_.-]+$")


def own_origins(host_values: list[str], forwarded_hosts: list[str], via_local_proxy: bool,
                own_port: int) -> list[tuple[str, str, int]] | None:
    """Only a loopback proxy can claim an HTTPS hostname on a port other than the listening port."""
    if len(host_values) != 1:
        return None
    origins = []
    for value in host_values + forwarded_hosts:
        addr = host_port(value.strip())
        if addr is None:
            return None
        host, port = addr
        if is_localhost_or_ip(host):
            if (80 if port is None else port) != own_port:
                return None
            origins.append(("http", host, own_port))
        else:
            if (not via_local_proxy or not HOSTNAME.match(host) or own_port in (80, 443)
                    or port == own_port):
                return None
            origins.append(("https", host, 443 if port is None else port))
    return origins


def parse_origin(origin: str) -> tuple[str, str, int] | None:
    """`(scheme, host, port)` of a well-formed http(s) Origin header, else None (`null` included)."""
    if any(c.isspace() for c in origin):
        return None
    try:
        parts = urlsplit(origin)
        host, port = parts.hostname, parts.port
    except ValueError:
        return None
    if (parts.scheme not in ("http", "https") or not host or parts.username is not None
            or parts.path or parts.query or parts.fragment):
        return None
    return parts.scheme, host, port if port is not None else (443 if parts.scheme == "https" else 80)


MAX_BODY = 1 << 20  # 1 MiB is plenty for a chat message
# Give the backend room to return its own attachment limit message.
UPLOAD = re.compile(r"^/api/chat/chats/[^/]+/attachments$")
MAX_UPLOAD = 25 * (1 << 20) + (64 << 10)


# The one WebSocket this UI opens: a shell's terminal. Every other upgrade is refused.
WS_PATH = re.compile(r"^/api/terminal/sessions/[A-Za-z0-9_-]{16,64}/ws$")


def ws_header(name: str) -> bool:
    """Allow only the headers needed for the upstream WebSocket handshake."""
    name = name.lower()
    return name in ("upgrade", "connection") or name.startswith("sec-websocket-")


def max_body(method: str, path: str) -> int:
    """The largest request body forwarded for this route: MAX_UPLOAD for an attachment upload, else MAX_BODY."""
    return MAX_UPLOAD if method == "POST" and UPLOAD.match(path.split("?", 1)[0]) else MAX_BODY


def read_build(root):
    with open(os.path.join(root, ".build.json"), encoding="utf-8") as source:
        manifest = json.load(source)
    version = manifest["version"]
    files = frozenset(manifest["files"])
    if not re.fullmatch(r"[0-9a-f]{12}", version) or "index.html" not in files:
        raise ValueError("Invalid public build manifest")
    for name in files:
        if any(not part or part.startswith(".") for part in name.split("/")):
            raise ValueError("Invalid public asset path")
    return version, files


def selected_builds(root):
    try:
        with open(os.path.join(root, "dist", "current"), encoding="ascii") as pointer:
            versions = pointer.read(64).splitlines()
    except FileNotFoundError:
        return {}
    if not 1 <= len(versions) <= 2 or any(not re.fullmatch(r"[0-9a-f]{12}", version) for version in versions):
        raise ValueError("Invalid production release selection")
    releases = {}
    for version in versions:
        directory = os.path.join(root, "dist", version)
        digest, files = read_build(directory)
        if digest != version:
            raise ValueError(f"Production release digest does not match {directory}")
        releases[version] = directory, files
    return releases


RELEASES = {} if os.environ.get("XO_SERVE_RAW") == "1" else selected_builds(SOURCE_ROOT)
BUILD_VERSION = next(iter(RELEASES), None)
PUBLIC_DIR, BUILD_FILES = RELEASES.get(BUILD_VERSION, (None, frozenset()))
ROOT = PUBLIC_DIR or SOURCE_ROOT
VERSIONED_DIRS = ("js", "css", "fonts", "presets", "assets", "core", "shell", "modules", "apps-host", "vendor")
VERSIONED_FILES = ("boot.js", "favicon.svg")
if PUBLIC_DIR:
    VERSIONED_DIRS = tuple(sorted({f.split("/")[0] for f in BUILD_FILES if "/" in f}))
    VERSIONED_FILES = tuple(sorted(f for f in BUILD_FILES if "/" not in f and f != "index.html"))
directory_pattern = "|".join(map(re.escape, VERSIONED_DIRS) if PUBLIC_DIR else VERSIONED_DIRS)
STATIC_PATH = r"(?:%s)/[^\"]+|(?:%s)" % (directory_pattern, "|".join(map(re.escape, VERSIONED_FILES)))
VERSION_PATH = re.compile(r"^/v/([0-9a-f]{12})(/(?:%s))$" % STATIC_PATH)
RELEASE_PATH = re.compile(r"/v/([0-9a-f]{12})(/.+)")
INDEX_PATH = re.compile(r'((?:href|src)=")\./(%s)(?=")' % STATIC_PATH)
IMMUTABLE = "public, max-age=31536000, immutable"
GZIP_TYPES = ("text/", "application/json", "application/javascript", "image/svg+xml", "application/xml")
GZIP_MIN = 1024
_GZ: dict[str, tuple[tuple, bytes]] = {}


def _stamp(st: os.stat_result) -> tuple:
    return (st.st_ino, st.st_mtime_ns, st.st_size)


def public_asset(root: str, path: str, manifest=None) -> bool:
    relative = os.path.relpath(path, root)
    if manifest is None and PUBLIC_DIR and root == ROOT:
        manifest = BUILD_FILES
    parts = relative.split(os.sep)
    if any(part.startswith(".") or part == "tests" for part in parts):
        return False
    if manifest is not None:
        if relative not in manifest or relative == "index.html":
            return False
    elif relative not in VERSIONED_FILES and (len(parts) == 1 or parts[0] not in VERSIONED_DIRS):
        return False
    if os.path.realpath(path) != os.path.join(os.path.realpath(root), relative):
        return False
    return os.path.isfile(path)


def versioned_files(root: str):
    if PUBLIC_DIR and root == ROOT:
        for name in sorted(BUILD_FILES):
            path = os.path.join(root, name)
            if public_asset(root, path):
                yield path
        return
    for name in VERSIONED_FILES:
        path = os.path.join(root, name)
        if public_asset(root, path):
            yield path
    for top in VERSIONED_DIRS:
        base = os.path.join(root, top)
        if os.path.islink(base):
            continue
        for directory, dirs, files in os.walk(base):
            dirs[:] = sorted(d for d in dirs if not d.startswith(".") and d != "tests")
            for name in sorted(files):
                path = os.path.join(directory, name)
                if not name.startswith(".") and not os.path.islink(path):
                    yield path


def source_digest(root):
    h = hashlib.sha1()
    for path in versioned_files(root):
        try:
            with open(path, "rb") as fh:
                content = hashlib.sha1(fh.read()).hexdigest()
        except OSError:
            continue
        h.update(f"{os.path.relpath(path, root)}\0{content}\n".encode())
    return h.hexdigest()[:12]


STARTUP_VERSION = BUILD_VERSION or source_digest(ROOT)


def tree_version(root: str = ROOT) -> str:
    return STARTUP_VERSION if root == ROOT else source_digest(root)


def versioned_index(html: str, version: str) -> str:
    """index.html with its local links under /v/<version>/ and an import map doing the same for module imports."""
    prefix = f"./v/{version}/"
    html = INDEX_PATH.sub(lambda m: f"{m[1]}{prefix}{m[2]}", html)
    imap = '<script type="importmap">{"imports":{"./js/":"%sjs/"}}</script>' % prefix
    imap = f'<meta name="xo-ui-version" content="{version}">' + imap
    at = re.search(r"<meta charset=[^>]*>", html) or re.search(r"<head[^>]*>", html)
    return html[:at.end()] + "\n  " + imap + html[at.end():] if at else imap + html


def accepts_gzip(header: str | None) -> bool:
    """True when Accept-Encoding allows gzip (not refused with q=0)."""
    for part in (header or "").lower().split(","):
        name, _, params = part.strip().partition(";")
        if name.strip() in ("gzip", "*"):
            q = re.search(r"q=([0-9.]+)", params)
            return not q or float(q[1]) > 0
    return False


def gzippable(ctype: str, size: int) -> bool:
    return size >= GZIP_MIN and ctype.split(";")[0].strip().lower().startswith(GZIP_TYPES)


def gzipped(path: str, st: os.stat_result) -> bytes:
    got = _GZ.get(path)
    if not got or got[0] != _stamp(st):
        with open(path, "rb") as fh:
            got = (_stamp(st), gzip.compress(fh.read(), 6, mtime=0))
        _GZ[path] = got
    return got[1]


_WARMED = {"version": None}


def warm_gzip(version: str, root: str = ROOT) -> None:
    """Gzip a new version's text files once, off the request path, so its first visit doesn't wait on it."""
    if _WARMED["version"] == version:
        return
    _WARMED["version"] = version

    def run():
        for path in versioned_files(root):
            try:
                st = os.stat(path)
                if gzippable(mimetypes.guess_type(path)[0] or "", st.st_size):
                    gzipped(path, st)
            except OSError:
                pass
    threading.Thread(target=run, daemon=True).start()


class Handler(SimpleHTTPRequestHandler):
    server_version = "xo-chat-ui"
    protocol_version = "HTTP/1.1"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    # ── who may ask: checked before any routing ──────────────────────────────
    def parse_request(self) -> bool:
        """Validate the destination before dispatching any request."""
        if not super().parse_request():
            return False
        if self._own_origins() is None:
            # its body, if any, is still unread: don't reuse the connection
            self.close_connection = True
            self._json_error(421, "bad_host", "This server only answers requests addressed to it as localhost, "
                                              "an IP address, or a hostname through a proxy on this machine.")
            return False
        return True

    def _own_origins(self) -> list[tuple[str, str, int]] | None:
        """The origins this request was addressed to (Host, X-Forwarded-Host), or None when refused."""
        forwarded = [v for h in self.headers.get_all("X-Forwarded-Host") or [] for v in h.split(",")]
        return own_origins(self.headers.get_all("Host") or [], forwarded, is_loopback(self.client_address[0]),
                           self.server.server_address[1])

    # ── routing ──────────────────────────────────────────────────────────────
    def do_GET(self):
        if "Upgrade" in self.headers:
            return self._tunnel()
        if self._is_api():
            return self._proxy()
        return self._static()

    def do_HEAD(self):
        if "Upgrade" in self.headers:
            return self._tunnel()
        if self._is_api():
            return self._proxy()
        return self._static()

    # ── static ───────────────────────────────────────────────────────────────
    _cache = "no-cache"

    def _static(self):
        self._cache = "no-cache"
        self.directory = ROOT
        manifest = BUILD_FILES if PUBLIC_DIR else None
        path, _, query = self.path.partition("?")
        if path in ("/", "/index.html"):
            return self._index()
        version_path = RELEASE_PATH if PUBLIC_DIR else VERSION_PATH
        m = version_path.fullmatch(posixpath.normpath(unquote(path)))
        if path.startswith("/v/") and not m:
            return self.send_error(404)
        if m:
            if PUBLIC_DIR:
                release = RELEASES.get(m[1])
                if release is None:
                    return self.send_error(404)
                self.directory, manifest = release
                self._cache = IMMUTABLE
            self.path = m[2] + ("?" + query if query else "")
        file = self.translate_path(self.path)
        if not public_asset(self.directory, file, manifest):
            return self.send_error(404)
        ctype = self.guess_type(file)
        try:
            st = os.stat(file)
        except OSError:
            st = None
        if st is None or not os.path.isfile(file) or not gzippable(ctype, st.st_size) \
                or not accepts_gzip(self.headers.get("Accept-Encoding")):
            return super().do_GET() if self.command == "GET" else super().do_HEAD()
        etag = '"%x-%x-gz"' % (st.st_mtime_ns, st.st_size)
        if self.headers.get("If-None-Match") == etag:
            return self._not_modified(etag)
        self._send_bytes(gzipped(file, st), ctype, etag, encoded=True,
                         modified=self.date_time_string(int(st.st_mtime)))

    def _index(self):
        try:
            with open(os.path.join(ROOT, "index.html"), encoding="utf-8") as fh:
                version = tree_version()
                html = versioned_index(fh.read(), version)
            warm_gzip(version)
        except OSError:
            return self.send_error(404)
        body = html.encode()
        etag = '"%s"' % hashlib.sha1(body).hexdigest()[:16]
        if self.headers.get("If-None-Match") == etag:
            return self._not_modified(etag)
        encoded = accepts_gzip(self.headers.get("Accept-Encoding"))
        self._send_bytes(gzip.compress(body, 6, mtime=0) if encoded else body, "text/html; charset=utf-8", etag,
                         encoded=encoded)

    def _not_modified(self, etag: str):
        self.send_response(304)
        self.send_header("ETag", etag)
        self.send_header("Vary", "Accept-Encoding")
        self.end_headers()

    def _send_bytes(self, data: bytes, ctype: str, etag: str, encoded: bool, modified: str | None = None):
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        if encoded:
            self.send_header("Content-Encoding", "gzip")
        self.send_header("Vary", "Accept-Encoding")
        self.send_header("ETag", etag)
        if modified:
            self.send_header("Last-Modified", modified)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(data)

    def do_POST(self):
        if "Upgrade" in self.headers:
            return self._tunnel()
        return self._proxy() if self._is_api() else self.send_error(405)

    do_PUT = do_PATCH = do_DELETE = do_POST

    def _is_api(self) -> bool:
        path = self.path.split("?", 1)[0]
        return path == "/api" or path.startswith("/api/") or sign_in_route(self.command, self.path)

    def end_headers(self):
        if not self._is_api():
            self.send_header("Cache-Control", self._cache)
            if self.path.partition("?")[0] in ("/", "/index.html"):
                self.send_header("X-XO-UI-Version", STARTUP_VERSION)
        super().end_headers()

    def list_directory(self, path):  # no directory listings
        self.send_error(404)
        return None

    def log_message(self, fmt, *args):
        if "/stream" in self.path and os.environ.get("XO_UI_QUIET_STREAM", "1") == "1":
            return
        line = (fmt % args).replace(self.path, strip_token(self.path))
        sys.stderr.write("%s - %s\n" % (self.log_date_time_string(), line))

    def _from_own_page(self) -> bool:
        """True only for a request a page of this UI sent: same-origin Sec-Fetch-Site and Origin, both present."""
        origin = self.headers.get("Origin")
        return self.headers.get("Sec-Fetch-Site") == "same-origin" and origin is not None and parse_origin(origin) in (self._own_origins() or [])

    # ── same-origin check for writes ─────────────────────────────────────────
    def _write_allowed(self) -> bool:
        """True for a request from a page this server served, or from no page at all."""
        site = self.headers.get("Sec-Fetch-Site")
        # Browsers set this and pages cannot forge it.
        if site is not None and site not in ("same-origin", "none"):
            return False
        origin = self.headers.get("Origin")
        if origin is None:
            return True  # curl, scripts, a same-origin read: not a cross-origin page
        # Match scheme, host and port against the validated destination.
        return parse_origin(origin) in (self._own_origins() or [])

    def _json_error(self, status: int, code: str, message: str):
        body = ('{"detail":{"code":"%s","message":"%s"}}' % (code, message.replace('"', "'"))).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    # ── proxy ────────────────────────────────────────────────────────────────
    def _proxy(self):
        method = self.command
        # Reject paths the backend would normalize differently.
        if odd_path(self.path):
            return self._json_error(400, "bad_target", "This UI never sends a request path like this.")
        if never_forward("GET" if method == "HEAD" else method, self.path):
            return self._json_error(403, "not_forwarded", "This UI never uses this route: it exposes secret values or raw files.")
        # Apply the origin check to reads as well as writes.
        if not self._write_allowed():
            msg = "Cross-origin writes are refused by the UI proxy." if method in WRITE_METHODS else "This is only answered for pages served by this UI."
            return self._json_error(403, "cross_origin", msg)

        length = int(self.headers.get("Content-Length") or 0)
        cap = max_body(method, self.path)
        if length > cap:
            # the browser may still be sending: don't read it, and don't keep the connection
            self.close_connection = True
            return self._json_error(413, "too_large", "A file may be at most 25 MB." if cap == MAX_UPLOAD else "Request body is too large.")
        body = self.rfile.read(length) if length else None

        headers = {k: v for k, v in self.headers.items() if k.lower() not in DROP_REQUEST}
        if writer_route(method, self.path):
            if not self._from_own_page():
                return self._json_error(403, "not_a_page", "Only XO's own page may do this.")
            key = writer_key()
            if key is None:
                return self._json_error(503, "writer_key_missing", "XO Space hasn't given this UI its key for saving files yet.")
            headers["X-XO-UI-Writer"] = key
        headers["Host"] = _UP.netloc
        headers["Accept-Encoding"] = "identity"
        if body is not None:
            headers["Content-Length"] = str(len(body))
        target = (_UP.path.rstrip("/") or "") + strip_token(self.path)
        p = self.path.split("?", 1)[0]
        is_stream = "/stream" in p or (sign_in_route(method, p) and not p.endswith("/callback"))

        conn_cls = http.client.HTTPSConnection if _UP.scheme == "https" else http.client.HTTPConnection
        conn = conn_cls(_UP.hostname, _UP.port, timeout=None if is_stream else 120)
        try:
            conn.request(method, target, body=body, headers=headers)
            resp = conn.getresponse()
        except (OSError, http.client.HTTPException) as exc:
            conn.close()
            return self._json_error(502, "upstream_unreachable",
                                    f"Could not reach the XO API at {XO_API} ({type(exc).__name__}).")

        try:
            ctype = resp.getheader("Content-Type", "")
            if ctype.startswith("text/event-stream"):
                self._relay_stream(resp)
            else:
                data = resp.read()
                encode = (method != "HEAD" and resp.status == 200 and not resp.getheader("Content-Encoding")
                          and gzippable(ctype, len(data)) and accepts_gzip(self.headers.get("Accept-Encoding")))
                if encode:
                    data = gzip.compress(data, 5, mtime=0)
                self.send_response(resp.status, resp.reason)
                for k, v in resp.getheaders():
                    if k.lower() not in DROP_RESPONSE:
                        self.send_header(k, v)
                if encode:
                    self.send_header("Content-Encoding", "gzip")
                    self.send_header("Vary", "Accept-Encoding")
                self.send_header("Content-Length", str(len(data)))
                self.end_headers()
                if method != "HEAD":
                    self.wfile.write(data)
        except (BrokenPipeError, ConnectionResetError, socket.timeout):
            pass  # the browser went away
        finally:
            conn.close()

    # ── WebSocket tunnel ─────────────────────────────────────────────────────
    def _tunnel(self):
        """Validate and relay a terminal WebSocket until either side ends."""
        self.close_connection = True
        path = self.path.split("?", 1)[0]
        if self.command != "GET" or self.headers.get("Upgrade", "").strip().lower() != "websocket":
            return self._json_error(400, "bad_upgrade", "This server only upgrades a GET to a WebSocket.")
        if odd_path(self.path):
            return self._json_error(400, "bad_target", "This UI never sends a request path like this.")
        if not WS_PATH.match(path):
            return self._json_error(404, "not_found", "No WebSocket route here.")
        # Browsers apply neither CORS nor the same-origin policy to a WebSocket, but always send its Origin.
        if not self._write_allowed():
            return self._json_error(403, "cross_origin", "This is only answered for pages served by this UI.")
        if _UP.scheme != "http":
            # One TLS connection can't be read and written from two threads at once.
            return self._json_error(502, "upstream_unsupported", "The shell's WebSocket is only tunnelled to an http XO_API.")
        try:
            up = socket.create_connection((_UP.hostname, _UP.port or 80), timeout=10)
        except OSError as exc:
            return self._json_error(502, "upstream_unreachable",
                                    f"Could not reach the XO API at {XO_API} ({type(exc).__name__}).")
        # The query is dropped, and with it coder_session_token; the shell's ticket comes in the first message.
        lines = [f"GET {_UP.path.rstrip('/')}{path} HTTP/1.1", f"Host: {_UP.netloc}"]
        lines += [f"{k}: {' '.join(v.split())}" for k, v in self.headers.items() if ws_header(k)]
        try:
            up.sendall(("\r\n".join(lines) + "\r\n\r\n").encode("latin-1"))
        except OSError as exc:
            up.close()
            return self._json_error(502, "upstream_unreachable",
                                    f"Could not reach the XO API at {XO_API} ({type(exc).__name__}).")
        up.settimeout(None)
        self.wfile.flush()
        client = self.connection
        self.log_message("WebSocket open %s", path)

        def pump(read, dst):
            try:
                while chunk := read(65536):
                    dst.sendall(chunk)
            except OSError:
                pass
            finally:  # either side ending ends both
                for s in (client, up):
                    try:
                        s.shutdown(socket.SHUT_RDWR)
                    except OSError:
                        pass

        back = threading.Thread(target=pump, args=(up.recv, client), daemon=True)
        back.start()
        # Read through rfile first because it can contain bytes buffered during the handshake.
        pump(self.rfile.read1, up)
        back.join(5)
        up.close()
        self.log_message("WebSocket closed %s", path)

    def _relay_stream(self, resp):
        """Forward an SSE body as it arrives: no buffering, flush every chunk."""
        self.close_connection = True
        self.send_response(resp.status, resp.reason)
        self.send_header("Content-Type", "text/event-stream; charset=utf-8")
        self.send_header("Cache-Control", "no-cache, no-store")
        self.send_header("X-Accel-Buffering", "no")
        self.send_header("Connection", "close")
        self.end_headers()
        self.wfile.flush()
        try:
            self.connection.setsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY, 1)
        except OSError:
            pass
        while True:
            chunk = resp.read1(65536)
            if not chunk:
                break
            self.wfile.write(chunk)
            self.wfile.flush()


class Server(ThreadingHTTPServer):
    daemon_threads = True
    allow_reuse_address = True


def main():
    httpd = Server((HOST, PORT), Handler)
    mode = "release" if BUILD_VERSION else "source"
    print(f"XO chat UI on http://{HOST}:{httpd.server_port} serving {mode} {STARTUP_VERSION}; proxying /api/* to {XO_API}", flush=True)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        httpd.server_close()


if __name__ == "__main__":
    main()
