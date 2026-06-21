import type { CourseDocument, RecommendedVideo } from "@/types/course-document";
import type { DiscoveredVideos } from "@/lib/course/video-suggestions";
import { validateRecommendedVideos } from "@/lib/course/youtube";

function isVideoUrl(url: string): boolean {
  return /youtube\.com|youtu\.be|vimeo\.com/i.test(url);
}

function upsertVideoResource(
  document: CourseDocument,
  video: RecommendedVideo,
): void {
  const exists = document.resources.some(
    (resource) => resource.url === video.url || resource.title === video.title,
  );
  if (exists) return;

  document.resources.unshift({
    title: video.title,
    type: "Video",
    url: video.url,
    note: video.reason + (video.source ? ` (via ${video.source})` : ""),
  });
}

export function mergeAgentVideos(
  document: CourseDocument,
  videos: RecommendedVideo[],
): CourseDocument {
  if (videos.length === 0) return document;

  const next: CourseDocument = {
    ...document,
    agentVideos: videos,
    featuredVideo: videos[0],
    resources: [...document.resources],
    modules: document.modules.map((module) => ({ ...module })),
  };

  for (const video of videos) {
    upsertVideoResource(next, video);
  }

  if (next.modules[0] && !next.modules[0].recommendedVideo) {
    next.modules[0].recommendedVideo = videos[0];
  }

  if (videos[1] && next.modules[1] && !next.modules[1].recommendedVideo) {
    next.modules[1].recommendedVideo = videos[1];
  }

  return next;
}

export function mergeDiscoveredVideos(
  document: CourseDocument,
  discovered: DiscoveredVideos,
): CourseDocument {
  const allVideos = [
    ...(discovered.featured ? [discovered.featured] : []),
    ...discovered.moduleVideos,
  ];

  if (allVideos.length === 0) return document;

  // Add all unique videos to the resources section.
  const next: CourseDocument = {
    ...document,
    featuredVideo: discovered.featured ?? document.featuredVideo,
    resources: [...document.resources],
    modules: document.modules.map((m) => ({ ...m })),
  };

  for (const video of allVideos) {
    upsertVideoResource(next, video);
  }

  // Assign a unique video to EVERY module.
  // Priority: module-specific video → featured (only for module 0 if no other option).
  next.modules.forEach((module, index) => {
    const moduleVideo = discovered.moduleVideos[index];
    if (moduleVideo) {
      module.recommendedVideo = moduleVideo;
    } else if (index === 0 && discovered.featured) {
      // Only fall back to featured for the first module; leave others without a video
      // rather than repeating the same one across all modules.
      module.recommendedVideo = discovered.featured;
    }
  });

  return next;
}

export function normalizeAgentVideos(raw: unknown): RecommendedVideo[] {
  if (!Array.isArray(raw)) return [];

  const videos: RecommendedVideo[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const title = String(record.title ?? "").trim();
    const url = String(record.url ?? "").trim();
    const reason = String(record.reason ?? "Recommended for this topic.").trim();
    const source = record.source ? String(record.source).trim() : undefined;

    if (!title || !url || !isVideoUrl(url)) continue;
    videos.push({ title, url, reason, source });
  }

  return videos;
}

export async function normalizeAndValidateAgentVideos(
  raw: unknown,
): Promise<RecommendedVideo[]> {
  const normalized = normalizeAgentVideos(raw);
  return validateRecommendedVideos(normalized);
}
