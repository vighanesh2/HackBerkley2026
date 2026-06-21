import type { RecommendedVideo } from "@/types/course-document";
import { searchYouTubeVideos } from "@/lib/course/youtube";

export type DiscoveredVideos = {
  featured: RecommendedVideo | null;
  moduleVideos: RecommendedVideo[];
};

/**
 * Discover educational videos for a course.
 *
 * Strategy (minimises concurrent requests to avoid rate-limiting):
 * 1. One "overview" search biased toward high-quality educational channels
 *    (MIT OCW, Stanford, Khan Academy, 3Blue1Brown live on YouTube).
 *    Pull enough candidates to fill the featured slot + several modules.
 * 2. For modules that didn't get a unique video from step 1, fire a small
 *    targeted search per module — but at most 3 extra searches to stay safe.
 * 3. Deduplicate globally so the same video never repeats.
 */
export async function discoverVideosForCourse(
  topic: string,
  moduleTitles: string[],
): Promise<DiscoveredVideos> {
  if (!topic.trim()) return { featured: null, moduleVideos: [] };

  const moduleCount = moduleTitles.length;
  // Request enough results to cover featured + all modules from one search.
  const overviewLimit = Math.min(moduleCount + 4, 10);

  // Long channel-name queries break youtube-sr's HTML parser — keep queries short.
  const overviewResults = await searchYouTubeVideos(
    `${topic} university lecture tutorial explained`,
    overviewLimit,
  );

  const seen = new Set<string>();

  // Featured: best result from overview search.
  let featured: RecommendedVideo | null = null;
  for (const candidate of overviewResults) {
    if (!seen.has(candidate.url)) {
      featured = labelSource(candidate);
      seen.add(candidate.url);
      break;
    }
  }

  // Assign overview results to modules in order (skip featured).
  const moduleVideos: (RecommendedVideo | null)[] = Array(moduleCount).fill(null);
  let overviewIdx = 0;
  for (let i = 0; i < moduleCount; i++) {
    // Advance past already-used results.
    while (overviewIdx < overviewResults.length && seen.has(overviewResults[overviewIdx].url)) {
      overviewIdx++;
    }
    if (overviewIdx < overviewResults.length) {
      const candidate = overviewResults[overviewIdx];
      moduleVideos[i] = labelSource(candidate);
      seen.add(candidate.url);
      overviewIdx++;
    }
  }

  // For modules still without a video, try a targeted per-module search.
  // Cap at 3 extra searches to avoid overwhelming YouTube's scraper.
  const missingIndices = moduleVideos
    .map((v, i) => (v === null ? i : -1))
    .filter((i) => i >= 0)
    .slice(0, 3);

  if (missingIndices.length > 0) {
    const extraResults = await Promise.all(
      missingIndices.map((i) =>
        searchYouTubeVideos(
          `${moduleTitles[i]} ${topic} explained`,
          3,
        ),
      ),
    );

    missingIndices.forEach((moduleIdx, resultIdx) => {
      for (const candidate of extraResults[resultIdx]) {
        if (!seen.has(candidate.url)) {
          moduleVideos[moduleIdx] = labelSource(candidate);
          seen.add(candidate.url);
          break;
        }
      }
    });
  }

  return {
    featured,
    moduleVideos: moduleVideos.filter((v): v is RecommendedVideo => v !== null),
  };
}

/**
 * Detect well-known educational producers from the video URL so the UI can
 * show "MIT OCW" or "Khan Academy" instead of just "YouTube".
 */
function labelSource(video: RecommendedVideo): RecommendedVideo {
  const u = video.url.toLowerCase();
  let source = video.source ?? "YouTube";
  if (u.includes("mit.edu") || u.includes("ocw.mit")) source = "MIT OCW";
  else if (u.includes("khanacademy")) source = "Khan Academy";
  else if (u.includes("coursera")) source = "Coursera";
  else if (u.includes("stanford")) source = "Stanford";
  else if (u.includes("harvard")) source = "Harvard";
  else if (u.includes("3blue1brown") || u.includes("3b1b")) source = "3Blue1Brown";
  return { ...video, source };
}
