import { NextResponse } from "next/server";
import { normalizeUserNotes } from "@/lib/course/notes";
import { ingestSourceMaterial } from "@/lib/course/rag";
import { getAuthUser } from "@/lib/supabase/server";

type IngestBody = {
  sourceText?: string;
  sessionKey?: string;
};

export async function POST(request: Request) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: IngestBody;
  try {
    body = (await request.json()) as IngestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const sourceText = normalizeUserNotes(body.sourceText ?? "");
  if (!sourceText) {
    return NextResponse.json({ error: "sourceText is required" }, { status: 400 });
  }

  const sessionKey = body.sessionKey?.trim() || user.id;

  try {
    const { index, created } = await ingestSourceMaterial(sessionKey, sourceText);
    return NextResponse.json({
      ok: true,
      created,
      sessionKey,
      chunkCount: index.chunks.length,
      vectorMode: index.vectorMode,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "RAG ingestion failed",
      },
      { status: 500 },
    );
  }
}
