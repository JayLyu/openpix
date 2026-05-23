export const MODELS = [
  {
    id: "openai/gpt-5.4-image-2",
    name: "GPT-5.4 Image 2",
    provider: "OpenAI",
  },
  {
    id: "google/gemini-3.1-flash-image-preview",
    name: "Gemini 3.1 Flash Image",
    provider: "Google",
  },
] as const;

export type Model = (typeof MODELS)[number];
