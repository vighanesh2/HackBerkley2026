"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Editor } from "tldraw";
import { exportCanvasPng } from "@/components/drawing/DrawingCanvas";
import { clearCoachHints, drawCoachHints } from "@/lib/drawing/canvas-hints";
import { hashBase64Image } from "@/lib/drawing/utils";
import type { CoachTip } from "@/types/drawing";

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
  const speechRef = useRef<SpeechRecognitionLike | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const [listening, setListening] = useState(false);
  const [muted, setMuted] = useState(false);
  const [showGhost, setShowGhost] = useState(false);
  const [ghostImageUrl, setGhostImageUrl] = useState<string | null>(null);
  const [coachActive, setCoachActive] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [lastTip, setLastTip] = useState<CoachTip | null>(null);
  const [lastSpoken, setLastSpoken] = useState("");
  const [error, setError] = useState<string | null>(null);

  const speak = useCallback(
    (text: string) => {
      if (muted || !text.trim() || typeof window === "undefined") return;

      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1;
      utterance.pitch = 1;
      utteranceRef.current = utterance;
      window.speechSynthesis.speak(utterance);
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

  const startListening = useCallback(() => {
    if (typeof window === "undefined") return;

    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
      setError("Speech recognition is not supported in this browser. Use Chrome.");
      return;
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
      setTranscript(latest.trim());
    };

    recognition.onerror = () => {
      setListening(false);
    };

    recognition.onend = () => {
      if (speechRef.current) {
        try {
          recognition.start();
        } catch {
          setListening(false);
        }
      }
    };

    speechRef.current = recognition;
    recognition.start();
    setListening(true);
    setError(null);
  }, []);

  const stopListening = useCallback(() => {
    speechRef.current?.stop();
    speechRef.current = null;
    setListening(false);
  }, []);

  const toggleListening = useCallback(() => {
    if (listening) stopListening();
    else startListening();
  }, [listening, startListening, stopListening]);

  const toggleMute = useCallback(() => {
    setMuted((value) => {
      if (!value && typeof window !== "undefined") {
        window.speechSynthesis.cancel();
      }
      return !value;
    });
  }, []);

  useEffect(() => {
    return () => {
      stopListening();
      if (typeof window !== "undefined") window.speechSynthesis.cancel();
    };
  }, [stopListening]);

  return {
    listening,
    muted,
    showGhost,
    ghostImageUrl,
    coachActive,
    transcript,
    lastTip,
    lastSpoken,
    error,
    onEditorReady,
    toggleListening,
    toggleMute,
    toggleGhost,
    clearHints,
    requestHint,
    checkDrawing: () => void requestCoach("manual"),
  };
}
