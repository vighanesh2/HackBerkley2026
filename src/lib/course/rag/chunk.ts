import type { RagChunk } from "@/lib/course/rag/types";

const DEFAULT_CHUNK_SIZE = 900;
const DEFAULT_OVERLAP = 120;

function splitOnHeadings(text: string): { heading?: string; body: string }[] {
  const sections: { heading?: string; body: string }[] = [];
  const lines = text.split("\n");
  let currentHeading: string | undefined;
  let buffer: string[] = [];

  function flush() {
    const body = buffer.join("\n").trim();
    if (body) sections.push({ heading: currentHeading, body });
    buffer = [];
  }

  for (const line of lines) {
    const headingMatch = /^(#{1,3}\s+.+)$/.exec(line.trim());
    if (headingMatch) {
      flush();
      currentHeading = headingMatch[1].replace(/^#+\s+/, "").trim();
      continue;
    }
    buffer.push(line);
  }
  flush();

  return sections.length > 0 ? sections : [{ body: text }];
}

function splitLongText(text: string, chunkSize: number, overlap: number): string[] {
  if (text.length <= chunkSize) return [text];

  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    let end = Math.min(start + chunkSize, text.length);

    if (end < text.length) {
      const slice = text.slice(start, end);
      const breakAt = Math.max(
        slice.lastIndexOf("\n\n"),
        slice.lastIndexOf(". "),
        slice.lastIndexOf(" "),
      );
      if (breakAt > chunkSize * 0.5) {
        end = start + breakAt + (slice[breakAt] === " " ? 1 : 2);
      }
    }

    const piece = text.slice(start, end).trim();
    if (piece) chunks.push(piece);

    if (end >= text.length) break;
    start = Math.max(end - overlap, start + 1);
  }

  return chunks;
}

export function chunkSourceText(
  text: string,
  options?: { chunkSize?: number; overlap?: number },
): RagChunk[] {
  const chunkSize = options?.chunkSize ?? DEFAULT_CHUNK_SIZE;
  const overlap = options?.overlap ?? DEFAULT_OVERLAP;
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];

  const sections = splitOnHeadings(normalized);
  const chunks: RagChunk[] = [];
  let index = 0;

  for (const section of sections) {
    const pieces = splitLongText(section.body, chunkSize, overlap);
    for (const piece of pieces) {
      chunks.push({
        id: `chunk-${index}`,
        index,
        text: piece,
        heading: section.heading,
      });
      index += 1;
    }
  }

  return chunks;
}
