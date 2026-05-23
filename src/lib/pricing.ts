export type TaskUsage = {
  promptTokens: number;
  completionTokens: number;
  cachedTokens: number;
  imageOutputTokens: number;
  costUsd: number;
  costSource: "api" | "estimated";
};

type UsageDetails = {
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

type ModelPricing = {
  inputPerMTokens: number;
  outputPerMTokens: number;
  cacheReadPerMTokens?: number;
  imageOutputPerMTokens?: number;
};

const MODEL_PRICING: Record<string, ModelPricing> = {
  "openai/gpt-5.4-image-2": {
    inputPerMTokens: 8,
    outputPerMTokens: 15,
    cacheReadPerMTokens: 2,
    imageOutputPerMTokens: 30,
  },
  "google/gemini-3.1-flash-image-preview": {
    inputPerMTokens: 0.5,
    outputPerMTokens: 3,
  },
};

function estimateCostUsd(modelId: string, usage: UsageDetails): number {
  const pricing = MODEL_PRICING[modelId];
  if (!pricing) return 0;

  const promptTokens = usage.prompt_tokens ?? 0;
  const completionTokens = usage.completion_tokens ?? 0;
  const cachedTokens = usage.prompt_tokens_details?.cached_tokens ?? 0;
  const imageOutputTokens =
    usage.completion_tokens_details?.image_tokens ?? 0;
  const reasoningTokens =
    usage.completion_tokens_details?.reasoning_tokens ?? 0;

  const billableInput = Math.max(0, promptTokens - cachedTokens);
  const textOutputTokens = Math.max(
    0,
    completionTokens - imageOutputTokens - reasoningTokens,
  );

  let cost = 0;
  cost += (billableInput * pricing.inputPerMTokens) / 1_000_000;

  if (pricing.cacheReadPerMTokens) {
    cost += (cachedTokens * pricing.cacheReadPerMTokens) / 1_000_000;
  }

  if (pricing.imageOutputPerMTokens) {
    if (imageOutputTokens > 0) {
      cost += (imageOutputTokens * pricing.imageOutputPerMTokens) / 1_000_000;
      cost += (textOutputTokens * pricing.outputPerMTokens) / 1_000_000;
    } else if (completionTokens > 0) {
      // 图像模型未返回 image_tokens 明细时，按图像输出价估算
      cost +=
        (completionTokens * pricing.imageOutputPerMTokens) / 1_000_000;
    }
  } else {
    cost += (completionTokens * pricing.outputPerMTokens) / 1_000_000;
  }

  return cost;
}

export function parseTaskUsage(
  modelId: string,
  usage?: UsageDetails | null,
): TaskUsage | undefined {
  if (!usage) return undefined;

  const promptTokens = usage.prompt_tokens ?? 0;
  const completionTokens = usage.completion_tokens ?? 0;
  const cachedTokens = usage.prompt_tokens_details?.cached_tokens ?? 0;
  const imageOutputTokens =
    usage.completion_tokens_details?.image_tokens ?? 0;

  if (usage.cost != null && usage.cost > 0) {
    return {
      promptTokens,
      completionTokens,
      cachedTokens,
      imageOutputTokens,
      costUsd: usage.cost,
      costSource: "api",
    };
  }

  const estimated = estimateCostUsd(modelId, usage);
  if (promptTokens === 0 && completionTokens === 0 && estimated === 0) {
    return undefined;
  }

  return {
    promptTokens,
    completionTokens,
    cachedTokens,
    imageOutputTokens,
    costUsd: estimated,
    costSource: "estimated",
  };
}

export function splitUsageCost(
  usage: TaskUsage,
  imageCount: number,
): TaskUsage {
  if (imageCount <= 1) return usage;
  return {
    ...usage,
    costUsd: usage.costUsd / imageCount,
  };
}

export function formatCostUsd(usd: number): string {
  if (usd >= 0.01) return `$${usd.toFixed(4)}`;
  if (usd >= 0.001) return `$${usd.toFixed(5)}`;
  return `$${usd.toFixed(6)}`;
}

export function formatUsageSummary(usage: TaskUsage): string {
  const costLabel =
    usage.costSource === "api" ? formatCostUsd(usage.costUsd) : `≈ ${formatCostUsd(usage.costUsd)}`;
  return `成本 ${costLabel}`;
}
