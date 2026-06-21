import { NextResponse } from "next/server";
import { getAgentApiSecret } from "@/lib/agent-auth";
import { getAppBaseUrl } from "@/lib/drawing/utils";
import { isVisionConfigured } from "@/lib/drawing/vision-coach";

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "diagram-drawing-coach",
    appUrl: getAppBaseUrl(),
    agentSecretConfigured: Boolean(getAgentApiSecret()),
    visionConfigured: isVisionConfigured(),
  });
}
