import { NextRequest, NextResponse } from "next/server";

function extractPlaylistId(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;

  // Accept plain playlist id
  if (/^[a-zA-Z0-9_-]{10,}$/.test(raw) && !raw.includes("http")) return raw;

  // Accept common URL forms, e.g. https://www.youtube.com/playlist?list=PL...
  try {
    const url = new URL(raw);
    const list = url.searchParams.get("list");
    return list?.trim() || null;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const listParam = req.nextUrl.searchParams.get("list") ?? "";
  const playlistId = extractPlaylistId(listParam);
  const pageToken = req.nextUrl.searchParams.get("pageToken")?.trim() || "";

  if (!playlistId) {
    return NextResponse.json(
      { error: "Missing or invalid `list` (playlist id or URL)." },
      { status: 400 }
    );
  }

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Missing server env var YOUTUBE_API_KEY." },
      { status: 500 }
    );
  }

  const playlistItemsUrl = new URL(
    "https://www.googleapis.com/youtube/v3/playlistItems"
  );
  playlistItemsUrl.searchParams.set("part", "snippet,contentDetails");
  playlistItemsUrl.searchParams.set("maxResults", "50");
  playlistItemsUrl.searchParams.set("playlistId", playlistId);
  playlistItemsUrl.searchParams.set("key", apiKey);
  if (pageToken) playlistItemsUrl.searchParams.set("pageToken", pageToken);

  const itemsRes = await fetch(playlistItemsUrl.toString());
  if (!itemsRes.ok) {
    return NextResponse.json(
      { error: "YouTube playlistItems request failed." },
      { status: 502 }
    );
  }

  const itemsData = await itemsRes.json();
  const items = Array.isArray(itemsData?.items) ? itemsData.items : [];

  // Filter out "Deleted video" / "Private video" placeholders.
  const cleaned = items.filter((it: any) => {
    const title = it?.snippet?.title;
    const videoId = it?.contentDetails?.videoId;
    if (!videoId) return false;
    if (title === "Deleted video" || title === "Private video") return false;
    return true;
  });

  return NextResponse.json({
    playlistId,
    nextPageToken: itemsData?.nextPageToken ?? null,
    items: cleaned.map((it: any) => ({
      videoId: it.contentDetails.videoId,
      title: it.snippet?.title ?? "Untitled",
      channelTitle: it.snippet?.videoOwnerChannelTitle ?? it.snippet?.channelTitle ?? "",
      position: typeof it.snippet?.position === "number" ? it.snippet.position : null,
      thumbnail:
        it.snippet?.thumbnails?.medium?.url ??
        it.snippet?.thumbnails?.default?.url ??
        null,
    })),
  });
}

