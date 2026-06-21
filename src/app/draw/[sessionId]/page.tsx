import { Suspense } from "react";
import DrawingCoachWorkspace from "@/components/drawing/DrawingCoachWorkspace";
import {
  createDrawingSession,
  getDrawingSession,
  getDrawingSessionPublicView,
} from "@/lib/drawing/session-store";

type DrawPageProps = {
  params: Promise<{ sessionId: string }>;
  searchParams: Promise<{ topic?: string }>;
};

export default async function DrawPage({ params, searchParams }: DrawPageProps) {
  const { sessionId } = await params;
  const { topic } = await searchParams;

  let session = getDrawingSession(sessionId);

  if (!session) {
    session = createDrawingSession({
      sessionId,
      topic: topic?.trim() || "Drawing practice",
    });
  }

  return (
    <Suspense fallback={<div className="p-8 text-sm text-neutral-600">Loading drawing coach…</div>}>
      <DrawingCoachWorkspace
        sessionId={sessionId}
        initialSession={getDrawingSessionPublicView(session)}
      />
    </Suspense>
  );
}

export async function generateMetadata({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const session = getDrawingSession(sessionId);
  return {
    title: session ? `Draw: ${session.topic}` : "Drawing Coach",
  };
}
