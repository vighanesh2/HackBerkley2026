import type { NextRequest } from "next/server";

export function getAgentCourseApiSecret(): string | null {
  const secret =
    process.env.AGENT_COURSE_API_SECRET?.trim() ||
    process.env.LISTINGS_API_SECRET?.trim();
  return secret || null;
}

export function isAgentCourseRequest(request: NextRequest): boolean {
  const secret = getAgentCourseApiSecret();
  if (!secret) return false;

  const header =
    request.headers.get("x-agent-api-key")?.trim() ||
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();

  return Boolean(header && header === secret);
}
