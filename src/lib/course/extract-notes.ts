import OfficeParser, { type SupportedFileType } from "officeparser";

const DOCUMENT_EXTENSIONS = new Set(["pdf", "doc", "docx", "ppt", "pptx"]);

// Maps our supported extensions to officeparser's SupportedFileType.
// 'doc' and 'ppt' are legacy binary formats with no hint value — officeparser
// reads them via magic bytes rather than a hint, so we omit them.
const FILE_TYPE_HINTS: Partial<Record<string, SupportedFileType>> = {
  pdf: "pdf",
  docx: "docx",
  pptx: "pptx",
};

export const MAX_NOTE_FILE_BYTES = 5 * 1024 * 1024;

export function isDocumentFileName(name: string): boolean {
  const extension = name.split(".").pop()?.toLowerCase() ?? "";
  return DOCUMENT_EXTENSIONS.has(extension);
}

export function isPlainTextFileName(name: string): boolean {
  return /\.(txt|md|markdown|text)$/i.test(name);
}

export async function extractTextFromDocument(buffer: Buffer, fileName?: string): Promise<string> {
  const extension = fileName?.split(".").pop()?.toLowerCase();
  const fileType = extension ? FILE_TYPE_HINTS[extension] : undefined;

  // eslint-disable-next-line @typescript-eslint/no-deprecated
  const ast = await OfficeParser.parseOffice(buffer, {
    extractAttachments: false,
    ocr: false,
    ...(fileType ? { fileType } : {}),
  });

  // eslint-disable-next-line @typescript-eslint/no-deprecated
  const text = ast.toText().trim();
  if (!text) {
    throw new Error("No readable text found in this file.");
  }

  return text;
}

export function formatExtractedNotes(fileName: string, text: string): string {
  return `## ${fileName}\n${text.trim()}`;
}
