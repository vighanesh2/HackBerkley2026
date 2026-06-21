import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { z } from "zod";
import { getCourseModel } from "@/lib/course/llm";
import {
  appendGapNotes,
  currentModule,
  isAffirmative,
  isNegative,
  setModuleStatus,
  syncSessionFromDocument,
} from "@/lib/course/session";
import { hasUserNotes, notesPromptSection } from "@/lib/course/notes";
import { buildRagContext } from "@/lib/course/rag";
import type { CourseDocument } from "@/types/course-document";
import type { CourseModule, CourseSession } from "@/types/course";
import {
  mergeAgentVideos,
  mergeDiscoveredVideos,
  normalizeAndValidateAgentVideos,
} from "@/lib/course/videos";
import { discoverVideosForCourse } from "@/lib/course/video-suggestions";
import { sanitizeCourseCopy, sanitizeLearnerText } from "@/lib/course/sanitize-document";

const GraphState = Annotation.Root({
  session: Annotation<CourseSession>,
  userMessage: Annotation<string>,
  reply: Annotation<string>,
  agentVideos: Annotation<unknown[] | undefined>,
  sessionKey: Annotation<string | undefined>,
  skipVideoDiscovery: Annotation<boolean | undefined>,
});

type State = typeof GraphState.State;

async function getNotesContext(
  sessionKey: string | undefined,
  sourceText: string | undefined,
  query: string,
  topK = 6,
): Promise<string> {
  if (!hasUserNotes(sourceText)) return "";

  if (!sessionKey) {
    return notesPromptSection(sourceText);
  }

  try {
    const rag = await buildRagContext({
      sessionKey,
      sourceText: sourceText!,
      query,
      topK,
    });
    return rag.promptSection || notesPromptSection(sourceText);
  } catch {
    return notesPromptSection(sourceText);
  }
}

const knowledgeCheckSchema = z.object({
  type: z.enum(["quiz", "reflection"]),
  question: z.string(),
  options: z.array(z.string()).optional(),
  answer: z.string().optional(),
  reflectionPrompt: z.string().optional(),
});

const courseDocumentSchema = z.object({
  title: z.string(),
  emoji: z.string(),
  welcomeMessage: z.string(),
  overview: z.string(),
  howToUse: z
    .array(z.string())
    .describe(
      "4-5 plain-English steps for students navigating the course. Never use JSON or schema field names.",
    ),
  learningObjectives: z.array(
    z.object({
      statement: z.string(),
      bloomLevel: z.string(),
    }),
  ),
  modules: z.array(
    z.object({
      title: z.string(),
      objective: z.string(),
      summary: z.string(),
      paragraphs: z.array(z.string()),
      bulletPoints: z.array(z.string()),
      keyTerms: z.array(
        z.object({
          term: z.string(),
          definition: z.string(),
        }),
      ),
      keyTakeaways: z.array(z.string()),
      practicalTask: z.string(),
      knowledgeCheck: knowledgeCheckSchema,
      visual: z.object({
        title: z.string(),
        description: z.string(),
        altText: z.string(),
        type: z.enum(["diagram", "infographic", "chart"]),
      }),
      feynmanPrompt: z.string(),
    }),
  ),
  resources: z.array(
    z.object({
      title: z.string(),
      type: z.string(),
      note: z.string().optional(),
    }),
  ),
});

const evaluationSchema = z.object({
  passed: z.boolean(),
  gaps: z.array(z.string()),
  feedback: z.string(),
});

const ONLINE_TEXT_COURSE_PROMPT = [
  "You are an expert designer of highly readable ONLINE TEXT COURSES.",
  "Write in a conversational, warm, personalized tone — like a friendly instructor speaking directly to the learner.",
  "Use backward design: clear learning objectives first, then micro-lessons, then assessments.",
  "",
  "CRITICAL — USER-FACING TEXT:",
  "- Every string shown to learners must be natural English.",
  "- NEVER write schema/JSON field names in learner-visible text (no practicalTask, knowledgeCheck, keyTerms, feynmanPrompt, bulletPoints, resources as literal words).",
  "- Refer to features by their student-facing labels: \"practical activity\", \"knowledge check\", \"key terms\", \"Feynman tutor\", \"Resources section\".",
  "",
  "FORMATTING RULES:",
  "- Short paragraphs (2-4 sentences max). Never walls of text.",
  "- Each module is ONE micro-lesson with ONE clear objective.",
  "",
  "EACH MODULE MUST INCLUDE:",
  "- summary: one engaging hook sentence",
  "- paragraphs: 2-4 short digestible paragraphs explaining the concept simply",
  "- bulletPoints: 3-5 scannable takeaways or steps",
  "- keyTerms: 2-4 terms with plain-language definitions",
  "- keyTakeaways: 2-3 memorable one-liners",
  "- practicalTask: one immediate hands-on action (labelled \"Your turn\" in the UI)",
  "- knowledgeCheck: a quiz (with options + answer) OR a reflection thought prompt",
  "- visual: describe a diagram/infographic/chart (title, description, altText for accessibility)",
  "- feynmanPrompt: what to explain back in your own words (Feynman Technique)",
  "",
  "COURSE-LEVEL:",
  "- welcomeMessage: warm 2-3 sentence greeting",
  "- overview: brief scannable intro (not overwhelming)",
  "- howToUse: 4-5 plain-English navigation steps. Example style:",
  "  • Read each lesson in order — later lessons build on earlier ones.",
  "  • Complete the practical activity at the end of every lesson before moving on.",
  "  • Use the knowledge check to test yourself immediately.",
  "  • Open the Feynman tutor and explain each lesson back in your own words.",
  "  • Check the Resources section for videos and extra reading.",
  "- learningObjectives: 5-7 measurable outcomes with Bloom verbs",
  "- 4-6 modules from foundations to application — do not over-pack",
  "- resources: free/OER suggestions only",
].join("\n");

function toCourseDocument(raw: z.infer<typeof courseDocumentSchema>): CourseDocument {
  const base = sanitizeCourseCopy({
    ...raw,
    completed: false,
    modules: raw.modules.map((module) => ({
      ...module,
      summary: sanitizeLearnerText(module.summary),
      objective: sanitizeLearnerText(module.objective),
      practicalTask: sanitizeLearnerText(module.practicalTask),
      feynmanPrompt: sanitizeLearnerText(module.feynmanPrompt),
      paragraphs: module.paragraphs.map(sanitizeLearnerText),
      bulletPoints: module.bulletPoints.map(sanitizeLearnerText),
      keyTakeaways: module.keyTakeaways.map(sanitizeLearnerText),
      status: "not_started" as const,
      gapNotes: [],
    })),
  });

  return base;
}

function pickNode(state: State): string {
  const { session, userMessage } = state;
  const text = userMessage.trim();

  if (session.phase === "idle") {
    return text ? "generateCourseDocument" : "promptTopic";
  }

  if (session.phase === "outline_ready") {
    if (isAffirmative(text)) return "teach";
    if (isNegative(text)) return "reset";
    return "reviseCourseDocument";
  }

  if (session.phase === "challenge") {
    return text ? "evaluate" : "nudgeChallenge";
  }

  if (session.phase === "remediating") {
    return "teach";
  }

  if (session.phase === "complete") {
    return "restart";
  }

  return "promptTopic";
}

async function promptTopic(): Promise<Partial<State>> {
  return {
    reply:
      "What would you like to learn? Describe a topic or goal — e.g. \"machine learning basics\" or \"prepare for AP Biology\".",
  };
}

async function generateCourseDocument(state: State): Promise<Partial<State>> {
  const model = getCourseModel();
  const topic = state.userMessage.trim();
  const notes = state.session.userNotes;

  // Strip common filler phrases to get the real subject the user wants to learn.
  // e.g. "I want to learn machine learning" → "machine learning"
  const strippedTopic = topic
    .replace(/^(i want to learn|teach me about|teach me|learn about|learn|explain|help me (understand|learn)|what is|tell me about)\s*/i, "")
    .trim();

  // Vague reference phrases — the user said "teach me this" or "this course" meaning
  // "whatever is in my notes", not a real topic name.
  const VAGUE_REFS = /^(this|it|that|these|those|this course|the course|my course|this topic|the topic|my notes|these notes|this material|from my notes|teach me from my notes)$/i;

  // A topic is specific only if something real remains after stripping AND it isn't
  // just a pronoun/reference pointing to the uploaded notes.
  const hasSpecificTopic =
    strippedTopic.length > 0 &&
    !VAGUE_REFS.test(strippedTopic) &&
    (strippedTopic.split(/\s+/).length >= 2 || strippedTopic.length > 12);

  // Use the cleaned topic as the RAG query so retrieval finds relevant chunks.
  // If topic is vague and notes exist, retrieve broadly from the notes.
  const ragQuery = hasSpecificTopic ? strippedTopic : "main concepts key topics overview";

  const notesContext = await getNotesContext(
    state.sessionKey,
    notes,
    ragQuery,
    8,
  );

  const structured = model.withStructuredOutput(courseDocumentSchema);

  // Build the user prompt differently depending on whether a specific topic was given.
  let userPrompt: string;
  if (hasSpecificTopic) {
    // User gave a real topic — notes are supplementary only.
    userPrompt = [
      `Create a complete online text course on: ${strippedTopic}`,
      notesContext,
      hasUserNotes(notes)
        ? `The course topic is "${strippedTopic}". Stay focused on that topic. Use the retrieved source excerpts above only where they add relevant examples, definitions, or depth for this specific topic. Do not shift the course to cover unrelated content from the excerpts.`
        : "",
    ]
      .filter(Boolean)
      .join("\n\n");
  } else if (hasUserNotes(notes)) {
    // User gave no specific topic but uploaded notes — derive the subject from the notes.
    userPrompt = [
      "The learner has uploaded their own study material. Using the retrieved excerpts below, identify the main subject and create a complete online text course on it.",
      notesContext,
      "Base the course title, modules, and content on the subject matter in the retrieved excerpts. Use the learner's own terminology and structure where helpful.",
    ]
      .filter(Boolean)
      .join("\n\n");
  } else {
    // No specific topic, no notes — fall back to the raw message.
    userPrompt = `Create a complete online text course for: ${topic}`;
  }

  const result = await structured.invoke([
    { role: "system", content: ONLINE_TEXT_COURSE_PROMPT },
    { role: "user", content: userPrompt },
  ]);

  let document = toCourseDocument(result);
  if (hasUserNotes(notes)) {
    document = { ...document, personalNotesUsed: true };
  }

  const agentVideos = await normalizeAndValidateAgentVideos(state.agentVideos);
  if (agentVideos.length > 0) {
    document = mergeAgentVideos(document, agentVideos);
  } else if (!state.skipVideoDiscovery) {
    try {
      // Use the generated course title as the video search query, not the raw user
      // message — the title is always a clean subject like "Machine Learning Basics",
      // even when the user typed something vague like "teach me this course".
      const videoSearchTopic = document.title || strippedTopic || topic;
      const discovered = await discoverVideosForCourse(
        videoSearchTopic,
        document.modules.map((module) => module.title),
      );
      if (discovered.featured || discovered.moduleVideos.length > 0) {
        document = mergeDiscoveredVideos(document, discovered);
      } else {
        console.warn("[video-discovery] search returned no results for:", videoSearchTopic);
      }
    } catch (err) {
      // Video search is optional — course still works without videos.
      console.error("[video-discovery] failed:", err instanceof Error ? err.message : err);
    }
  }

  const session = syncSessionFromDocument(
    {
      ...state.session,
      currentModuleIndex: 0,
      phase: "outline_ready",
      lastLesson: "",
      attemptCount: 0,
      gaps: [],
    },
    document,
  );

  const videoNote =
    document.featuredVideo != null
      ? `**Watch first:** [${document.featuredVideo.title}](${document.featuredVideo.url})`
      : "";

  const notesNote = hasUserNotes(notes)
    ? "Your uploaded source material was retrieved and compressed via RAG — the course and tutor are grounded in your notes."
    : "";

  return {
    session,
    reply: [
      `**${document.title}** is ready on the page — start with Lesson 1.`,
      videoNote,
      notesNote,
      "When you're ready, reply **yes** here to begin the Feynman tutor for that lesson.",
    ]
      .filter(Boolean)
      .join("\n\n"),
  };
}

async function reviseCourseDocument(state: State): Promise<Partial<State>> {
  const model = getCourseModel();
  const structured = model.withStructuredOutput(courseDocumentSchema);
  const doc = state.session.document;

  const notesContext = await getNotesContext(
    state.sessionKey,
    state.session.userNotes,
    `Revise course on ${state.session.topic}: ${state.userMessage}`,
    6,
  );

  const result = await structured.invoke([
    { role: "system", content: ONLINE_TEXT_COURSE_PROMPT },
    {
      role: "user",
      content: [
        "Revise this online text course based on feedback.",
        `Topic: ${state.session.topic}`,
        notesContext,
        doc ? `Current course JSON: ${JSON.stringify(doc)}` : "",
        `User feedback: ${state.userMessage}`,
      ].join("\n"),
    },
  ]);

  const document = toCourseDocument(result);
  preserveModuleProgress(document, state.session.document);

  const session = syncSessionFromDocument(
    {
      ...state.session,
      currentModuleIndex: 0,
      phase: "outline_ready",
    },
    document,
  );

  return {
    session,
    reply: [
      "Course updated on the page. Review the changes, then reply **yes** in chat to continue.",
    ].join("\n"),
  };
}

function preserveModuleProgress(
  next: CourseDocument,
  previous: CourseDocument | null,
): void {
  if (!previous) return;
  for (let i = 0; i < next.modules.length; i++) {
    const old = previous.modules[i];
    if (old && old.title === next.modules[i].title) {
      next.modules[i].status = old.status;
      next.modules[i].gapNotes = old.gapNotes;
    }
  }
}

async function teach(state: State): Promise<Partial<State>> {
  const model = getCourseModel();
  const module = currentModule(state.session);
  if (!module) {
    return completeCourse(state);
  }

  let document = state.session.document;
  const docModule = document?.modules[state.session.currentModuleIndex];

  if (document) {
    document = setModuleStatus(document, state.session.currentModuleIndex, "in_progress");
  }

  const gapNote =
    state.session.gaps.length > 0
      ? `Focus on these gaps: ${state.session.gaps.join("; ")}`
      : "First explanation for this lesson.";

  const notesContext = await getNotesContext(
    state.sessionKey,
    state.session.userNotes,
    `${module.title}: ${module.objective}`,
    4,
  );

  const response = await model.invoke([
    {
      role: "system",
      content: [
        "You are a Feynman-style tutor with a conversational, friendly tone.",
        "Use short paragraphs. Explain simply — no jargon without definition.",
        "Use one analogy and one example. Be scannable, not overwhelming.",
        hasUserNotes(state.session.userNotes)
          ? "The learner uploaded source material — teach from the retrieved excerpts first, then clarify and connect ideas."
          : "",
      ]
        .filter(Boolean)
        .join(" "),
    },
    {
      role: "user",
      content: [
        `Course: ${state.session.topic}`,
        `Lesson: ${module.title}`,
        `Objective: ${module.objective}`,
        docModule?.summary ? `Hook: ${docModule.summary}` : "",
        notesContext,
        gapNote,
      ]
        .filter(Boolean)
        .join("\n"),
    },
  ]);

  const lesson = String(response.content);
  const feynmanPrompt =
    docModule?.feynmanPrompt ?? `Explain ${module.title} in your own words.`;

  const challenge = [
    "",
    "---",
    "**Feynman check:** Explain this lesson back in plain language.",
    feynmanPrompt,
  ].join("\n");

  return {
    session: {
      ...state.session,
      document,
      phase: "challenge",
      lastLesson: lesson,
      attemptCount: state.session.gaps.length > 0 ? state.session.attemptCount + 1 : 0,
    },
    reply: `${lesson}${challenge}`,
  };
}

async function nudgeChallenge(): Promise<Partial<State>> {
  return {
    reply: "Try explaining the lesson in your own words — even a rough attempt helps me find gaps.",
  };
}

async function evaluate(state: State): Promise<Partial<State>> {
  const model = getCourseModel();
  const module = currentModule(state.session);
  if (!module) {
    return completeCourse(state);
  }

  const structured = model.withStructuredOutput(evaluationSchema);

  const notesContext = await getNotesContext(
    state.sessionKey,
    state.session.userNotes,
    `${module.title}: ${module.objective}`,
    3,
  );

  const result = await structured.invoke([
    {
      role: "system",
      content: [
        "Evaluate a learner's explanation using the Feynman Technique.",
        "Pass if they cover the core idea clearly in simple language.",
        "Fail if key ideas are missing, wrong, or too jargon-heavy.",
        "List specific gaps as short bullet phrases.",
        hasUserNotes(state.session.userNotes)
          ? "Compare their explanation against both the lesson and their uploaded notes."
          : "",
      ]
        .filter(Boolean)
        .join(" "),
    },
    {
      role: "user",
      content: [
        `Lesson: ${module.title}`,
        `Objective: ${module.objective}`,
        notesContext,
        `Reference lesson:\n${state.session.lastLesson}`,
        `Learner explanation:\n${state.userMessage}`,
      ]
        .filter(Boolean)
        .join("\n\n"),
    },
  ]);

  if (result.passed) {
    return advanceModule(state, result.feedback);
  }

  let document = state.session.document;
  if (document) {
    document = appendGapNotes(document, state.session.currentModuleIndex, result.gaps);
  }

  return {
    session: {
      ...state.session,
      document,
      phase: "remediating",
      gaps: result.gaps,
      attemptCount: state.session.attemptCount + 1,
    },
    reply: [
      "Almost there — a few gaps to close:",
      ...result.gaps.map((gap) => `• ${gap}`),
      "",
      result.feedback,
      "",
      "I'll re-teach this more simply, then you'll explain again.",
    ].join("\n"),
  };
}

function advanceModule(state: State, feedback: string): Partial<State> {
  const index = state.session.currentModuleIndex;
  let document = state.session.document;
  if (document) {
    document = setModuleStatus(document, index, "mastered");
  }

  const nextIndex = index + 1;

  if (nextIndex >= state.session.modules.length) {
    return completeCourse({ ...state, session: { ...state.session, document } }, feedback);
  }

  const nextModule = state.session.modules[nextIndex];
  return {
    session: {
      ...state.session,
      document,
      currentModuleIndex: nextIndex,
      phase: "outline_ready",
      lastLesson: "",
      gaps: [],
      attemptCount: 0,
    },
    reply: [
      `✓ Lesson mastered! ${feedback}`,
      "",
      `Next — **Lesson ${nextIndex + 1}: ${nextModule.title}**`,
      "",
      'Reply **yes** when you\'re ready.',
    ].join("\n"),
  };
}

function completeCourse(state: State, feedback = ""): Partial<State> {
  let document = state.session.document;
  if (document) {
    document = { ...document, completed: true };
    if (state.session.currentModuleIndex < document.modules.length) {
      document = setModuleStatus(document, state.session.currentModuleIndex, "mastered");
    }
  }

  return {
    session: {
      ...state.session,
      document,
      phase: "complete",
      gaps: [],
    },
    reply: [
      `🎓 Course complete: **${state.session.topic}**`,
      feedback ? `\n${feedback}` : "",
      "",
      "You explained each lesson back in your own words — that's real learning.",
      "",
      "Want another course? Tell me a new topic.",
    ]
      .filter(Boolean)
      .join("\n"),
  };
}

async function reset(): Promise<Partial<State>> {
  return {
    session: defaultSession(),
    reply: "Course cancelled. What would you like to learn instead?",
  };
}

function defaultSession(): CourseSession {
  return {
    topic: "",
    modules: [],
    currentModuleIndex: 0,
    phase: "idle",
    lastLesson: "",
    attemptCount: 0,
    gaps: [],
    document: null,
    userNotes: "",
  };
}

async function restart(state: State): Promise<Partial<State>> {
  if (state.userMessage.trim()) {
    return generateCourseDocument({
      ...state,
      session: defaultSession(),
    });
  }

  return {
    session: defaultSession(),
    reply: "What would you like to learn next?",
  };
}

const graph = new StateGraph(GraphState)
  .addNode("promptTopic", promptTopic)
  .addNode("generateCourseDocument", generateCourseDocument)
  .addNode("reviseCourseDocument", reviseCourseDocument)
  .addNode("teach", teach)
  .addNode("nudgeChallenge", nudgeChallenge)
  .addNode("evaluate", evaluate)
  .addNode("reset", reset)
  .addNode("restart", restart)
  .addConditionalEdges(START, pickNode)
  .addEdge("promptTopic", END)
  .addEdge("generateCourseDocument", END)
  .addEdge("reviseCourseDocument", END)
  .addEdge("teach", END)
  .addEdge("nudgeChallenge", END)
  .addEdge("evaluate", END)
  .addEdge("reset", END)
  .addEdge("restart", END)
  .compile();

export async function runFeynmanCourseStep(
  session: CourseSession,
  userMessage: string,
  agentVideos?: unknown[],
  sessionKey?: string,
  options?: { skipVideoDiscovery?: boolean },
): Promise<{ session: CourseSession; reply: string }> {
  const result = await graph.invoke({
    session,
    userMessage,
    reply: "",
    agentVideos,
    sessionKey,
    skipVideoDiscovery: options?.skipVideoDiscovery,
  });

  return {
    session: result.session,
    reply: result.reply,
  };
}

export async function attachVideosToSession(
  session: CourseSession,
  agentVideos: unknown[],
): Promise<CourseSession> {
  const videos = await normalizeAndValidateAgentVideos(agentVideos);
  if (!session.document || videos.length === 0) {
    return session;
  }

  return {
    ...session,
    document: mergeAgentVideos(session.document, videos),
  };
}

export type { CourseModule };
