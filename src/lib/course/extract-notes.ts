import OfficeParser from "officeparser";

const DOCUMENT_EXTENSIONS = new Set([
  "pdf",
  "doc",
  "docx",
  "ppt",
  "pptx",
]);

export const MAX_NOTE_FILE_BYTES = 5 * 1024 * 1024;

export function isDocumentFileName(name: string): boolean {
  const extension = name.split(".").pop()?.toLowerCase() ?? "";
  return DOCUMENT_EXTENSIONS.has(extension);
}

export function isPlainTextFileName(name: string): boolean {
  return /\.(txt|md|markdown|text)$/i.test(name);
}

export async function extractTextFromDocument(buffer: Buffer): Promise<string> {
  const ast = await OfficeParser.parseOffice(buffer, {
    extractAttachments: false,
    ocr: false,
  });

  const text = ast.toText().trim();
  if (!text) {
    throw new Error("No readable text found in this file.");
  }

  return text;
}

export function formatExtractedNotes(fileName: string, text: string): string {
  return `## ${fileName}\n${text.trim()}`;
}
