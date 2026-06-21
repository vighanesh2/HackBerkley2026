type TranscriptHandler = (transcript: string) => void;

type VoiceConfig = {
  deepgram: boolean;
};

let voiceConfigCache: VoiceConfig | null = null;

async function getVoiceConfig(): Promise<VoiceConfig> {
  if (voiceConfigCache) return voiceConfigCache;

  try {
    const response = await fetch("/api/drawing/voice/config");
    voiceConfigCache = (await response.json()) as VoiceConfig;
  } catch {
    voiceConfigCache = { deepgram: false };
  }

  return voiceConfigCache;
}

function pickRecorderMimeType(): string {
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
  for (const type of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }
  return "audio/webm";
}

export class DeepgramMicSession {
  private stream: MediaStream | null = null;
  private recorder: MediaRecorder | null = null;
  private transcript = "";
  private inFlight = false;
  private active = false;

  async start(onTranscript: TranscriptHandler): Promise<void> {
    this.stop();
    this.active = true;
    this.transcript = "";

    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mimeType = pickRecorderMimeType();
    this.recorder = new MediaRecorder(this.stream, { mimeType });

    this.recorder.addEventListener("dataavailable", (event) => {
      if (!this.active || event.data.size === 0 || this.inFlight) return;

      this.inFlight = true;
      void event.data
        .arrayBuffer()
        .then(async (buffer) => {
          const response = await fetch("/api/drawing/voice/transcribe", {
            method: "POST",
            headers: { "Content-Type": mimeType },
            body: buffer,
          });

          const data = (await response.json()) as { transcript?: string; error?: string };
          if (!response.ok || !data.transcript) return;

          this.transcript = this.transcript
            ? `${this.transcript} ${data.transcript}`.trim()
            : data.transcript.trim();
          onTranscript(this.transcript);
        })
        .catch(() => undefined)
        .finally(() => {
          this.inFlight = false;
        });
    });

    this.recorder.start(2000);
  }

  stop(): void {
    this.active = false;
    this.recorder?.stop();
    this.recorder = null;
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
  }
}

type SpeechRecognitionResultLike = {
  isFinal: boolean;
  0: { transcript: string };
};

type SpeechRecognitionEventLike = {
  results: ArrayLike<SpeechRecognitionResultLike>;
};

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

declare global {
  interface Window {
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
    SpeechRecognition?: SpeechRecognitionConstructor;
  }
}

export class BrowserMicSession {
  private recognition: SpeechRecognitionLike | null = null;

  start(onTranscript: TranscriptHandler): void {
    this.stop();

    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
      throw new Error("Speech recognition is not supported in this browser. Use Chrome.");
    }

    const recognition = new Recognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event: SpeechRecognitionEventLike) => {
      let latest = "";
      for (let i = 0; i < event.results.length; i += 1) {
        latest += event.results[i][0].transcript;
      }
      onTranscript(latest.trim());
    };

    recognition.onend = () => {
      if (this.recognition) {
        try {
          recognition.start();
        } catch {
          this.recognition = null;
        }
      }
    };

    this.recognition = recognition;
    recognition.start();
  }

  stop(): void {
    this.recognition?.stop();
    this.recognition = null;
  }
}

export async function createMicSession(): Promise<{
  session: DeepgramMicSession | BrowserMicSession;
  provider: "deepgram" | "browser";
}> {
  const config = await getVoiceConfig();
  if (config.deepgram) {
    return { session: new DeepgramMicSession(), provider: "deepgram" };
  }
  return { session: new BrowserMicSession(), provider: "browser" };
}

let activeAudio: HTMLAudioElement | null = null;
let activeObjectUrl: string | null = null;

function stopActiveAudio(): void {
  if (activeAudio) {
    activeAudio.pause();
    activeAudio.src = "";
    activeAudio = null;
  }
  if (activeObjectUrl) {
    URL.revokeObjectURL(activeObjectUrl);
    activeObjectUrl = null;
  }
}

export function stopSpeaking(): void {
  stopActiveAudio();
  if (typeof window !== "undefined") {
    window.speechSynthesis.cancel();
  }
}

export async function speakText(text: string, muted: boolean): Promise<"deepgram" | "browser" | "muted"> {
  if (muted || !text.trim() || typeof window === "undefined") {
    return "muted";
  }

  stopSpeaking();

  try {
    const response = await fetch("/api/drawing/voice/speak", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });

    if (response.headers.get("content-type")?.includes("audio")) {
      const blob = await response.blob();
      activeObjectUrl = URL.createObjectURL(blob);
      activeAudio = new Audio(activeObjectUrl);
      await activeAudio.play();
      return "deepgram";
    }
  } catch {
    // fall through to browser TTS
  }

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 1;
  utterance.pitch = 1;
  window.speechSynthesis.speak(utterance);
  return "browser";
}
