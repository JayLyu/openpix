"use client";

import { CircleCheck, CircleHelp, Key } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type ApiKeyHeaderProps = {
  apiKey: string;
  onApiKeyChange: (value: string) => void;
  onKeySavedChange: (saved: boolean) => void;
  onBlurSave: () => void;
  keySaved: boolean;
  onClear: () => void;
};

function ApiKeyHelpContent() {
  return (
    <>
      <p className="font-medium text-foreground">
        密钥仅保存在本机浏览器缓存（localStorage），不会上传到 OpenPix
        或任何服务器。
      </p>
      <p className="mt-2 text-muted-foreground">
        请使用 OpenRouter 密钥（sk-or-…），在{" "}
        <a
          href="https://openrouter.ai/keys"
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2 hover:text-foreground"
        >
          openrouter.ai/keys
        </a>{" "}
        创建，不支持 OpenAI 官方密钥。
      </p>
    </>
  );
}

function ApiKeyField({
  id,
  apiKey,
  onApiKeyChange,
  onKeySavedChange,
  onBlurSave,
  keySaved,
  className,
}: {
  id: string;
  apiKey: string;
  onApiKeyChange: (value: string) => void;
  onKeySavedChange: (saved: boolean) => void;
  onBlurSave: () => void;
  keySaved: boolean;
  className?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      <Input
        id={id}
        type="password"
        placeholder="sk-or-..."
        value={apiKey}
        onChange={(event) => {
          onApiKeyChange(event.target.value);
          onKeySavedChange(false);
        }}
        onBlur={onBlurSave}
        className="font-mono text-sm pr-8"
      />
      {keySaved && apiKey.trim() && (
        <CircleCheck
          className="pointer-events-none absolute right-2 top-1/2 size-4 -translate-y-1/2 text-emerald-500"
          aria-label="已写入浏览器本地缓存"
        />
      )}
    </div>
  );
}

export function ApiKeyHeader({
  apiKey,
  onApiKeyChange,
  onKeySavedChange,
  onBlurSave,
  keySaved,
  onClear,
}: ApiKeyHeaderProps) {
  const hasKey = Boolean(apiKey.trim());

  return (
    <>
      <div className="hidden items-center gap-3 lg:flex">
        <div className="inline-flex shrink-0 items-baseline gap-1 text-sm text-muted-foreground">
          <span>API KEY</span>
          <div className="relative group leading-none">
            <button
              type="button"
              className="inline-flex translate-y-[0.5px] rounded-sm text-muted-foreground transition-colors hover:text-foreground"
              aria-label="API KEY 说明"
            >
              <CircleHelp className="size-3.5" />
            </button>
            <div
              role="tooltip"
              className="pointer-events-none absolute right-0 top-full z-50 mt-2 w-80 rounded-lg border border-border bg-popover p-3 text-xs leading-relaxed text-popover-foreground opacity-0 shadow-md transition-opacity group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100"
            >
              <ApiKeyHelpContent />
              {(keySaved || hasKey) && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-3 h-7 w-full text-xs"
                  onClick={onClear}
                >
                  清除本地缓存
                </Button>
              )}
            </div>
          </div>
        </div>
        <ApiKeyField
          id="apiKey"
          apiKey={apiKey}
          onApiKeyChange={onApiKeyChange}
          onKeySavedChange={onKeySavedChange}
          onBlurSave={onBlurSave}
          keySaved={keySaved}
          className="w-44 sm:w-56"
        />
      </div>

      <Popover>
        <PopoverTrigger
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "lg:hidden shrink-0 gap-1.5 px-2.5",
          )}
          aria-label="设置 API KEY"
        >
          <Key className="size-4 shrink-0" aria-hidden />
          <span className="text-xs">密钥</span>
          {keySaved && hasKey && (
            <CircleCheck
              className="size-3.5 shrink-0 text-emerald-500"
              aria-hidden
            />
          )}
        </PopoverTrigger>
        <PopoverContent
          align="end"
          side="bottom"
          sideOffset={8}
          className="w-[min(18rem,calc(100vw-1.5rem))] gap-3 p-4 lg:hidden"
        >
          <PopoverHeader className="gap-2">
            <PopoverTitle>API KEY</PopoverTitle>
            <div className="text-xs leading-relaxed text-muted-foreground">
              <ApiKeyHelpContent />
            </div>
          </PopoverHeader>
          <ApiKeyField
            id="apiKey-mobile"
            apiKey={apiKey}
            onApiKeyChange={onApiKeyChange}
            onKeySavedChange={onKeySavedChange}
            onBlurSave={onBlurSave}
            keySaved={keySaved}
          />
          {(keySaved || hasKey) && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 w-full text-xs"
              onClick={onClear}
            >
              清除本地缓存
            </Button>
          )}
        </PopoverContent>
      </Popover>
    </>
  );
}
