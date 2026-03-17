import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get("q")?.trim();
  const typeParam = req.nextUrl.searchParams.get("type")?.trim() || "video";
  const type = typeParam === "playlist" ? "playlist" : "video";

  if (!query) {
    return NextResponse.json(
      { error: "Missing query param `q`." },
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

  const searchRes = await fetch(
    `https://www.googleapis.com/youtube/v3/search?part=snippet&type=${type}&maxResults=15&q=${encodeURIComponent(
      query
    )}&key=${apiKey}`
  );

  if (!searchRes.ok) {
    return NextResponse.json(
      { error: "YouTube search request failed." },
      { status: 502 }
    );
  }

  const searchData = await searchRes.json();
  const items = Array.isArray(searchData?.items) ? searchData.items : [];

  if (type === "playlist") {
    // Return as-is; client can open playlist via /api/playlist.
    return NextResponse.json(items);
  }

  const videoIds = items.map((v: any) => v?.id?.videoId).filter(Boolean);
  if (videoIds.length === 0) return NextResponse.json([]);

  const detailsRes = await fetch(
    `https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${videoIds.join(
      ","
    )}&key=${apiKey}`
  );

  if (!detailsRes.ok) {
    return NextResponse.json(
      { error: "YouTube details request failed." },
      { status: 502 }
    );
  }

  const detailsData = await detailsRes.json();
  const detailsItems = Array.isArray(detailsData?.items) ? detailsData.items : [];

  // Keep videos that are not Shorts (rough heuristic: 2+ minutes).
  const durationById = new Map<string, string>();
  for (const it of detailsItems) {
    const id = it?.id;
    const d = it?.contentDetails?.duration;
    if (typeof id === "string" && typeof d === "string") durationById.set(id, d);
  }

  const filtered = items.filter((item: any) => {
    const id = item?.id?.videoId;
    const duration = typeof id === "string" ? durationById.get(id) : undefined;
    if (typeof duration !== "string") return true;
    // ISO 8601 duration like: PT1M30S, PT2M05S, PT10M, PT45S
    if (!duration.startsWith("PT")) return true;
    if (duration.includes("H")) return true; // >= 1 hour
    const minutesMatch = duration.match(/(\d+)M/);
    const minutes = minutesMatch ? Number(minutesMatch[1]) : 0;
    return minutes >= 2;
  });

  return NextResponse.json(filtered);
}

