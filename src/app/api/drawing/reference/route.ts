import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getOrCreateDrawingSession,
  updateDrawingSession,
} from "@/lib/drawing/session-store";
import { normalizeImageDataUrl } from "@/lib/drawing/utils";

export const maxDuration = 60;

const MAX_BYTES = 8 * 1024 * 1024;

type ReferenceBody = {
  sessionId?: string;
  topic?: string;
  imageBase64?: string;
  contentType?: string;
};

export async function POST(request: NextRequest) {
  let body: ReferenceBody = {};
  try {
    body = (await request.json()) as ReferenceBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const sessionId = body.sessionId?.trim();
  const imageBase64 = body.imageBase64?.trim();

  if (!sessionId || !imageBase64) {
    return NextResponse.json(
      { error: "sessionId and imageBase64 are required" },
      { status: 400 },
    );
  }

  getOrCreateDrawingSession(
    sessionId,
    body.topic?.trim() || "Drawing practice",
  );

  const dataUrl = normalizeImageDataUrl(imageBase64);
  const rawBase64 = dataUrl.replace(/^data:[^;]+;base64,/, "");
  const byteLength = Buffer.byteLength(rawBase64, "base64");

  if (byteLength > MAX_BYTES) {
    return NextResponse.json({ error: "Image too large (max 8MB)" }, { status: 400 });
  }

  let referenceImageUrl: string | null = null;
  const admin = createAdminClient();

  if (admin) {
    const contentType = body.contentType?.trim() || "image/png";
    const extension = contentType.includes("jpeg") ? "jpg" : "png";
    const path = `${sessionId}/reference.${extension}`;
    const buffer = Buffer.from(rawBase64, "base64");

    const { error: uploadError } = await admin.storage
      .from("drawing-references")
      .upload(path, buffer, { contentType, upsert: true });

    if (!uploadError) {
      const { data } = admin.storage.from("drawing-references").getPublicUrl(path);
      referenceImageUrl = data.publicUrl;
    }
  }

  const updated = updateDrawingSession(sessionId, {
    referenceImageDataUrl: dataUrl,
    referenceImageUrl,
  });

  if (!updated) {
    return NextResponse.json({ error: "Failed to update session" }, { status: 500 });
  }

  return NextResponse.json({
    hasReference: true,
  });
}
