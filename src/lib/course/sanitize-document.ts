const SCHEMA_FIELD_PATTERN =
  /\b(practicalTask|knowledgeCheck|keyTerms|keyTakeaways|bulletPoints|feynmanPrompt|learningObjectives|welcomeMessage|howToUse|altText)\b/gi;

const DEFAULT_HOW_TO_USE = [
  "Read each lesson in order — later modules build on earlier ones.",
  "Complete the practical activity at the end of every lesson before moving on.",
  "Use the knowledge check quiz or reflection prompt to test yourself right away.",
  "Open the Feynman tutor and explain each lesson back in your own words.",
  "Check the Resources section for recommended videos and extra reading.",
];

function replaceSchemaJargon(text: string): string {
  return text
    .replace(/\*\*practicalTask\*\*/gi, "practical activity")
    .replace(/\bpracticalTask\b/gi, "practical activity")
    .replace(/\*\*knowledgeCheck\*\*/gi, "knowledge check")
    .replace(/\bknowledgeCheck\b/gi, "knowledge check")
    .replace(/\*\*keyTerms\*\*/gi, "key terms")
    .replace(/\bkeyTerms\b/gi, "key terms")
    .replace(/\*\*keyTakeaways\*\*/gi, "key takeaways")
    .replace(/\bkeyTakeaways\b/gi, "key takeaways")
    .replace(/\*\*feynmanPrompt\*\*/gi, "Feynman practice")
    .replace(/\bfeynmanPrompt\b/gi, "Feynman practice")
    .replace(/\*\*bulletPoints\*\*/gi, "bullet points")
    .replace(/\bbulletPoints\b/gi, "bullet points")
    .replace(/\*\*resources\*\*/gi, "Resources section")
    .replace(/\*\*learningObjectives\*\*/gi, "learning objectives")
    .replace(/\*\*modules?\*\*/gi, "lessons")
    .replace(/\bmodules?\b/gi, (match) => (match.toLowerCase() === "module" ? "lesson" : "lessons"));
}

export function sanitizeLearnerText(text: string): string {
  return replaceSchemaJargon(text).replace(/\s{2,}/g, " ").trim();
}

function stepHasSchemaJargon(step: string): boolean {
  return SCHEMA_FIELD_PATTERN.test(step);
}

export function sanitizeHowToUse(steps: string[]): string[] {
  const sanitized = steps.map((step) => sanitizeLearnerText(step)).filter(Boolean);

  if (sanitized.length === 0 || sanitized.some(stepHasSchemaJargon)) {
    return DEFAULT_HOW_TO_USE;
  }

  return sanitized.slice(0, 5);
}

export function sanitizeCourseCopy<T extends { howToUse: string[]; welcomeMessage: string; overview: string }>(
  document: T,
): T {
  return {
    ...document,
    welcomeMessage: sanitizeLearnerText(document.welcomeMessage),
    overview: sanitizeLearnerText(document.overview),
    howToUse: sanitizeHowToUse(document.howToUse),
  };
}
