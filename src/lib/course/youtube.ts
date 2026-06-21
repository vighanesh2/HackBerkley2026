import YouTube from "youtube-sr";
import type { RecommendedVideo } from "@/types/course-document";

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
  let results;
  try {
    results = await YouTube.search(query, {
      limit: Math.max(limit, 3),
      type: "video",
      safeSearch: true,
    });
  } catch {
    return [];
  }

  const videos: RecommendedVideo[] = [];
  for (const result of results) {
    if (videos.length >= limit) break;

    const url = result.url;
    if (!url) continue;

    const validation = await validateYouTubeUrl(url);
    if (!validation.valid) continue;

    videos.push({
      title: validation.title ?? result.title ?? "YouTube video",
      url,
      reason: `Educational video matching "${query}".`,
      source: "YouTube",
    });
  }

  return videos;
}

export async function validateRecommendedVideos(
  videos: RecommendedVideo[],
): Promise<RecommendedVideo[]> {
  const valid: RecommendedVideo[] = [];
  const seen = new Set<string>();

  for (const video of videos) {
    if (seen.has(video.url)) continue;
    const check = await validateYouTubeUrl(video.url);
    if (!check.valid) continue;
    seen.add(video.url);
    valid.push({
      ...video,
      title: check.title ?? video.title,
    });
  }

  return valid;
}
