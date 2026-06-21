import { NextRequest, NextResponse } from "next/server";
import { isDeepgramConfigured, transcribeAudio } from "@/lib/drawing/deepgram-server";

export const maxDuration = 30;

export async function POST(request: NextRequest) {
  if (!isDeepgramConfigured()) {
    return NextResponse.json({ error: "Deepgram is not configured" }, { status: 503 });
  }

  const audio = await request.arrayBuffer();
  if (!audio.byteLength) {
    return NextResponse.json({ error: "Empty audio payload" }, { status: 400 });
  }

  const contentType = request.headers.get("content-type")?.split(";")[0]?.trim() || "audio/webm";

  try {
    const transcript = await transcribeAudio(audio, contentType);
    return NextResponse.json({ transcript, provider: "deepgram" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Transcription failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
