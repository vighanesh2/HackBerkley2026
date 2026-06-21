import { YouTube } from "youtube-sr";
import type { RecommendedVideo } from "@/types/course-document";

function buildSearchQueries(query: string): string[] {
  const normalized = query.replace(/\s+/g, " ").trim();
  const stripped = normalized
    .replace(
      /\b(MIT|Stanford|Khan Academy|Harvard|3Blue1Brown|university|lecture|tutorial|explained)\b/gi,
      "",
    )
    .replace(/\s+/g, " ")
    .trim();
  const shortTopic =
    stripped.split(/\s+/).slice(0, 4).join(" ") ||
    normalized.split(/\s+/).slice(0, 4).join(" ");

  return [
    normalized,
    `${shortTopic} tutorial explained`.trim(),
    `${shortTopic} tutorial`.trim(),
  ].filter((value, index, list) => value.length > 0 && list.indexOf(value) === index);
}

export async function validateYouTubeUrl(
  url: string,
): Promise<{ valid: boolean; title?: string }> {
  try {
    const response = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`,
      { signal: AbortSignal.timeout(6000) },
    );
    if (!response.ok) return { valid: false };
    const data = (await response.json()) as { title?: string };
    return { valid: true, title: data.title };
  } catch {
    return { valid: false };
  }
}

export async function searchYouTubeVideos(
  query: string,
  limit = 2,
): Promise<RecommendedVideo[]> {
  const queries = buildSearchQueries(query);

  let results: Awaited<ReturnType<typeof YouTube.search>> | null = null;
  let lastError: unknown = null;

  for (const candidate of queries) {
    try {
      results = await YouTube.search(candidate, {
        limit: Math.max(limit, 3),
        type: "video",
        safeSearch: true,
      });
      if (results.length > 0) break;
    } catch (error) {
      lastError = error;
      console.warn("[youtube] search failed for query:", candidate, error);
    }
  }

  if (!results || results.length === 0) {
    const apiVideos = await searchYouTubeDataApi(queries[queries.length - 1] ?? query, limit);
    if (apiVideos.length > 0) return apiVideos;

    if (lastError) {
      console.error("[youtube] all search attempts failed:", lastError);
    }
    return [];
  }

  const videos: RecommendedVideo[] = [];
  for (const result of results) {
    if (videos.length >= limit) break;
    if (!("url" in result) || typeof result.url !== "string") continue;

    const url = result.url;
    const resultTitle = "title" in result ? result.title : undefined;

    const validation = await validateYouTubeUrl(url);
    if (!validation.valid) {
      // Keep scraper results when oEmbed is flaky; URL still came from YouTube search.
      if (!/youtube\.com|youtu\.be/i.test(url)) continue;
      videos.push({
        title: resultTitle ?? "YouTube video",
        url,
        reason: `Educational video matching "${query}".`,
        source: "YouTube",
      });
      continue;
    }

    videos.push({
      title: validation.title ?? resultTitle ?? "YouTube video",
      url,
      reason: `Educational video matching "${query}".`,
      source: "YouTube",
    });
  }

  return videos;
}

async function searchYouTubeDataApi(
  query: string,
  limit: number,
): Promise<RecommendedVideo[]> {
  const apiKey = process.env.YOUTUBE_API_KEY?.trim();
  if (!apiKey) return [];

  const params = new URLSearchParams({
    part: "snippet",
    q: query,
    type: "video",
    maxResults: String(Math.min(Math.max(limit, 1), 10)),
    safeSearch: "strict",
    key: apiKey,
  });

  try {
    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/search?${params.toString()}`,
      { signal: AbortSignal.timeout(10000) },
    );
    if (!response.ok) {
      console.warn("[youtube] Data API error:", response.status);
      return [];
    }

    const data = (await response.json()) as {
      items?: Array<{
        id?: { videoId?: string };
        snippet?: { title?: string };
      }>;
    };

    const videos: RecommendedVideo[] = [];
    for (const item of data.items ?? []) {
      const videoId = item.id?.videoId;
      const title = item.snippet?.title?.trim();
      if (!videoId || !title) continue;

      videos.push({
        title,
        url: `https://www.youtube.com/watch?v=${videoId}`,
        reason: `Educational video matching "${query}".`,
        source: "YouTube",
      });
      if (videos.length >= limit) break;
    }

    return videos;
  } catch (error) {
    console.warn("[youtube] Data API request failed:", error);
    return [];
  }
}

export async function validateRecommendedVideos(
  videos: RecommendedVideo[],
): Promise<RecommendedVideo[]> {
  const valid: RecommendedVideo[] = [];
  const seen = new Set<string>();

  for (const video of videos) {
    if (seen.has(video.url)) continue;
    const check = await validateYouTubeUrl(video.url);
    if (!check.valid) {
      if (/youtube\.com|youtu\.be/i.test(video.url)) {
        seen.add(video.url);
        valid.push(video);
      }
      continue;
    }
    seen.add(video.url);
    valid.push({
      ...video,
      title: check.title ?? video.title,
    });
  }

  return valid;
}
