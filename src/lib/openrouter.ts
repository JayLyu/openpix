const OPENROUTER_API = "https://openrouter.ai/api/v1";

export const MODELS = [
  { id: "openai/gpt-image-2", name: "GPT Image 2", provider: "OpenAI" },
] as const;

export type Model = (typeof MODELS)[number];

export async function generateImage(opts: {
  apiKey: string;
  model: string;
  prompt: string;
  size?: string;
  n?: number;
}) {
  const res = await fetch(`${OPENROUTER_API}/images/generations`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${opts.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: opts.model,
      prompt: opts.prompt,
      n: opts.n || 1,
      ...(opts.size ? { size: opts.size } : {}),
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message || "Generation failed");
  }
  return data;
}
