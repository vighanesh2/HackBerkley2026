import type { NextRequest } from "next/server";

/** Shared secret for Agentverse → Next.js API calls. */
export function getAgentApiSecret(): string | null {
  const secret =
    process.env.AGENT_API_SECRET?.trim() ||
    process.env.AGENT_COURSE_API_SECRET?.trim() ||
    process.env.LISTINGS_API_SECRET?.trim();
  return secret || null;
}

export function isAgentRequest(request: NextRequest): boolean {
  const secret = getAgentApiSecret();
  if (!secret) return false;

  const header =
    request.headers.get("x-agent-api-key")?.trim() ||
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();

  return Boolean(header && header === secret);
}
