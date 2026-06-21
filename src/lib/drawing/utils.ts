export function getAppBaseUrl(): string {
  const configured =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.VERCEL_URL?.trim();

  if (!configured) return "http://localhost:3000";
  if (configured.startsWith("http")) return configured.replace(/\/$/, "");
  return `https://${configured.replace(/\/$/, "")}`;
}

export function drawingSessionUrl(sessionId: string): string {
  return `${getAppBaseUrl()}/draw/${encodeURIComponent(sessionId)}`;
}

export function stripDataUrlPrefix(dataUrl: string): string {
  const match = dataUrl.match(/^data:[^;]+;base64,(.+)$/);
  return match ? match[1] : dataUrl;
}

export function normalizeImageDataUrl(input: string): string {
  if (input.startsWith("data:")) return input;
  return `data:image/png;base64,${input}`;
}

/** Simple hash for deduplicating canvas snapshots on the client. */
export async function hashBase64Image(base64: string): Promise<string> {
  const payload = stripDataUrlPrefix(base64).slice(0, 5000);
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const encoded = new TextEncoder().encode(payload);
    const digest = await crypto.subtle.digest("SHA-256", encoded);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
  return String(payload.length);
}
