"""Local server for Sigma. Serves the editor without browser caching, so code changes show up on reload.

Usage: python3 serve.py [port] [--project PATH]   (port 5173 by default)

With --project (or SIGMA_PROJECT=PATH), Sigma can open that project's Sigma files (.sigma/) and save them
back, and notices when an agent or git changes them on disk:

  GET  /api/project                    the project: { name, files: [{ path, kind, name, mtime, size }], config }
  GET  /api/project/file?path=P        a file's text (header X-Sigma-Mtime: its modification time)
  PUT  /api/project/file?path=P&base=M write a file; M is the mtime it was read at ("new" for a new file).
                                       409 if it changed on disk since (someone else wrote it)

Only .sigma/**/*.json, .sigma/**/*.svg and sigma.config.json can be written. The server listens on
127.0.0.1 only, answers only requests addressed to localhost, and writes only for requests that carry the
X-Sigma header (which pages on other sites can't send), so other websites can't read or change a project.
"""
import http.server
import json
import os
import sys
import tempfile
import urllib.parse

PROJECT = None  # absolute path of the project, or None
_heads = {}  # path -> (mtime_ns, kind, name): what a file is, cached by mtime


def project_files():
    """Every Sigma file in the project, with its kind and name."""
    out = []
    root = os.path.join(PROJECT, ".sigma")
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if not d.startswith(".")]
        for f in sorted(filenames):
            if not f.endswith(".sigma.json"):
                continue
            full = os.path.join(dirpath, f)
            rel = os.path.relpath(full, PROJECT).replace(os.sep, "/")
            st = os.stat(full)
            head = _heads.get(rel)
            if not head or head[0] != st.st_mtime_ns:
                kind, name = "design", f[: -len(".sigma.json")]
                try:
                    with open(full, encoding="utf-8") as fh:
                        data = json.load(fh)
                    kind = data.get("kind") or kind
                    name = data.get("name") or name
                except (ValueError, OSError):
                    kind = "invalid"
                head = (st.st_mtime_ns, kind, name)
                _heads[rel] = head
            out.append({"path": rel, "kind": head[1], "name": head[2], "mtime": str(st.st_mtime_ns), "size": st.st_size})
    return out


def safe_path(rel, writing=False):
    """The absolute path for a project-relative path, or None if it's outside what Sigma may touch."""
    if not rel or rel.startswith("/") or "\\" in rel:
        return None
    full = os.path.realpath(os.path.join(PROJECT, rel))
    if not full.startswith(os.path.realpath(PROJECT) + os.sep):
        return None
    norm = os.path.relpath(full, os.path.realpath(PROJECT)).replace(os.sep, "/")
    if norm == "sigma.config.json":
        return full
    if norm.startswith(".sigma/") and (norm.endswith(".json") or (writing and norm.endswith(".svg")) or norm.endswith(".svg")):
        return full
    return None


class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, fmt, *args):
        # The editor checks the project every 2 seconds: leave those reads out, but log every write.
        if not (self.command == "GET" and self.path.startswith("/api/project")):
            super().log_message(fmt, *args)

    def local_request(self):
        host = (self.headers.get("Host") or "").rsplit(":", 1)[0]
        return host in ("localhost", "127.0.0.1", "[::1]")

    def reply(self, status, body=b"", content_type="application/json", headers=None):
        if isinstance(body, (dict, list)):
            body = json.dumps(body).encode("utf-8")
        elif isinstance(body, str):
            body = body.encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        for k, v in (headers or {}).items():
            self.send_header(k, v)
        self.end_headers()
        self.wfile.write(body)

    def api(self, method):
        url = urllib.parse.urlparse(self.path)
        query = urllib.parse.parse_qs(url.query)
        if not self.local_request():
            return self.reply(403, {"error": "Sigma only answers requests to localhost"})
        if PROJECT is None:
            return self.reply(404, {"error": "No project: start Sigma with python3 serve.py --project PATH"})
        if url.path == "/api/project" and method == "GET":
            config = None
            config_path = os.path.join(PROJECT, "sigma.config.json")
            if os.path.exists(config_path):
                try:
                    with open(config_path, encoding="utf-8") as fh:
                        config = json.load(fh)
                except ValueError:
                    config = {"invalid": True}
            return self.reply(200, {"name": os.path.basename(os.path.realpath(PROJECT)), "files": project_files(), "config": config})
        if url.path != "/api/project/file":
            return self.reply(404, {"error": "Unknown API"})
        rel = (query.get("path") or [""])[0]
        full = safe_path(rel, writing=method == "PUT")
        if not full:
            return self.reply(400, {"error": f"Sigma doesn't read or write {rel!r} (only .sigma/ files and sigma.config.json)"})
        if method == "GET":
            if not os.path.exists(full):
                return self.reply(404, {"error": f"{rel} doesn't exist"})
            with open(full, "rb") as fh:
                data = fh.read()
            return self.reply(200, data, "application/json; charset=utf-8", {"X-Sigma-Mtime": str(os.stat(full).st_mtime_ns)})
        if method == "PUT":
            if self.headers.get("X-Sigma") != "1":
                return self.reply(403, {"error": "Writes need the X-Sigma header"})
            base = (query.get("base") or [""])[0]
            exists = os.path.exists(full)
            current = str(os.stat(full).st_mtime_ns) if exists else None
            if base == "new" and exists:
                return self.reply(409, {"error": f"{rel} already exists", "mtime": current})
            if base and base != "new" and base != current:
                return self.reply(409, {"error": f"{rel} changed on disk since it was read", "mtime": current})
            length = int(self.headers.get("Content-Length") or 0)
            data = self.rfile.read(length)
            os.makedirs(os.path.dirname(full), exist_ok=True)
            fd, tmp = tempfile.mkstemp(dir=os.path.dirname(full), prefix=".sigma-")
            with os.fdopen(fd, "wb") as fh:
                fh.write(data)
            os.replace(tmp, full)  # all or nothing: an agent never reads half a file
            return self.reply(200, {"path": rel, "mtime": str(os.stat(full).st_mtime_ns)})
        return self.reply(405, {"error": "Method not allowed"})

    def do_GET(self):
        if self.path.startswith("/api/"):
            return self.api("GET")
        return super().do_GET()

    def do_PUT(self):
        if self.path.startswith("/api/"):
            return self.api("PUT")
        return self.reply(405)


if __name__ == "__main__":
    args = sys.argv[1:]
    if "--project" in args:
        i = args.index("--project")
        PROJECT = args[i + 1] if i + 1 < len(args) else None
        del args[i : i + 2]
    PROJECT = PROJECT or os.environ.get("SIGMA_PROJECT")
    if PROJECT:
        PROJECT = os.path.abspath(PROJECT)
        if not os.path.isdir(PROJECT):
            sys.exit(f"No such project folder: {PROJECT}")
    port = int(args[0]) if args else 5173
    os.chdir(os.path.dirname(os.path.abspath(__file__)))  # serve the editor whatever the working directory
    server = http.server.ThreadingHTTPServer(("127.0.0.1", port), Handler)
    print(f"Sigma running at http://localhost:{port}  (Ctrl+C to stop)")
    if PROJECT:
        print(f"Project: {PROJECT}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
