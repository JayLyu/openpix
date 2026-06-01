"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Tooltip } from "@/components/ui/tooltip";
import { checkOpenRouterConnectivity } from "@/lib/openrouter";
import { cn } from "@/lib/utils";

type Status = "checking" | "online" | "offline";

const CHECK_INTERVAL_MS = 60_000;

export function OpenRouterStatus({
  hideLabelOnMobile = false,
}: {
  hideLabelOnMobile?: boolean;
}) {
  const [status, setStatus] = useState<Status>("checking");
  const [detail, setDetail] = useState("正在检测 OpenRouter 连接…");

  const runCheck = useCallback(async () => {
    setStatus("checking");
    setDetail("正在检测 OpenRouter 连接…");
    const result = await checkOpenRouterConnectivity();
    setStatus(result.ok ? "online" : "offline");
    setDetail(result.message);
  }, []);

  useEffect(() => {
    void runCheck();
    const timer = setInterval(() => void runCheck(), CHECK_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [runCheck]);

  const statusLabel =
    status === "checking"
      ? "检测中"
      : status === "online"
        ? "已联通"
        : "未联通";

  return (
    <Tooltip
      content={
        <>
          <span className="block">{detail}</span>
          <span className="mt-0.5 block text-muted-foreground">
            点击重新检测
          </span>
        </>
      }
      contentClassName="whitespace-normal text-left"
    >
      <button
        type="button"
        onClick={() => void runCheck()}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-sm text-sm text-muted-foreground transition-colors hover:text-foreground"
        aria-label={`OpenRouter ${statusLabel}`}
      >
        <span className={cn(hideLabelOnMobile && "hidden sm:inline")}>
          OpenRouter
        </span>
        {status === "checking" ? (
          <Loader2 className="size-3 animate-spin" aria-hidden />
        ) : (
          <span
            className={cn(
              "size-2 rounded-full",
              status === "online" ? "bg-emerald-500" : "bg-destructive",
            )}
            aria-hidden
          />
        )}
      </button>
    </Tooltip>
  );
}
