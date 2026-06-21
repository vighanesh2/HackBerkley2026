"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Editor } from "tldraw";
import { exportCanvasPng } from "@/components/drawing/DrawingCanvas";
import { clearCoachHints, drawCoachHints } from "@/lib/drawing/canvas-hints";
import { hashBase64Image } from "@/lib/drawing/utils";
import {
  BrowserMicSession,
  DeepgramMicSession,
  createMicSession,
  speakText,
  stopSpeaking,
} from "@/lib/drawing/voice-client";
import type { CoachTip } from "@/types/drawing";
import type { CompressionSnapshot } from "@/types/compression";

type CoachTrigger = "manual" | "hint";

type UseDrawingCoachLoopOptions = {
  sessionId: string;
  topic: string;
  hasReference: boolean;
  enabled?: boolean;
};

export function useDrawingCoachLoop({
  sessionId,
  topic,
  hasReference,
  enabled = true,
}: UseDrawingCoachLoopOptions) {
  const editorRef = useRef<Editor | null>(null);
  const inFlightRef = useRef(false);
  const lastHashRef = useRef<string | null>(null);
  const micSessionRef = useRef<DeepgramMicSession | BrowserMicSession | null>(null);

  const [listening, setListening] = useState(false);
  const [muted, setMuted] = useState(false);
  const [voiceProvider, setVoiceProvider] = useState<"deepgram" | "browser" | null>(null);
  const [showGhost, setShowGhost] = useState(false);
  const [ghostImageUrl, setGhostImageUrl] = useState<string | null>(null);
  const [coachActive, setCoachActive] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [lastTip, setLastTip] = useState<CoachTip | null>(null);
  const [lastSpoken, setLastSpoken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [compressionLatest, setCompressionLatest] = useState<CompressionSnapshot | null>(null);
  const [compressionHistory, setCompressionHistory] = useState<CompressionSnapshot[]>([]);

  const speak = useCallback(
    (text: string) => {
      void speakText(text, muted).catch(() => undefined);
    },
    [muted],
  );

  const applyHintShapes = useCallback((tip: CoachTip | null | undefined) => {
    const editor = editorRef.current;
    if (!editor || !tip?.hintShapes?.length) return;
    drawCoachHints(editor, tip.hintShapes);
  }, []);

  const loadGhostImage = useCallback(async (): Promise<string> => {
    const response = await fetch(
      `/api/drawing/ghost?sessionId=${encodeURIComponent(sessionId)}`,
    );
    const data = (await response.json()) as { imageDataUrl?: string; error?: string };
    if (!response.ok || !data.imageDataUrl) {
      throw new Error(data.error || "Could not load ghost guide");
    }
    setGhostImageUrl(data.imageDataUrl);
    return data.imageDataUrl;
  }, [sessionId]);

  const showShadowGuide = useCallback(async () => {
    try {
      if (!ghostImageUrl) {
        await loadGhostImage();
      }
      setShowGhost(true);
      setError(null);
    } catch (shadowError) {
      setError(shadowError instanceof Error ? shadowError.message : "Shadow guide unavailable");
    }
  }, [ghostImageUrl, loadGhostImage]);

  const requestCoach = useCallback(
    async (trigger: CoachTrigger) => {
      if (!enabled || !hasReference || !editorRef.current || inFlightRef.current) {
        return;
      }

      inFlightRef.current = true;
      setCoachActive(true);
      setError(null);

      try {
        const canvasImageBase64 = await exportCanvasPng(editorRef.current);
        const hash = await hashBase64Image(canvasImageBase64);

        if (hash === lastHashRef.current && trigger !== "manual" && trigger !== "hint") {
          return;
        }

        lastHashRef.current = hash;

        const response = await fetch("/api/drawing/coach", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            topic,
            canvasImageBase64,
            transcript,
            trigger,
          }),
        });

        const data = (await response.json()) as {
          tip?: CoachTip;
          spoken?: string;
          error?: string;
          compression?: CompressionSnapshot;
        };

        if (!response.ok) {
          throw new Error(data.error || "Coach request failed");
        }

        if (data.tip) {
          setLastTip(data.tip);
          applyHintShapes(data.tip);
          await showShadowGuide();
        }
        if (data.spoken) {
          setLastSpoken(data.spoken);
          speak(data.spoken);
        }
        if (data.compression) {
          setCompressionLatest(data.compression);
          setCompressionHistory((previous) => [...previous, data.compression!].slice(-24));
        }
      } catch (coachError) {
        setError(coachError instanceof Error ? coachError.message : "Coach unavailable");
      } finally {
        inFlightRef.current = false;
        setCoachActive(false);
      }
    },
    [enabled, hasReference, sessionId, speak, topic, transcript, applyHintShapes, showShadowGuide],
  );

  const onEditorReady = useCallback((editor: Editor) => {
    editorRef.current = editor;
  }, []);

  const toggleGhost = useCallback(async () => {
    if (showGhost) {
      setShowGhost(false);
      return;
    }

    try {
      if (!ghostImageUrl) {
        await loadGhostImage();
      }
      setShowGhost(true);
      setError(null);
    } catch (ghostError) {
      setError(ghostError instanceof Error ? ghostError.message : "Ghost guide unavailable");
    }
  }, [ghostImageUrl, loadGhostImage, showGhost]);

  const clearHints = useCallback(() => {
    if (editorRef.current) clearCoachHints(editorRef.current);
  }, []);

  const requestHint = useCallback(() => {
    void requestCoach("hint");
  }, [requestCoach]);

  const stopListening = useCallback(() => {
    micSessionRef.current?.stop();
    micSessionRef.current = null;
    setListening(false);
  }, []);

  const startListening = useCallback(async () => {
    stopListening();
    setError(null);

    try {
      const { session, provider } = await createMicSession();

      try {
        await session.start((nextTranscript) => {
          setTranscript(nextTranscript);
        });
        micSessionRef.current = session;
        setVoiceProvider(provider);
        setListening(true);
        return;
      } catch (primaryError) {
        if (provider !== "deepgram") {
          throw primaryError;
        }
      }

      const fallback = new BrowserMicSession();
      fallback.start((nextTranscript) => {
        setTranscript(nextTranscript);
      });
      micSessionRef.current = fallback;
      setVoiceProvider("browser");
      setListening(true);
    } catch (listenError) {
      setError(listenError instanceof Error ? listenError.message : "Could not start microphone");
      setListening(false);
    }
  }, [stopListening]);

  const toggleListening = useCallback(() => {
    if (listening) stopListening();
    else void startListening();
  }, [listening, startListening, stopListening]);

  const toggleMute = useCallback(() => {
    setMuted((value) => {
      if (!value) stopSpeaking();
      return !value;
    });
  }, []);

  useEffect(() => {
    return () => {
      stopListening();
      stopSpeaking();
    };
  }, [stopListening]);

  return {
    listening,
    muted,
    voiceProvider,
    showGhost,
    ghostImageUrl,
    coachActive,
    transcript,
    lastTip,
    lastSpoken,
    error,
    compressionLatest,
    compressionHistory,
    onEditorReady,
    toggleListening,
    toggleMute,
    toggleGhost,
    clearHints,
    requestHint,
    checkDrawing: () => void requestCoach("manual"),
  };
}
