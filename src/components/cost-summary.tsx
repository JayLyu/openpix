import { Tooltip } from "@/components/ui/tooltip";
import {
  formatCostCny,
  formatUsdCnyRate,
  type UsdCnyRateSource,
} from "@/lib/exchange-rate";
import { formatCostUsd, type TaskUsage } from "@/lib/pricing";

type CostSummaryProps = {
  usage: TaskUsage;
  usdCnyRate: number;
  rateSource: UsdCnyRateSource;
};

function formatCostLabel(usage: TaskUsage): string {
  const usd = formatCostUsd(usage.costUsd);
  return usage.costSource === "api" ? usd : `≈ ${usd}`;
}

export function CostSummary({
  usage,
  usdCnyRate,
  rateSource,
}: CostSummaryProps) {
  const costLabel = formatCostLabel(usage);
  const cnyLabel = formatCostCny(usage.costUsd, usdCnyRate);
  const rateLabel = formatUsdCnyRate(usdCnyRate);
  const rateHint =
    rateSource === "default"
      ? "默认汇率"
      : rateSource === "cache"
        ? "缓存汇率"
        : "参考汇率";

  return (
    <Tooltip
      content={
        <>
          <span className="block font-medium text-foreground">
            {usage.costSource === "estimated" ? "≈ " : ""}
            {cnyLabel}
          </span>
          <span className="mt-0.5 block text-muted-foreground">
            汇率 1 USD = {rateLabel} CNY（{rateHint}）
          </span>
        </>
      }
      contentClassName="whitespace-normal text-left break-words"
    >
      <span className="cursor-default underline decoration-dotted decoration-muted-foreground/50 underline-offset-2">
        成本 {costLabel}
      </span>
    </Tooltip>
  );
}
