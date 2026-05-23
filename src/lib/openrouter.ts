import { parseTaskUsage, type TaskUsage } from "@/lib/pricing";

const OPENROUTER_API = "https://openrouter.ai/api/v1";

type TextPart = { type: "text"; text: string };
type ImagePart = { type: "image_url"; image_url: { url: string } };
type ContentPart = TextPart | ImagePart;

type ChatMessage = {
  role: "system" | "user";
  content: string | ContentPart[];
};

type ImageUrlPart = {
  image_url?: { url?: string };
};

type ChatCompletionResponse = {
  error?: { message?: string; code?: number };
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    cost?: number;
    prompt_tokens_details?: {
      cached_tokens?: number;
    };
    completion_tokens_details?: {
      image_tokens?: number;
      reasoning_tokens?: number;
    };
  };
  choices?: Array<{
    message?: {
      images?: ImageUrlPart[];
    };
  }>;
};

export function validateOpenRouterApiKey(apiKey: string): string | null {
  const key = apiKey.trim();
  if (!key) return "请输入 API Key";
  if (!key.startsWith("sk-or-")) {
    return "API Key 格式不正确，请使用 OpenRouter 密钥（以 sk-or- 开头，可在 openrouter.ai/keys 创建）";
  }
  return null;
}

function buildHeaders(apiKey: string): HeadersInit {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey.trim()}`,
    "Content-Type": "application/json",
  };

  if (typeof window !== "undefined") {
    headers["HTTP-Referer"] = window.location.origin;
    headers["X-Title"] = "OpenPix";
  }

  return headers;
}

function parseApiError(status: number, message?: string): string {
  if (status === 401) {
    return "API Key 无效或账户未找到，请前往 openrouter.ai/keys 重新创建并粘贴密钥";
  }
  if (status === 402) {
    return "OpenRouter 账户余额不足，请先充值后再试";
  }
  if (status === 403) {
    return "无权访问该模型，请检查 OpenRouter 账户权限";
  }
  return message || `请求失败（${status}）`;
}

function buildUserContent(
  prompt: string,
  referenceImages?: string[],
): string | ContentPart[] {
  const images = referenceImages?.filter(Boolean) ?? [];
  if (images.length === 0) return prompt;

  return [
    ...images.map(
      (url): ImagePart => ({ type: "image_url", image_url: { url } }),
    ),
    { type: "text", text: prompt },
  ];
}

export async function generateImage(opts: {
  apiKey: string;
  model: string;
  prompt: string;
  systemPrompt?: string;
  aspectRatio?: string;
  referenceImages?: string[];
}): Promise<{ images: string[]; usage?: TaskUsage }> {
  const keyError = validateOpenRouterApiKey(opts.apiKey);
  if (keyError) throw new Error(keyError);

  const messages: ChatMessage[] = [];

  if (opts.systemPrompt?.trim()) {
    messages.push({ role: "system", content: opts.systemPrompt.trim() });
  }
  messages.push({
    role: "user",
    content: buildUserContent(opts.prompt, opts.referenceImages),
  });

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
    headers: buildHeaders(opts.apiKey),
    body: JSON.stringify(body),
  });

  let data: ChatCompletionResponse = {};
  try {
    data = (await res.json()) as ChatCompletionResponse;
  } catch {
    if (!res.ok) {
      throw new Error(parseApiError(res.status));
    }
  }

  if (!res.ok) {
    throw new Error(parseApiError(res.status, data.error?.message));
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

  return {
    images,
    usage: parseTaskUsage(opts.model, data.usage),
  };
}
