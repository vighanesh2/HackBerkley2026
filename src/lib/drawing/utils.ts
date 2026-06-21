export function getAppBaseUrl(): string {
  const publicUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  const vercelUrl = process.env.VERCEL_URL?.trim();

  // On Vercel, ignore localhost in NEXT_PUBLIC_APP_URL (common misconfiguration).
  if (
    publicUrl &&
    !publicUrl.includes("localhost") &&
    !publicUrl.includes("127.0.0.1")
  ) {
    if (publicUrl.startsWith("http")) return publicUrl.replace(/\/$/, "");
    return `https://${publicUrl.replace(/\/$/, "")}`;
  }

  if (vercelUrl) {
    if (vercelUrl.startsWith("http")) return vercelUrl.replace(/\/$/, "");
    return `https://${vercelUrl.replace(/\/$/, "")}`;
  }

  if (publicUrl) {
    if (publicUrl.startsWith("http")) return publicUrl.replace(/\/$/, "");
    return `https://${publicUrl.replace(/\/$/, "")}`;
  }

  return "http://localhost:3000";
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
