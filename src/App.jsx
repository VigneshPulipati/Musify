import { useEffect, useMemo, useRef, useState } from "react";
import {
  AudioLines, ChevronDown, Clock3, Disc3, Heart, ListMusic, LoaderCircle,
  Menu, MoreHorizontal, Pause, Play, Plus, Search, SkipBack, SkipForward,
  Sparkles, Volume2, X
} from "lucide-react";

const API = import.meta.env.VITE_API_URL || "http://127.0.0.1:8765";
const demoTracks = [
  { id: "demo-1", title: "Midnight City", artist: "M83", duration: "4:03", thumbnail: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=480&q=80" },
  { id: "demo-2", title: "Sunset Lover", artist: "Petit Biscuit", duration: "3:58", thumbnail: "https://images.unsplash.com/photo-1519608487953-e999c86e7455?w=480&q=80" },
  { id: "demo-3", title: "The Less I Know The Better", artist: "Tame Impala", duration: "3:36", thumbnail: "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=480&q=80" },
  { id: "demo-4", title: "Intro", artist: "The xx", duration: "2:07", thumbnail: "https://images.unsplash.com/photo-1524368535928-5b5e00ddc76b?w=480&q=80" }
];
const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
const hashPassword = async (password, salt) => {
  const bytes = new TextEncoder().encode(password);
  const key = await crypto.subtle.importKey("raw", bytes, "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt: new TextEncoder().encode(salt), iterations: 120000, hash: "SHA-256" }, key, 256);
  return btoa(String.fromCharCode(...new Uint8Array(bits)));
};

function App() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState(demoTracks);
  const [queue, setQueue] = useState(() => read("pulse-queue", []));
  const [current, setCurrent] = useState(() => read("pulse-current", null));
  const [favorites, setFavorites] = useState(() => read("pulse-favorites", []));
  const [recent, setRecent] = useState(() => read("pulse-recent", []));
  const [playlists, setPlaylists] = useState(() => read("pulse-playlists", []));
  const [view, setView] = useState("discover");
  const [selectedPlaylist, setSelectedPlaylist] = useState(null);
  const [showPlaylistForm, setShowPlaylistForm] = useState(false);
  const [showAccountForm, setShowAccountForm] = useState(false);
  const [accountMode, setAccountMode] = useState("register");
  const [accountName, setAccountName] = useState("");
  const [accountPassword, setAccountPassword] = useState("");
  const [accountError, setAccountError] = useState("");
  const [accountBusy, setAccountBusy] = useState(false);
  const [user, setUser] = useState(() => read("pulse-session", null));
  const [playlistName, setPlaylistName] = useState("");
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [volume, setVolume] = useState(72);
  const [progress, setProgress] = useState(0);
  const audio = useRef(new Audio());

  useEffect(() => localStorage.setItem("pulse-queue", JSON.stringify(queue)), [queue]);
  useEffect(() => localStorage.setItem("pulse-current", JSON.stringify(current)), [current]);
  useEffect(() => localStorage.setItem("pulse-favorites", JSON.stringify(favorites)), [favorites]);
  useEffect(() => localStorage.setItem("pulse-recent", JSON.stringify(recent)), [recent]);
  useEffect(() => localStorage.setItem("pulse-playlists", JSON.stringify(playlists)), [playlists]);
  useEffect(() => {
    const player = audio.current;
    player.volume = volume / 100;
    const update = () => setProgress(player.duration ? player.currentTime / player.duration : 0);
    const ended = () => { setPlaying(false); next(); };
    player.addEventListener("timeupdate", update); player.addEventListener("ended", ended);
    return () => { player.pause(); player.removeEventListener("timeupdate", update); player.removeEventListener("ended", ended); };
  }, [queue, current]);
  useEffect(() => { audio.current.volume = volume / 100; }, [volume]);

  const search = async (event) => {
    event?.preventDefault(); if (!query.trim()) return;
    setLoading(true); setError("");
    try {
      const response = await fetch(`${API}/api/search?q=${encodeURIComponent(query.trim())}`);
      if (!response.ok) throw new Error();
      setResults(await response.json()); setView("discover");
    } catch { setError("Could not reach yt-dlp. Showing demo tracks instead."); setResults(demoTracks); }
    finally { setLoading(false); }
  };
  const play = async (track) => {
    setCurrent(track); setPlaying(true); setProgress(0);
    setRecent((items) => [track, ...items.filter((item) => item.id !== track.id)].slice(0, 20));
    let playable = track;
    if (!track.url && !track.id.startsWith("demo-")) {
      try {
        const response = await fetch(`${API}/api/stream/${track.id}`);
        if (!response.ok) throw new Error();
        playable = { ...track, url: (await response.json()).url }; setCurrent(playable);
      } catch { setError("Start server.py and install yt-dlp to stream this result."); setPlaying(false); return; }
    }
    if (playable.url) { audio.current.src = playable.url; await audio.current.play().catch(() => setPlaying(false)); }
  };
  const next = () => { const index = queue.findIndex((item) => item.id === current?.id); if (queue[index + 1]) play(queue[index + 1]); };
  const previous = () => { const index = queue.findIndex((item) => item.id === current?.id); if (index > 0) play(queue[index - 1]); };
  const toggleQueue = (track) => setQueue((items) => items.some((item) => item.id === track.id) ? items.filter((item) => item.id !== track.id) : [...items, track]);
  const toggleFavorite = (track) => setFavorites((items) => items.some((item) => item.id === track.id) ? items.filter((item) => item.id !== track.id) : [...items, track]);
  const createPlaylist = (event) => {
    event.preventDefault(); const name = playlistName.trim(); if (!name) return;
    const playlist = { id: crypto.randomUUID(), name, tracks: [] };
    setPlaylists((items) => [...items, playlist]); setPlaylistName(""); setShowPlaylistForm(false); setSelectedPlaylist(playlist.id); setView("playlist");
  };
  const openAccount = (mode = "register") => {
    setAccountMode(mode); setAccountError(""); setAccountName(""); setAccountPassword(""); setShowAccountForm(true);
  };
  const submitAccount = async (event) => {
    event.preventDefault();
    const name = accountName.trim();
    if (name.length < 2 || accountPassword.length < 8) { setAccountError("Use a name and a password of at least 8 characters."); return; }
    setAccountBusy(true); setAccountError("");
    try {
      const accounts = read("pulse-accounts", []);
      const existing = accounts.find((item) => item.name.toLowerCase() === name.toLowerCase());
      if (accountMode === "register" && existing) { setAccountError("That account already exists."); return; }
      if (accountMode === "login") {
        if (!existing || existing.passwordHash !== await hashPassword(accountPassword, existing.salt)) { setAccountError("Incorrect name or password."); return; }
        const session = { id: existing.id, name: existing.name };
        setUser(session); localStorage.setItem("pulse-session", JSON.stringify(session)); setShowAccountForm(false); return;
      }
      const salt = crypto.randomUUID();
      const account = { id: crypto.randomUUID(), name, salt, passwordHash: await hashPassword(accountPassword, salt), createdAt: new Date().toISOString() };
      localStorage.setItem("pulse-accounts", JSON.stringify([...accounts, account]));
      const session = { id: account.id, name: account.name };
      setUser(session); localStorage.setItem("pulse-session", JSON.stringify(session)); setShowAccountForm(false);
    } finally { setAccountBusy(false); }
  };
  const logout = () => { setUser(null); localStorage.removeItem("pulse-session"); };
  const addToPlaylist = (playlistId, track) => setPlaylists((items) => items.map((item) => item.id === playlistId && !item.tracks.some((song) => song.id === track.id) ? { ...item, tracks: [...item.tracks, track] } : item));
  const queued = useMemo(() => new Set(queue.map((item) => item.id)), [queue]);
  const visibleTracks = view === "favorites" ? favorites : view === "recent" ? recent : view === "queue" ? queue : view === "playlist" ? playlists.find((item) => item.id === selectedPlaylist)?.tracks || [] : results;
  const nav = (nextView) => { setView(nextView); if (nextView !== "playlist") setSelectedPlaylist(null); };

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark"><AudioLines size={19} /></div><span>pulse</span></div>
      <nav><p className="nav-label">Library</p>
        <button className={`nav-item ${view === "discover" ? "active" : ""}`} onClick={() => nav("discover")}><Sparkles size={17} /> Discover</button>
        <button className={`nav-item ${view === "favorites" ? "active" : ""}`} onClick={() => nav("favorites")}><Heart size={17} /> Favorites <span className="nav-count">{favorites.length}</span></button>
        <button className={`nav-item ${view === "recent" ? "active" : ""}`} onClick={() => nav("recent")}><Clock3 size={17} /> Recently played</button>
        <button className={`nav-item ${view === "queue" ? "active" : ""}`} onClick={() => nav("queue")}><ListMusic size={17} /> Queue <span className="nav-count">{queue.length}</span></button>
        <p className="nav-label playlist-label">Playlists <button className="add-playlist" onClick={() => setShowPlaylistForm(true)}><Plus size={14} /></button></p>
        {playlists.map((playlist) => <button key={playlist.id} className={`nav-item playlist-nav ${selectedPlaylist === playlist.id ? "active" : ""}`} onClick={() => { setSelectedPlaylist(playlist.id); setView("playlist"); }}><ListMusic size={15} /> {playlist.name}<span className="nav-count">{playlist.tracks.length}</span></button>)}
      </nav>
      <div className="sidebar-bottom"><div className="connection-dot" /> Local player <span className="version">v0.2</span></div>
    </aside>
    <main className="main">
      <header className="topbar"><button className="mobile-menu"><Menu size={20} /></button><div className="breadcrumbs">Library <ChevronDown size={14} /> <strong>{view === "playlist" ? playlists.find((item) => item.id === selectedPlaylist)?.name : view[0].toUpperCase() + view.slice(1)}</strong></div><div className="account-area">{user ? <><span className="account-name">{user.name}</span><button className="avatar" onClick={logout} title="Log out">{user.name.slice(0, 1).toUpperCase()}</button></> : <button className="account-button" onClick={() => openAccount("register")}><Plus size={14} /> Create account</button>}</div></header>
      {view === "discover" && <section className="hero"><div><p className="eyebrow">YOUR PERSONAL RADIO</p><h1>Find your next<br /><em>favorite</em> song.</h1><p className="hero-copy">Search YouTube, build your queue, and let the music<br className="desktop-only" /> play. Everything stays on your device.</p></div><div className="hero-orb"><div className="orb-ring ring-one" /><div className="orb-ring ring-two" /><Disc3 size={70} strokeWidth={1} /></div></section>}
      <form className={`search-wrap ${view !== "discover" ? "search-compact" : ""}`} onSubmit={search}><Search size={20} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search artists, songs, or paste a YouTube URL" /><kbd>Enter</kbd>{query && <button type="button" className="clear" onClick={() => setQuery("")}><X size={16} /></button>}<button className="search-button" type="submit">{loading ? <LoaderCircle className="spin" size={18} /> : "Search"}</button></form>
      {error && <div className="notice">{error}</div>}
      <section className="content-grid"><div className="results"><div className="section-heading"><div><p className="eyebrow">{view === "discover" ? "BROWSE" : "LIBRARY"}</p><h2>{view === "discover" ? (query ? `Results for “${query}”` : "Made for you") : view === "favorites" ? "Favorites" : view === "queue" ? "Your queue" : view === "recent" ? "Recently played" : playlists.find((item) => item.id === selectedPlaylist)?.name}</h2></div><button className="subtle-button" onClick={() => setShowPlaylistForm(true)}>{view === "playlist" ? "Add songs with search" : "New playlist"} <Plus size={15} /></button></div>
        {visibleTracks.length ? <div className="track-list">{visibleTracks.map((track, index) => <Track key={track.id} track={track} index={index} active={current?.id === track.id} playing={playing} queued={queued.has(track.id)} favorite={favorites.some((item) => item.id === track.id)} onPlay={play} onQueue={toggleQueue} onFavorite={toggleFavorite} playlists={playlists} onPlaylist={addToPlaylist} />)}</div> : <div className="empty-queue"><ListMusic size={28} /><p>{view === "playlist" ? "This playlist is empty" : "Nothing here yet"}</p><span>Search for music and add it to your library.</span></div>}</div>
        <aside className="queue-panel"><div className="section-heading compact"><div><p className="eyebrow">UP NEXT</p><h2>Your queue <span>{queue.length}</span></h2></div><button className="icon-button" onClick={() => setQueue([])} aria-label="Clear queue"><MoreHorizontal size={19} /></button></div>{queue.length ? queue.map((track) => <QueueItem key={track.id} track={track} active={current?.id === track.id} onPlay={play} onRemove={toggleQueue} />) : <div className="empty-queue"><ListMusic size={28} /><p>Your queue is empty</p><span>Add songs from Discover to start listening.</span></div>}</aside>
      </section>
    </main>
    <footer className="player"><div className="now-playing">{current ? <><img src={current.thumbnail} alt="" /><div><strong>{current.title}</strong><span>{current.artist}</span></div><button className="heart-button" onClick={() => toggleFavorite(current)}><Heart size={18} fill={favorites.some((item) => item.id === current.id) ? "currentColor" : "none"} /></button></> : <div className="no-track"><div className="mini-mark"><AudioLines size={16} /></div><span>Select a track to start listening</span></div>}</div><div className="controls"><div className="control-buttons"><button onClick={previous}><SkipBack size={18} fill="currentColor" /></button><button className="play-button" onClick={() => { if (current) { setPlaying(!playing); playing ? audio.current.pause() : audio.current.play(); } }}>{playing ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}</button><button onClick={next}><SkipForward size={18} fill="currentColor" /></button></div><div className="progress"><span>{formatTime(audio.current.currentTime)}</span><input type="range" min="0" max="1" step="0.001" value={progress} onChange={(event) => { const value = Number(event.target.value); setProgress(value); if (audio.current.duration) audio.current.currentTime = value * audio.current.duration; }} /><span>{current?.duration || "0:00"}</span></div></div><div className="player-volume"><Volume2 size={17} /><input type="range" min="0" max="100" value={volume} onChange={(e) => setVolume(e.target.value)} /></div></footer>
    {showPlaylistForm && <div className="modal-backdrop" onMouseDown={() => setShowPlaylistForm(false)}><form className="playlist-modal" onSubmit={createPlaylist} onMouseDown={(event) => event.stopPropagation()}><button type="button" className="modal-close" onClick={() => setShowPlaylistForm(false)}><X size={18} /></button><p className="eyebrow">NEW PLAYLIST</p><h2>Create a playlist</h2><input autoFocus value={playlistName} onChange={(event) => setPlaylistName(event.target.value)} placeholder="Playlist name" maxLength="40" /><button className="search-button" type="submit">Create playlist</button></form></div>}
    {showAccountForm && <div className="modal-backdrop" onMouseDown={() => setShowAccountForm(false)}><form className="playlist-modal account-modal" onSubmit={submitAccount} onMouseDown={(event) => event.stopPropagation()}><button type="button" className="modal-close" onClick={() => setShowAccountForm(false)}><X size={18} /></button><p className="eyebrow">LOCAL ACCOUNT</p><h2>{accountMode === "register" ? "Create your account" : "Welcome back"}</h2><p className="modal-copy">Your account stays on this device. Passwords are protected with a local PBKDF2 hash.</p><input autoFocus value={accountName} onChange={(event) => setAccountName(event.target.value)} placeholder="Your name" autoComplete="username" maxLength="32" /><input value={accountPassword} onChange={(event) => setAccountPassword(event.target.value)} placeholder="Password (8+ characters)" type="password" autoComplete={accountMode === "register" ? "new-password" : "current-password"} /><button className="search-button" type="submit" disabled={accountBusy}>{accountBusy ? <LoaderCircle className="spin" size={17} /> : accountMode === "register" ? "Create account" : "Sign in"}</button>{accountError && <p className="account-error">{accountError}</p>}<button type="button" className="switch-account" onClick={() => { setAccountMode(accountMode === "register" ? "login" : "register"); setAccountError(""); }}>{accountMode === "register" ? "Already have an account? Sign in" : "Need an account? Create one"}</button></form></div>}
  </div>;
}

function formatTime(value) { if (!Number.isFinite(value)) return "0:00"; return `${Math.floor(value / 60)}:${String(Math.floor(value % 60)).padStart(2, "0")}`; }
function Track({ track, index, active, playing, queued, favorite, onPlay, onQueue, onFavorite, playlists, onPlaylist }) {
  return <div className={`track ${active ? "active" : ""}`}><span className="track-index">{active && playing ? <AudioLines size={16} className="equalizer" /> : String(index + 1).padStart(2, "0")}</span><img src={track.thumbnail} alt="" /><div className="track-info"><strong>{track.title}</strong><span>{track.artist}</span></div><span className="track-duration">{track.duration}</span><button className="row-action play-row" onClick={() => onPlay(track)}>{active && playing ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}</button><button className={`row-action ${favorite ? "queued" : ""}`} onClick={() => onFavorite(track)} aria-label="Favorite"><Heart size={16} fill={favorite ? "currentColor" : "none"} /></button><button className={`row-action ${queued ? "queued" : ""}`} onClick={() => onQueue(track)} aria-label="Add to queue">{queued ? <ListMusic size={16} /> : <Plus size={18} />}</button>{playlists.length > 0 && <select className="playlist-select" value="" onChange={(event) => event.target.value && onPlaylist(event.target.value, track)} aria-label="Add to playlist"><option value="">+</option>{playlists.map((playlist) => <option key={playlist.id} value={playlist.id}>{playlist.name}</option>)}</select>}</div>;
}
function QueueItem({ track, active, onPlay, onRemove }) { return <div className={`queue-item ${active ? "active" : ""}`} onDoubleClick={() => onPlay(track)}><img src={track.thumbnail} alt="" /><div><strong>{track.title}</strong><span>{track.artist}</span></div><button onClick={() => onRemove(track)}><X size={15} /></button></div>; }
export default App;
