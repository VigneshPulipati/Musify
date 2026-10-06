"""Local yt-dlp bridge for Musify.

Run with: python server.py
Install the optional dependency with: python -m pip install yt-dlp
"""
import json
import subprocess
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, quote, urlparse

HOST, PORT = "127.0.0.1", 8765

def ytdlp(*args):
    return subprocess.run([sys.executable, "-m", "yt_dlp", "--no-warnings", "--quiet", *args],
                          capture_output=True, text=True, timeout=35, check=True)

class Handler(BaseHTTPRequestHandler):
    def send_json(self, data, status=200):
        body = json.dumps(data).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "http://localhost:5173")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "http://localhost:5173")
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        try:
            if parsed.path == "/api/search":
                query = parse_qs(parsed.query).get("q", [""])[0].strip()
                if not query: return self.send_json({"error": "query is required"}, 400)
                output = ytdlp(f"ytsearch8:{query}", "--flat-playlist", "--dump-single-json").stdout
                entries = json.loads(output).get("entries", [])
                tracks = [{"id": item["id"], "title": item.get("title", "Untitled"), "artist": item.get("channel", "YouTube"),
                           "duration": format_duration(item.get("duration")), "thumbnail": item.get("thumbnail") or f"https://i.ytimg.com/vi/{item['id']}/hqdefault.jpg"}
                          for item in entries if item.get("id")]
                return self.send_json(tracks)
            if parsed.path.startswith("/api/stream/"):
                video_id = parsed.path.rsplit("/", 1)[-1]
                if not video_id.isalnum() and "-" not in video_id and "_" not in video_id:
                    return self.send_json({"error": "invalid video id"}, 400)
                url = ytdlp("-f", "bestaudio/best", "--get-url", f"https://www.youtube.com/watch?v={quote(video_id)}").stdout.strip()
                return self.send_json({"url": url})
            return self.send_json({"error": "not found"}, 404)
        except (subprocess.CalledProcessError, subprocess.TimeoutExpired, ModuleNotFoundError) as error:
            detail = "Install yt-dlp with: python -m pip install yt-dlp" if isinstance(error, ModuleNotFoundError) else "yt-dlp could not complete the request"
            self.send_json({"error": detail}, 503)

    def log_message(self, *_):
        pass

def format_duration(seconds):
    if not seconds: return "—"
    seconds = int(seconds)
    return f"{seconds // 60}:{seconds % 60:02d}"

if __name__ == "__main__":
    print(f"Musify yt-dlp service listening on http://{HOST}:{PORT}")
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
