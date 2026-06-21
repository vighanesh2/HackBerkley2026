import type { BenchmarkSession } from "./types.js";

export const benchmarkSessions: BenchmarkSession[] = [
  {
    id: "photosynthesis-foundations",
    topic: "Photosynthesis for high-school biology",
    currentUserTurn: "Build a short course that helps me explain photosynthesis using the Feynman technique.",
    retrievedChunks: [
      {
        id: "photo-1",
        content:
          "Photosynthesis converts light energy into chemical energy stored in glucose. In plants, this process occurs primarily in chloroplasts. Chlorophyll pigments absorb light, especially red and blue wavelengths, while reflecting green light. The overall process includes light-dependent reactions and the Calvin cycle.",
        sourceTitle: "Biology Notes",
      },
      {
        id: "photo-2",
        content:
          "The light-dependent reactions split water molecules and release oxygen as a byproduct. These reactions produce ATP and NADPH, which provide energy and reducing power for the Calvin cycle. The Calvin cycle fixes carbon dioxide into sugars through enzyme-driven steps.",
        sourceTitle: "Biology Notes",
      },
    ],
    conversationHistory: [
      {
        role: "user",
        content: "I always confuse respiration and photosynthesis.",
      },
      {
        role: "assistant",
        content:
          "A useful contrast is that photosynthesis stores energy in glucose, while cellular respiration releases energy from glucose.",
      },
    ],
    carriedCourseContext:
      "The learner benefits from simple analogies and should be asked to explain each stage in plain language before moving on.",
    expectedCourseFocus: ["chloroplasts", "light-dependent reactions", "Calvin cycle", "oxygen byproduct"],
  },
  {
    id: "newton-laws-intro",
    topic: "Newton's laws for an intro physics learner",
    currentUserTurn: "Create a module that makes Newton's three laws intuitive and question-driven.",
    retrievedChunks: [
      {
        id: "newton-1",
        content:
          "Newton's first law states that an object remains at rest or in uniform motion unless acted on by a net external force. This principle is often called inertia. It explains why a moving object does not need a continuous force to keep moving in an ideal frictionless environment.",
        sourceTitle: "Physics Primer",
      },
      {
        id: "newton-2",
        content:
          "Newton's second law relates net force, mass, and acceleration through F = ma. Greater force produces greater acceleration, while greater mass resists acceleration. Newton's third law states that every action has an equal and opposite reaction.",
        sourceTitle: "Physics Primer",
      },
    ],
    conversationHistory: [
      {
        role: "user",
        content: "I think heavier objects always fall faster.",
      },
      {
        role: "assistant",
        content:
          "That intuition usually comes from air resistance. In the basic model, gravity accelerates objects equally regardless of mass.",
      },
    ],
    carriedCourseContext:
      "The course should challenge common misconceptions and ask the learner to predict everyday examples before revealing the principle.",
    expectedCourseFocus: ["inertia", "net force", "F = ma", "action and reaction"],
  },
  {
    id: "supply-demand-basics",
    topic: "Supply and demand for a beginner economics course",
    currentUserTurn: "Generate a beginner lesson that uses Feynman questions to teach supply and demand.",
    retrievedChunks: [
      {
        id: "econ-1",
        content:
          "Demand describes how much of a good consumers are willing and able to buy at different prices. Supply describes how much producers are willing and able to sell at different prices. Equilibrium is the price and quantity where supply and demand meet.",
        sourceTitle: "Economics Basics",
      },
      {
        id: "econ-2",
        content:
          "When demand increases while supply stays constant, equilibrium price usually rises. When supply increases while demand stays constant, equilibrium price usually falls. Shifts are different from movements along a curve, which happen because of price changes.",
        sourceTitle: "Economics Basics",
      },
    ],
    conversationHistory: [
      {
        role: "user",
        content: "I understand price changes, but not curve shifts.",
      },
      {
        role: "assistant",
        content:
          "A movement along a curve is caused by price itself. A shift happens when another factor changes willingness to buy or sell at every price.",
      },
    ],
    carriedCourseContext:
      "Use concrete examples like concert tickets, coffee shops, or used laptops. Avoid advanced math.",
    expectedCourseFocus: ["demand", "supply", "equilibrium", "curve shifts"],
  },
  {
    id: "binary-search",
    topic: "Binary search for a new programmer",
    currentUserTurn: "Make a concise course module on binary search with checks for understanding.",
    retrievedChunks: [
      {
        id: "algo-1",
        content:
          "Binary search finds a target value in a sorted collection by repeatedly checking the middle element and discarding the half that cannot contain the target. The algorithm requires sorted input. Its time complexity is O(log n).",
        sourceTitle: "Algorithms Handbook",
      },
      {
        id: "algo-2",
        content:
          "Common binary search mistakes include off-by-one errors, incorrect loop conditions, and failing to update the low or high boundary. A correct implementation maintains an invariant about the range where the target can still exist.",
        sourceTitle: "Algorithms Handbook",
      },
    ],
    conversationHistory: [
      {
        role: "user",
        content: "I get linear search but do not see why binary search is faster.",
      },
      {
        role: "assistant",
        content:
          "Linear search removes one candidate at a time. Binary search removes about half the remaining candidates each step.",
      },
    ],
    carriedCourseContext:
      "The learner should trace arrays by hand and explain why sorted input is required.",
    expectedCourseFocus: ["sorted input", "middle element", "discard half", "O(log n)"],
  },
  {
    id: "french-revolution",
    topic: "French Revolution overview for a history course",
    currentUserTurn: "Create a grounded mini-course about causes and consequences of the French Revolution.",
    retrievedChunks: [
      {
        id: "history-1",
        content:
          "The French Revolution began in 1789 amid financial crisis, social inequality, food shortages, and political conflict over royal authority. The Estates-General and the formation of the National Assembly were early turning points.",
        sourceTitle: "World History Reader",
      },
      {
        id: "history-2",
        content:
          "The revolution led to the Declaration of the Rights of Man and of the Citizen, the end of absolute monarchy, the Reign of Terror, and eventually the rise of Napoleon. Its ideals influenced later democratic movements.",
        sourceTitle: "World History Reader",
      },
    ],
    conversationHistory: [
      {
        role: "user",
        content: "I mix up the causes with the events that happened after 1789.",
      },
      {
        role: "assistant",
        content:
          "A clean timeline can separate background causes, early revolutionary events, radicalization, and long-term consequences.",
      },
    ],
    carriedCourseContext:
      "The learner needs timeline structure and should be asked to explain cause versus consequence.",
    expectedCourseFocus: ["1789", "National Assembly", "Declaration of Rights", "Reign of Terror", "Napoleon"],
  },
];

