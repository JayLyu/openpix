export const MODELS = [
  { id: "openai/gpt-image-2", name: "GPT Image 2", provider: "OpenAI" },
] as const;

export type Model = (typeof MODELS)[number];
