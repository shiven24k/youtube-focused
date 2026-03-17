"use client";

import { useEffect, useMemo, useState } from "react";

type PlaylistItem = {
  videoId: string;
  title: string;
  channelTitle: string;
  position: number | null;
  thumbnail: string | null;
};

type PlaylistResponse = {
  playlistId: string;
  nextPageToken: string | null;
  items: PlaylistItem[];
};

type SearchVideoItem = {
  id: { videoId?: string; playlistId?: string };
  snippet: {
    title: string;
    channelTitle?: string;
    thumbnails?: {
      medium?: { url: string };
      default?: { url: string };
    };
  };
};

const LS_LAST_QUERY = "cleantube.lastQuery.v1";
const LS_CURRENT = "cleantube.currentVideoId.v1";
const LS_PLAYBACK_STATE = "cleantube.playbackState.v1";

type PlaybackState = {
  playlistId: string | null;
  playlistNextToken: string | null;
  playlist: PlaylistItem[];
  currentVideoId: string | null;
};

function safeParseJson<T>(value: string | null): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

export default function Home() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchVideoItem[]>([]);
  const [resultType, setResultType] = useState<"video" | "playlist">("video");
  const [playlist, setPlaylist] = useState<PlaylistItem[]>([]);
  const [playlistId, setPlaylistId] = useState<string | null>(null);
  const [playlistNextToken, setPlaylistNextToken] = useState<string | null>(null);
  const [currentVideoId, setCurrentVideoId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [loadingPlaylist, setLoadingPlaylist] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [isPlaylistPanelOpen, setIsPlaylistPanelOpen] = useState(false);

  useEffect(() => {
    const savedQuery = window.localStorage.getItem(LS_LAST_QUERY);
    if (savedQuery) setQuery(savedQuery);

    const savedState = safeParseJson<PlaybackState>(
      window.localStorage.getItem(LS_PLAYBACK_STATE)
    );
    if (savedState) {
      if (Array.isArray(savedState.playlist)) setPlaylist(savedState.playlist);
      if (typeof savedState.playlistId === "string" || savedState.playlistId === null)
        setPlaylistId(savedState.playlistId);
      if (
        typeof savedState.playlistNextToken === "string" ||
        savedState.playlistNextToken === null
      )
        setPlaylistNextToken(savedState.playlistNextToken);
      if (
        typeof savedState.currentVideoId === "string" ||
        savedState.currentVideoId === null
      )
        setCurrentVideoId(savedState.currentVideoId);
    } else {
      const savedCurrent = window.localStorage.getItem(LS_CURRENT);
      if (savedCurrent) setCurrentVideoId(savedCurrent);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(LS_LAST_QUERY, query);
  }, [query]);

  useEffect(() => {
    if (currentVideoId) window.localStorage.setItem(LS_CURRENT, currentVideoId);
  }, [currentVideoId]);

  useEffect(() => {
    const state: PlaybackState = {
      playlistId,
      playlistNextToken,
      playlist,
      currentVideoId,
    };
    window.localStorage.setItem(LS_PLAYBACK_STATE, JSON.stringify(state));
  }, [playlistId, playlistNextToken, playlist, currentVideoId]);

  const currentIndex = useMemo(() => {
    if (!currentVideoId) return -1;
    return playlist.findIndex((v) => v.videoId === currentVideoId);
  }, [playlist, currentVideoId]);

  const canPrev = currentIndex > 0;
  const canNext = currentIndex >= 0 && currentIndex < playlist.length - 1;

  const search = async () => {
    setError(null);
    setLoadingSearch(true);
    const res = await fetch(
      `/api/search?q=${encodeURIComponent(query.trim())}&type=${resultType}`
    );

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      setResults([]);
      setError(text || `Request failed (${res.status})`);
      setLoadingSearch(false);
      return;
    }

    const data = await res.json();
    setResults(Array.isArray(data) ? (data as SearchVideoItem[]) : []);
    setLoadingSearch(false);
  };

  const openPlaylistById = async (plId: string) => {
    setError(null);
    setLoadingPlaylist(true);
    const res = await fetch(`/api/playlist?list=${encodeURIComponent(plId)}`);
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      setPlaylist([]);
      setPlaylistId(null);
      setPlaylistNextToken(null);
      setError(text || `Request failed (${res.status})`);
      setLoadingPlaylist(false);
      return;
    }
    const data = (await res.json()) as PlaylistResponse;
    const items = Array.isArray(data?.items) ? data.items : [];
    setPlaylist(items);
    setPlaylistId(data?.playlistId ?? plId);
    setPlaylistNextToken(data?.nextPageToken ?? null);
    setCurrentVideoId(items[0]?.videoId ?? null);
    setIsPlaylistPanelOpen(items.length > 0);
    setLoadingPlaylist(false);
  };

  const loadMorePlaylist = async () => {
    if (!playlistId || !playlistNextToken) return;
    setError(null);
    setLoadingMore(true);
    const res = await fetch(
      `/api/playlist?list=${encodeURIComponent(
        playlistId
      )}&pageToken=${encodeURIComponent(playlistNextToken)}`
    );
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      setError(text || `Request failed (${res.status})`);
      setLoadingMore(false);
      return;
    }
    const data = (await res.json()) as PlaylistResponse;
    const items = Array.isArray(data?.items) ? data.items : [];
    setPlaylist((prev) => [...prev, ...items]);
    setPlaylistNextToken(data?.nextPageToken ?? null);
    setLoadingMore(false);
  };

  const playVideo = (videoId: string) => {
    setPlaylist([]);
    setPlaylistId(null);
    setPlaylistNextToken(null);
    setCurrentVideoId(videoId);
    setIsPlaylistPanelOpen(false);
  };

  const goPrev = () => {
    if (!canPrev) return;
    setCurrentVideoId(playlist[currentIndex - 1]?.videoId ?? null);
  };

  const goNext = () => {
    if (!canNext) return;
    setCurrentVideoId(playlist[currentIndex + 1]?.videoId ?? null);
  };

  const playerSrc = currentVideoId
    ? `https://www.youtube-nocookie.com/embed/${currentVideoId}?autoplay=1&rel=0&modestbranding=1&iv_load_policy=3`
    : null;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-[1440px] px-4 py-6">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-sm text-neutral-500 dark:text-neutral-400">
              Study-only YouTube
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">
              CleanTube
            </h1>
          </div>

          <div className="flex w-full flex-col gap-2 sm:w-[560px]">
            <div className="flex gap-2">
              <input
                className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:ring-2 focus:ring-neutral-300 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100 dark:focus:ring-neutral-700"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") search();
                }}
                placeholder="Search videos or playlists…"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
              />
              <button
                className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200"
                onClick={search}
                disabled={loadingSearch || query.trim().length === 0}
              >
                {loadingSearch ? "Searching…" : "Search"}
              </button>
            </div>

            <div className="flex gap-2">
              <button
                className={`rounded-lg border px-3 py-1.5 text-sm ${
                  resultType === "video"
                    ? "border-neutral-900 bg-neutral-900 text-white dark:border-neutral-100 dark:bg-neutral-100 dark:text-neutral-900"
                    : "border-neutral-200 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-900"
                }`}
                onClick={() => setResultType("video")}
              >
                Videos
              </button>
              <button
                className={`rounded-lg border px-3 py-1.5 text-sm ${
                  resultType === "playlist"
                    ? "border-neutral-900 bg-neutral-900 text-white dark:border-neutral-100 dark:bg-neutral-100 dark:text-neutral-900"
                    : "border-neutral-200 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-900"
                }`}
                onClick={() => setResultType("playlist")}
              >
                Playlists
              </button>
              {loadingPlaylist && (
                <div className="ml-auto text-xs text-neutral-500 dark:text-neutral-400 self-center">
                  Opening playlist…
                </div>
              )}
            </div>
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
                {error}
              </div>
            )}
          </div>
        </header>

        <main className="mt-6 space-y-6">
          <section
            className={`grid gap-6 ${
              isPlaylistPanelOpen && playlist.length > 0
                ? "lg:grid-cols-[minmax(0,1fr)_360px]"
                : "grid-cols-1"
            }`}
          >
            <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-medium text-neutral-700 dark:text-neutral-200">
                  Player
                </div>
                <div className="flex flex-wrap gap-2 justify-end">
                  <button
                    className="rounded-lg border border-neutral-200 px-3 py-1.5 text-sm hover:bg-neutral-50 disabled:opacity-50 dark:border-neutral-800 dark:hover:bg-neutral-900"
                    onClick={() => setIsPlaylistPanelOpen((v) => !v)}
                    disabled={playlist.length === 0}
                  >
                    {isPlaylistPanelOpen ? "Hide playlist" : "Show playlist"}
                  </button>
                  <button
                    className="rounded-lg border border-neutral-200 px-3 py-1.5 text-sm hover:bg-neutral-50 disabled:opacity-50 dark:border-neutral-800 dark:hover:bg-neutral-900"
                    onClick={goPrev}
                    disabled={!canPrev}
                  >
                    Prev
                  </button>
                  <button
                    className="rounded-lg border border-neutral-200 px-3 py-1.5 text-sm hover:bg-neutral-50 disabled:opacity-50 dark:border-neutral-800 dark:hover:bg-neutral-900"
                    onClick={goNext}
                    disabled={!canNext}
                  >
                    Next
                  </button>
                </div>
              </div>

              <div className="mt-3 overflow-hidden rounded-lg bg-neutral-100 dark:bg-neutral-900">
                <div className="relative aspect-video">
                  {playerSrc ? (
                    <iframe
                      className="absolute inset-0 h-full w-full"
                      src={playerSrc}
                      title="YouTube player"
                      allow="autoplay; encrypted-media; picture-in-picture"
                      sandbox="allow-scripts allow-same-origin allow-presentation"
                      referrerPolicy="strict-origin-when-cross-origin"
                      allowFullScreen
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-sm text-neutral-500">
                      Search and click a video (or open a playlist).
                    </div>
                  )}
                </div>
              </div>
            </div>

            {isPlaylistPanelOpen && playlist.length > 0 ? (
              <aside className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium text-neutral-700 dark:text-neutral-200">
                      Playlist
                    </div>
                    <div className="text-xs text-neutral-500 dark:text-neutral-400">
                      {playlistId ? `list=${playlistId}` : "-"} · {playlist.length}{" "}
                      item{playlist.length === 1 ? "" : "s"}
                    </div>
                  </div>
                  <div className="text-xs text-neutral-500 dark:text-neutral-400">
                    Click to play
                  </div>
                </div>

                <div className="mt-3 flex max-h-[70vh] flex-col">
                  <>
                    <div className="ct-scroll space-y-2 overflow-auto pr-1">
                      {playlist.map((v, idx) => {
                        const id = v.videoId;
                        const active = id === currentVideoId;
                        return (
                          <div
                            key={id}
                            className={`rounded-lg border p-2 ${
                              active
                                ? "border-neutral-900 bg-neutral-50 dark:border-neutral-100 dark:bg-neutral-900/40"
                                : "border-neutral-200 dark:border-neutral-800"
                            }`}
                          >
                            <button
                              className="block w-full text-left"
                              onClick={() => setCurrentVideoId(id)}
                            >
                              <div className="flex gap-2">
                                <div className="mt-0.5 w-8 shrink-0 text-right text-xs text-neutral-500 dark:text-neutral-400">
                                  {typeof v.position === "number"
                                    ? v.position + 1
                                    : idx + 1}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="line-clamp-2 text-sm font-medium">
                                    {v.title}
                                  </div>
                                  <div className="truncate text-xs text-neutral-500 dark:text-neutral-400">
                                    {v.channelTitle}
                                  </div>
                                </div>
                              </div>
                            </button>
                          </div>
                        );
                      })}
                    </div>

                    <div className="mt-3">
                      <button
                        className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm hover:bg-neutral-50 disabled:opacity-50 dark:border-neutral-800 dark:hover:bg-neutral-900"
                        onClick={loadMorePlaylist}
                        disabled={!playlistNextToken || loadingMore}
                      >
                        {loadingMore
                          ? "Loading..."
                          : playlistNextToken
                            ? "Load more"
                            : "No more items"}
                      </button>
                    </div>
                  </>
                </div>
              </aside>
            ) : null}
          </section>

          <section className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium text-neutral-700 dark:text-neutral-200">
                Results
              </div>
              <div className="text-xs text-neutral-500 dark:text-neutral-400">
                No recommendations · only search
              </div>
            </div>

            <div className="mt-3 space-y-2">
              {results.length === 0 ? (
                <div className="py-8 text-center text-sm text-neutral-500">
                  Try “linear algebra” or “learn SQL”.
                </div>
              ) : (
                results.map((r: SearchVideoItem) => {
                  const vid = r?.id?.videoId as string | undefined;
                  const plId = r?.id?.playlistId as string | undefined;
                  const thumb =
                    r?.snippet?.thumbnails?.medium?.url ??
                    r?.snippet?.thumbnails?.default?.url ??
                    null;
                  const title = r?.snippet?.title ?? "Untitled";
                  const channel = r?.snippet?.channelTitle ?? "";

                  const primaryId = resultType === "playlist" ? plId : vid;
                  if (!primaryId) return null;

                  return (
                    <button
                      key={primaryId}
                      className="flex w-full items-center gap-3 rounded-lg border border-neutral-200 p-2 text-left hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-900"
                      onClick={() => {
                        if (resultType === "playlist") openPlaylistById(primaryId);
                        else playVideo(primaryId);
                      }}
                    >
                      <div className="h-12 w-20 overflow-hidden rounded-md bg-neutral-100 dark:bg-neutral-900">
                        {thumb ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={thumb}
                            alt=""
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                        ) : null}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="line-clamp-2 text-sm font-medium">
                          {title}
                        </div>
                        <div className="truncate text-xs text-neutral-500 dark:text-neutral-400">
                          {channel}
                        </div>
                      </div>
                      <div className="text-xs text-neutral-500 dark:text-neutral-400">
                        {resultType === "playlist" ? "Open" : "Play"}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}