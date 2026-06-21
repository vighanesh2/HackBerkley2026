export type ListingDraft = {
  title?: string;
  description?: string;
  price?: number;
  category?: string;
};

export type ListingSession = {
  step: "idle" | "title" | "description" | "price" | "category" | "confirm";
  draft: ListingDraft;
};

const sessions = new Map<string, ListingSession>();

function defaultSession(): ListingSession {
  return { step: "idle", draft: {} };
}

export function getSession(sessionId: string): ListingSession {
  return sessions.get(sessionId) ?? defaultSession();
}

export function saveSession(sessionId: string, session: ListingSession): void {
  sessions.set(sessionId, session);
}

export function clearSession(sessionId: string): void {
  sessions.delete(sessionId);
}

export function parsePrice(text: string): number | null {
  const match = text.replace(/,/g, "").match(/\$?\s*(\d+(?:\.\d{1,2})?)/);
  if (!match) return null;
  return Number.parseFloat(match[1]);
}

export function normalizeMessage(text: string): string {
  return text
    .trim()
    .replace(/^@\S+\s*/, "")
    .replace(/\s+@\S+\s*/g, " ")
    .trim();
}

function isAffirmative(text: string): boolean {
  const lower = normalizeMessage(text).toLowerCase();
  if (["yes", "y", "confirm", "post", "post it", "yeah", "yep", "sure", "ok", "okay"].includes(lower)) {
    return true;
  }
  return lower.split(/\s+/).some((w) => ["yes", "y", "yeah", "yep", "sure", "confirm", "post"].includes(w));
}

function isNegative(text: string): boolean {
  const lower = normalizeMessage(text).toLowerCase();
  if (["no", "n", "cancel", "stop", "nope"].includes(lower)) {
    return true;
  }
  return lower.split(/\s+/).some((w) => ["no", "n", "cancel", "nope", "stop"].includes(w));
}

export function wantsToList(text: string): boolean {
  const normalized = text.toLowerCase();
  return (
    normalized.includes("sell") ||
    normalized.includes("list") ||
    normalized.includes("post") ||
    normalized.includes("marketplace")
  );
}

export function buildSummary(draft: ListingDraft): string {
  return [
    "Here's your listing:",
    `Title: ${draft.title}`,
    `Description: ${draft.description}`,
    `Price: $${draft.price}`,
    `Category: ${draft.category}`,
    "",
    'Reply "yes" to post or "no" to cancel.',
  ].join("\n");
}

export function processListingMessage(
  sessionId: string,
  message: string,
): { reply: string; readyToPost: boolean; draft?: ListingDraft } {
  const text = normalizeMessage(message);
  const lower = text.toLowerCase();
  const session = getSession(sessionId);

  if (session.step === "confirm") {
    if (isAffirmative(message)) {
      const draft = session.draft as Required<ListingDraft>;
      clearSession(sessionId);
      return {
        reply: "Publishing your listing...",
        readyToPost: true,
        draft,
      };
    }

    if (isNegative(message)) {
      clearSession(sessionId);
      return {
        reply: "Listing cancelled. Tell me what you'd like to sell whenever you're ready.",
        readyToPost: false,
      };
    }

    return {
      reply: 'Please reply "yes" to post or "no" to cancel.',
      readyToPost: false,
    };
  }

  if (session.step === "idle") {
    if (!wantsToList(text)) {
      return {
        reply:
          'What would you like me to sell? Describe the item and price — e.g. "my desk for $80".',
        readyToPost: false,
      };
    }

    const price = parsePrice(text);
    if (price !== null && text.length > 12) {
      session.draft = {
        title: text.split(" for ")[0]?.replace(/^sell\s+/i, "").trim() || text,
        price,
      };
      session.step = "description";
      saveSession(sessionId, session);
      return {
        reply: "Got the title and price. What description should buyers see?",
        readyToPost: false,
      };
    }

    session.step = "title";
    saveSession(sessionId, session);
    return {
      reply: "What would you like me to sell?",
      readyToPost: false,
    };
  }

  if (session.step === "title") {
    session.draft.title = text;
    session.step = "description";
    saveSession(sessionId, session);
    return {
      reply: "Great. Now give me a short description for buyers.",
      readyToPost: false,
    };
  }

  if (session.step === "description") {
    session.draft.description = text;
    session.step = "price";
    saveSession(sessionId, session);
    return {
      reply: "What price should I list it for? (e.g. 120 or $120)",
      readyToPost: false,
    };
  }

  if (session.step === "price") {
    const price = parsePrice(text);
    if (price === null) {
      return {
        reply: "I couldn't read that price. Please send a number like 75 or $75.",
        readyToPost: false,
      };
    }

    session.draft.price = price;
    session.step = "category";
    saveSession(sessionId, session);
    return {
      reply: "Almost done. What category fits best? (e.g. Electronics, Furniture, Clothing)",
      readyToPost: false,
    };
  }

  if (session.step === "category") {
    session.draft.category = text;
    session.step = "confirm";
    saveSession(sessionId, session);
    return {
      reply: buildSummary(session.draft),
      readyToPost: false,
    };
  }

  return {
    reply: "Tell me what you'd like to sell to start a new listing.",
    readyToPost: false,
  };
}
