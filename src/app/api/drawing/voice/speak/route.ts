import { NextRequest, NextResponse } from "next/server";
import { isDeepgramConfigured, synthesizeSpeech } from "@/lib/drawing/deepgram-server";

export const maxDuration = 30;

type SpeakBody = {
  text?: string;
};

export async function POST(request: NextRequest) {
  let body: SpeakBody = {};
  try {
    body = (await request.json()) as SpeakBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const text = body.text?.trim();
  if (!text) {
    return NextResponse.json({ error: "text is required" }, { status: 400 });
  }

  if (!isDeepgramConfigured()) {
    return NextResponse.json({ fallback: "browser", text });
  }

  try {
    const audio = await synthesizeSpeech(text);
    return new NextResponse(audio, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return NextResponse.json({ fallback: "browser", text });
  }
}
