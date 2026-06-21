import { NextResponse } from "next/server";
import { isDeepgramConfigured } from "@/lib/drawing/deepgram-server";

export async function GET() {
  return NextResponse.json({
    deepgram: isDeepgramConfigured(),
  });
}
