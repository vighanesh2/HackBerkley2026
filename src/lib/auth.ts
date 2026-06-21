import { NextRequest } from "next/server";

export function isAuthorizedAgent(request: NextRequest): boolean {
  const secret = process.env.LISTINGS_API_SECRET;
  if (!secret) {
    return process.env.NODE_ENV === "development";
  }

  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return false;
  }

  return authHeader.slice("Bearer ".length) === secret;
}
