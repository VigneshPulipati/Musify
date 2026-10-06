# Pulse

A local-first music player UI for searching YouTube through `yt-dlp`, streaming audio, and managing a persistent queue.

## Run it

```powershell
npm install
python -m pip install yt-dlp
```

In one terminal:

```powershell
python server.py
```

In another:

```powershell
npm run dev
```

Open <http://localhost:5173>. The UI includes a demo catalog when the local service is unavailable; live search and playback require `yt-dlp`.

Use only content you have the right to access. YouTube's terms and content-owner restrictions apply.
