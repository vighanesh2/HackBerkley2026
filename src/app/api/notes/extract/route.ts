import { NextRequest, NextResponse } from "next/server";
import {
  extractTextFromDocument,
  isDocumentFileName,
  isPlainTextFileName,
  MAX_NOTE_FILE_BYTES,
} from "@/lib/course/extract-notes";
import { normalizeUserNotes } from "@/lib/course/notes";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }

  if (file.size > MAX_NOTE_FILE_BYTES) {
    return NextResponse.json(
      { error: "File is too large (max 5 MB)." },
      { status: 400 },
    );
  }

  const name = file.name || "upload";
  const isPlainText =
    isPlainTextFileName(name) ||
    file.type.startsWith("text/") ||
    file.type === "application/markdown";

  try {
    let text = "";

    if (isPlainText) {
      text = (await file.text()).trim();
    } else if (isDocumentFileName(name)) {
      const buffer = Buffer.from(await file.arrayBuffer());
      text = await extractTextFromDocument(buffer);
    } else {
      return NextResponse.json(
        {
          error:
            "Unsupported file type. Upload PDF, Word (.doc/.docx), PowerPoint (.ppt/.pptx), or plain text.",
        },
        { status: 400 },
      );
    }

    if (!text) {
      return NextResponse.json(
        { error: "No readable text found in this file." },
        { status: 400 },
      );
    }

    return NextResponse.json({
      fileName: name,
      text: normalizeUserNotes(text),
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Could not extract text from this file.";

    return NextResponse.json(
      {
        error: `${message} Try saving as .docx, .pptx, or .pdf if this is an older Office format.`,
      },
      { status: 422 },
    );
  }
}
