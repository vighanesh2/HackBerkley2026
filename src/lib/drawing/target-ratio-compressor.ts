const STOP_WORDS = new Set([
  "the",
  "and",
  "or",
  "but",
  "for",
  "with",
  "that",
  "this",
  "from",
  "into",
  "about",
  "using",
  "through",
  "should",
  "would",
  "could",
  "what",
  "when",
  "where",
  "which",
  "your",
  "their",
  "them",
  "they",
  "then",
  "than",
  "also",
  "just",
  "very",
  "really",
]);

export function estimateTokens(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return Math.ceil(trimmed.length / 4);
}

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .match(/[a-z0-9]+/g)
      ?.filter((token) => token.length > 2 && !STOP_WORDS.has(token)) ?? [],
  );
}

function scoreUnit(unit: string, queryTokens: Set<string>): number {
  const unitTokens = tokenize(unit);
  if (unitTokens.size === 0 || queryTokens.size === 0) return 0.1;

  let overlap = 0;
  for (const token of unitTokens) {
    if (queryTokens.has(token)) overlap += 1;
  }

  const relevance = overlap / Math.sqrt(unitTokens.size * queryTokens.size);
  const hasNumber = /\b\d+(\.\d+)?%?\b/.test(unit) ? 0.08 : 0;
  const definitionBoost = /\b(is|are|means|draw|wire|circuit|diagram)\b/i.test(unit) ? 0.1 : 0;
  return relevance + hasNumber + definitionBoost;
}

function extractUnits(text: string): string[] {
  const lines = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length > 1) return lines;

  const sentences = text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
  if (sentences.length > 1) return sentences;

  return text
    .split(/\s+/)
    .map((word) => word.trim())
    .filter(Boolean);
}

function joinUnits(units: string[], original: string): string {
  if (original.includes("\n")) return units.join("\n");
  if (/[.!?]/.test(original)) return units.join(" ");
  return units.join(" ");
}

function truncateWordsToBudget(text: string, budget: number, queryTokens: Set<string>): string {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length <= 1) return text.slice(0, Math.max(1, budget * 4));

  const scored = words
    .map((word, index) => ({
      word,
      index,
      score: scoreUnit(word, queryTokens) + (index === 0 || index === words.length - 1 ? 0.05 : 0),
      tokens: estimateTokens(word),
    }))
    .sort((a, b) => b.score - a.score);

  const kept: typeof scored = [];
  let used = 0;
  for (const item of scored) {
    if (used + item.tokens > budget && kept.length > 0) continue;
    kept.push(item);
    used += item.tokens;
    if (used >= budget) break;
  }

  kept.sort((a, b) => a.index - b.index);
  return kept.map((item) => item.word).join(" ");
}

export function compressToTargetRatio(
  text: string,
  query: string,
  targetPctSaved: number,
): { compressed: string; originalTokens: number; compressedTokens: number } {
  const trimmed = text.trim();
  if (!trimmed) {
    return { compressed: "", originalTokens: 0, compressedTokens: 0 };
  }

  const boundedTarget = Math.min(0.9, Math.max(0.1, targetPctSaved));
  const originalTokens = estimateTokens(trimmed);
  const budget = Math.max(1, Math.floor(originalTokens * (1 - boundedTarget)));
  const queryTokens = tokenize(query);
  const units = extractUnits(trimmed);

  const scored = units.map((unit, index) => ({
    unit,
    index,
    score: scoreUnit(unit, queryTokens) + (index === 0 ? 0.06 : 0),
    tokens: Math.max(1, estimateTokens(unit)),
  }));

  const ranked = [...scored].sort((a, b) => b.score - a.score);
  const kept: typeof scored = [];
  let used = 0;

  for (const item of ranked) {
    if (used + item.tokens > budget && kept.length > 0) continue;
    kept.push(item);
    used += item.tokens;
    if (used >= budget) break;
  }

  if (kept.length === 0 && scored.length > 0) {
    kept.push(scored[0]!);
  }

  kept.sort((a, b) => a.index - b.index);
  let compressed = joinUnits(
    kept.map((item) => item.unit),
    trimmed,
  );

  let compressedTokens = estimateTokens(compressed);
  if (compressedTokens > budget) {
    compressed = truncateWordsToBudget(compressed, budget, queryTokens);
    compressedTokens = estimateTokens(compressed);
  }

  return { compressed, originalTokens, compressedTokens };
}

export function getTargetPctSaved(): number {
  const raw = process.env.DRAWING_COMPRESSION_TARGET?.trim();
  const parsed = raw ? Number.parseFloat(raw) : 0.4;
  if (!Number.isFinite(parsed)) return 0.4;
  return Math.min(0.9, Math.max(0.1, parsed));
}
