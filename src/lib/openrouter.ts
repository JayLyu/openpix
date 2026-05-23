const OPENROUTER_API = "https://openrouter.ai/api/v1";

type ChatMessage = {
  role: "system" | "user";
  content: string;
};

type ImageUrlPart = {
  image_url?: { url?: string };
};

type ChatCompletionResponse = {
  error?: { message?: string };
  choices?: Array<{
    message?: {
      images?: ImageUrlPart[];
    };
  }>;
};

export async function generateImage(opts: {
  apiKey: string;
  model: string;
  prompt: string;
  systemPrompt?: string;
  aspectRatio?: string;
}): Promise<{ images: string[] }> {
  const messages: ChatMessage[] = [];

  if (opts.systemPrompt?.trim()) {
    messages.push({ role: "system", content: opts.systemPrompt.trim() });
  }
  messages.push({ role: "user", content: opts.prompt });

  const body: Record<string, unknown> = {
    model: opts.model,
    messages,
    modalities: ["image", "text"],
  };

  if (opts.aspectRatio) {
    body.image_config = { aspect_ratio: opts.aspectRatio };
  }

  const res = await fetch(`${OPENROUTER_API}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${opts.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = (await res.json()) as ChatCompletionResponse;
  if (!res.ok) {
    throw new Error(data.error?.message || "生成失败");
  }

  const images: string[] = [];
  const messageImages = data.choices?.[0]?.message?.images;
  if (messageImages) {
    for (const image of messageImages) {
      const url = image.image_url?.url;
      if (url) images.push(url);
    }
  }

  if (images.length === 0) {
    throw new Error("未返回图像，请检查模型或提示词");
  }

  return { images };
}
