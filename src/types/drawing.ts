export type CoachSeverity = "info" | "nudge" | "fix";

export type CoachHintShape = {
  type: "rectangle" | "ellipse" | "arrow" | "line";
  /** Normalized start X (0 = left edge of drawing frame). */
  x: number;
  /** Normalized start Y (0 = top edge of drawing frame). */
  y: number;
  w?: number;
  h?: number;
  /** Normalized end X for lines (preferred over w/h delta). */
  x2?: number;
  /** Normalized end Y for lines (preferred over w/h delta). */
  y2?: number;
  label?: string;
};

export type CoachTip = {
  tip: string;
  severity: CoachSeverity;
  nextStep: string;
  praise: string;
  /** Short name of the diagram part the learner should draw next. */
  currentPart: string;
  /** Plain-language explanation of what that part is and how it fits the diagram. */
  explanation: string;
  hintShapes?: CoachHintShape[];
};

export type CoachHistoryEntry = {
  at: string;
  tip: CoachTip;
  trigger: "manual" | "idle" | "heartbeat" | "voice" | "hint";
};

export type DrawingSessionPublicView = {
  id: string;
  topic: string;
  hasReference: boolean;
  coachHistory: CoachHistoryEntry[];
  createdAt: string;
  updatedAt: string;
};

export type DrawingSession = {
  id: string;
  userId: string | null;
  topic: string;
  referenceImageUrl: string | null;
  referenceImageDataUrl: string | null;
  coachHistory: CoachHistoryEntry[];
  createdAt: string;
  updatedAt: string;
};

export type CreateDrawingSessionInput = {
  sessionId?: string;
  topic: string;
  userId?: string | null;
};
