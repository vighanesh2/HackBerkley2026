const DEEPGRAM_API = "https://api.deepgram.com/v1";

export function isDeepgramConfigured(): boolean {
  return Boolean(process.env.DEEPGRAM_API_KEY?.trim());
}

function getDeepgramApiKey(): string {
  const key = process.env.DEEPGRAM_API_KEY?.trim();
  if (!key) {
    throw new Error("DEEPGRAM_API_KEY is not configured");
  }
  return key;
}

export function getDeepgramSttModel(): string {
  return process.env.DEEPGRAM_STT_MODEL?.trim() || "nova-2";
}

export function getDeepgramTtsModel(): string {
  return process.env.DEEPGRAM_TTS_MODEL?.trim() || "aura-asteria-en";
}

export async function transcribeAudio(
  audio: ArrayBuffer,
  contentType: string,
): Promise<string> {
  const model = getDeepgramSttModel();
  const params = new URLSearchParams({
    model,
    smart_format: "true",
    punctuate: "true",
    language: "en",
  });

  const response = await fetch(`${DEEPGRAM_API}/listen?${params}`, {
    method: "POST",
    headers: {
      Authorization: `Token ${getDeepgramApiKey()}`,
      "Content-Type": contentType || "audio/webm",
    },
    body: audio,
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `Deepgram STT failed (${response.status})`);
  }

  const data = (await response.json()) as {
    results?: { channels?: Array<{ alternatives?: Array<{ transcript?: string }> }> };
  };

  return data.results?.channels?.[0]?.alternatives?.[0]?.transcript?.trim() || "";
}

export async function synthesizeSpeech(text: string): Promise<ArrayBuffer> {
  const model = getDeepgramTtsModel();
  const response = await fetch(`${DEEPGRAM_API}/speak?model=${encodeURIComponent(model)}`, {
    method: "POST",
    headers: {
      Authorization: `Token ${getDeepgramApiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `Deepgram TTS failed (${response.status})`);
  }

  return response.arrayBuffer();
}
