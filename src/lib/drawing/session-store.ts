import { randomUUID } from "crypto";
import type {
  CoachHistoryEntry,
  CreateDrawingSessionInput,
  DrawingSession,
} from "@/types/drawing";

type SessionStoreGlobal = {
  drawingSessions?: Map<string, DrawingSession>;
};

function getSessionMap(): Map<string, DrawingSession> {
  const globalStore = globalThis as SessionStoreGlobal;
  if (!globalStore.drawingSessions) {
    globalStore.drawingSessions = new Map<string, DrawingSession>();
  }
  return globalStore.drawingSessions;
}

function nowIso(): string {
  return new Date().toISOString();
}

export function createDrawingSession(input: CreateDrawingSessionInput): DrawingSession {
  const sessions = getSessionMap();
  const id = input.sessionId?.trim() || randomUUID();
  const timestamp = nowIso();

  const session: DrawingSession = {
    id,
    userId: input.userId ?? null,
    topic: input.topic.trim() || "Untitled diagram",
    referenceImageUrl: null,
    referenceImageDataUrl: null,
    coachHistory: [],
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  sessions.set(id, session);
  return session;
}

export function getDrawingSession(sessionId: string): DrawingSession | null {
  return getSessionMap().get(sessionId) ?? null;
}

export function getOrCreateDrawingSession(
  sessionId: string,
  topic = "Drawing practice",
): DrawingSession {
  const existing = getDrawingSession(sessionId);
  if (existing) return existing;

  return createDrawingSession({
    sessionId,
    topic: topic.trim() || "Drawing practice",
  });
}

export function updateDrawingSession(
  sessionId: string,
  patch: Partial<
    Pick<
      DrawingSession,
      "topic" | "referenceImageUrl" | "referenceImageDataUrl" | "userId" | "coachHistory"
    >
  >,
): DrawingSession | null {
  const sessions = getSessionMap();
  const existing = sessions.get(sessionId);
  if (!existing) return null;

  const updated: DrawingSession = {
    ...existing,
    ...patch,
    updatedAt: nowIso(),
  };

  sessions.set(sessionId, updated);
  return updated;
}

export function appendCoachHistory(
  sessionId: string,
  entry: CoachHistoryEntry,
): DrawingSession | null {
  const existing = getDrawingSession(sessionId);
  if (!existing) return null;

  return updateDrawingSession(sessionId, {
    coachHistory: [...existing.coachHistory, entry].slice(-50),
  });
}

export function getDrawingSessionPublicView(session: DrawingSession) {
  return {
    id: session.id,
    topic: session.topic,
    hasReference: Boolean(session.referenceImageDataUrl || session.referenceImageUrl),
    coachHistory: session.coachHistory,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
  };
}

export function getReferenceImageForCoach(session: DrawingSession): string | null {
  return session.referenceImageDataUrl || session.referenceImageUrl;
}
