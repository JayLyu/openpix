"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { MODELS } from "@/lib/models";
import { SIZE_PRESETS } from "@/lib/sizes";
import { generateImage } from "@/lib/openrouter";

export default function Home() {
  const [apiKey, setApiKey] = useState("");
  const [keySaved, setKeySaved] = useState(false);
  const [model, setModel] = useState(MODELS[0].id);
  const [size, setSize] = useState(SIZE_PRESETS[0].id);
  const [systemPrompt, setSystemPrompt] = useState("");
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [images, setImages] = useState<string[]>([]);

  useEffect(() => {
    const savedKey = localStorage.getItem("openpix_api_key");
    if (savedKey) {
      setApiKey(savedKey);
      setKeySaved(true);
    }
    const savedSystem = localStorage.getItem("openpix_system_prompt");
    if (savedSystem) setSystemPrompt(savedSystem);
  }, []);

  const saveKey = useCallback(() => {
    const trimmed = apiKey.trim();
    if (trimmed) {
      localStorage.setItem("openpix_api_key", trimmed);
      setKeySaved(true);
    } else {
      localStorage.removeItem("openpix_api_key");
      setKeySaved(false);
    }
  }, [apiKey]);

  const saveSystemPrompt = useCallback(() => {
    const trimmed = systemPrompt.trim();
    if (trimmed) {
      localStorage.setItem("openpix_system_prompt", trimmed);
    } else {
      localStorage.removeItem("openpix_system_prompt");
    }
  }, [systemPrompt]);

  const selectedSize =
    SIZE_PRESETS.find((s) => s.id === size) ?? SIZE_PRESETS[0];

  const generate = async () => {
    if (!apiKey.trim()) {
      setError("请输入 API Key");
      return;
    }
    if (!prompt.trim()) {
      setError("请输入提示词");
      return;
    }

    setLoading(true);
    setError("");
    setImages([]);

    try {
      const data = await generateImage({
        apiKey: apiKey.trim(),
        model,
        prompt: prompt.trim(),
        systemPrompt: systemPrompt.trim() || undefined,
        aspectRatio: selectedSize.aspectRatio,
      });
      setImages(data.images);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "生成失败，请重试");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center px-4 py-16">
      <header className="text-center mb-12">
        <h1 className="text-2xl font-semibold tracking-tight">OpenPix</h1>
        <p className="text-sm text-muted-foreground mt-1">
          通过 OpenRouter 使用 AI 生成图像
        </p>
      </header>

      <main className="w-full max-w-xl space-y-6">
        <div className="space-y-2">
          <Label
            htmlFor="apiKey"
            className="text-xs tracking-wider text-muted-foreground"
          >
            API Key
          </Label>
          <Input
            id="apiKey"
            type="password"
            placeholder="sk-or-..."
            value={apiKey}
            onChange={(e) => {
              setApiKey(e.target.value);
              setKeySaved(false);
            }}
            onBlur={saveKey}
            className="font-mono text-sm"
          />
          {keySaved && (
            <p className="text-xs text-emerald-500">已保存到本地浏览器</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label className="text-xs tracking-wider text-muted-foreground">
              模型
            </Label>
            <Select value={model} onValueChange={(v) => v && setModel(v)}>
              <SelectTrigger className="text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MODELS.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-xs tracking-wider text-muted-foreground">
              尺寸
            </Label>
            <Select value={size} onValueChange={(v) => v && setSize(v)}>
              <SelectTrigger className="text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SIZE_PRESETS.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.label} · {s.platform}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label
            htmlFor="systemPrompt"
            className="text-xs tracking-wider text-muted-foreground"
          >
            系统提示词
            <span className="ml-1 text-muted-foreground/70">（可选）</span>
          </Label>
          <Textarea
            id="systemPrompt"
            placeholder="设定全局风格，例如：扁平插画风格、品牌主色为蓝色、图片中的文字使用中文…"
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            onBlur={saveSystemPrompt}
            className="min-h-[72px] resize-none text-sm"
          />
          <p className="text-xs text-muted-foreground/70">
            用于统一画风、品牌调性或输出规范，留空则仅使用下方提示词。
          </p>
        </div>

        <div className="space-y-2">
          <Label
            htmlFor="prompt"
            className="text-xs tracking-wider text-muted-foreground"
          >
            提示词
          </Label>
          <Textarea
            id="prompt"
            placeholder="描述你想生成的图像…"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="min-h-[100px] resize-none text-sm"
          />
        </div>

        <Button
          onClick={generate}
          disabled={loading}
          className="w-full"
          size="lg"
        >
          {loading ? "生成中…" : "生成图像"}
        </Button>

        {error && (
          <p className="text-sm text-destructive text-center">{error}</p>
        )}

        {images.length > 0 && (
          <div className="space-y-4 pt-4">
            {images.map((src, i) => (
              <div
                key={i}
                className="rounded-lg overflow-hidden border border-border"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt={prompt} className="w-full" />
              </div>
            ))}
          </div>
        )}
      </main>

      <footer className="mt-16 text-xs text-muted-foreground text-center">
        <span>Powered by </span>
        <a
          href="https://openrouter.ai"
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2 hover:text-foreground transition-colors"
        >
          OpenRouter
        </a>
      </footer>
    </div>
  );
}
