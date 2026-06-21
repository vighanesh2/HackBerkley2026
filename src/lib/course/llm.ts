import { ChatOpenAI } from "@langchain/openai";

export function getCourseModel() {
  const apiKey = process.env.ASI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("ASI_API_KEY is not configured");
  }

  return new ChatOpenAI({
    model: "asi1-mini",
    apiKey,
    configuration: {
      baseURL: "https://api.asi1.ai/v1",
    },
    temperature: 0.4,
  });
}

export function isLlmConfigured(): boolean {
  return Boolean(process.env.ASI_API_KEY?.trim());
}
