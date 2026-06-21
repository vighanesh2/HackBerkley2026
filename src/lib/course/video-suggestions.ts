import type { RecommendedVideo } from "@/types/course-document";
import { searchYouTubeVideos } from "@/lib/course/youtube";

export type DiscoveredVideos = {
  featured: RecommendedVideo | null;
  moduleVideos: RecommendedVideo[];
};

export async function discoverVideosForCourse(
  topic: string,
  moduleTitles: string[],
): Promise<DiscoveredVideos> {
  const moduleQueries = moduleTitles.slice(0, 2).map((title) => `${title} ${topic}`);

  const [featuredResults, ...moduleResults] = await Promise.all([
    searchYouTubeVideos(`${topic} tutorial explained`, 2),
    ...moduleQueries.map((query) => searchYouTubeVideos(query, 1)),
  ]);

  const seen = new Set<string>();
  const moduleVideos: RecommendedVideo[] = [];

  for (const result of moduleResults) {
    const video = result[0];
    if (!video || seen.has(video.url)) continue;
    seen.add(video.url);
    moduleVideos.push(video);
  }

  let featured = featuredResults[0] ?? moduleVideos[0] ?? null;
  if (featured) seen.add(featured.url);

  if (!featured) {
    for (const candidate of featuredResults.slice(1)) {
      if (!seen.has(candidate.url)) {
        featured = candidate;
        break;
      }
    }
  }

  return { featured, moduleVideos };
}
