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
import { generateImage } from "@/lib/openrouter";

const SIZES = ["1024x1024", "1024x1536", "1536x1024"] as const;

export default function Home() {
  const [apiKey, setApiKey] = useState("");
  const [keySaved, setKeySaved] = useState(false);
  const [model, setModel] = useState(MODELS[0].id);
  const [size, setSize] = useState("1024x1024");
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [images, setImages] = useState<string[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem("openpix_api_key");
    if (saved) {
      setApiKey(saved);
      setKeySaved(true);
    }
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

  const generate = async () => {
    if (!apiKey.trim()) {
      setError("Please enter your API key");
      return;
    }
    if (!prompt.trim()) {
      setError("Please enter a prompt");
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
        size,
        n: 1,
      });

      const urls: string[] = [];
      if (data.data) {
        for (const item of data.data) {
          if (item.url) urls.push(item.url);
          else if (item.b64_json)
            urls.push(`data:image/png;base64,${item.b64_json}`);
        }
      }
      setImages(urls);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center px-4 py-16">
      <header className="text-center mb-12">
        <h1 className="text-2xl font-semibold tracking-tight">OpenPix</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Generate images with AI via OpenRouter
        </p>
      </header>

      <main className="w-full max-w-xl space-y-6">
        <div className="space-y-2">
          <Label
            htmlFor="apiKey"
            className="text-xs uppercase tracking-wider text-muted-foreground"
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
            <p className="text-xs text-emerald-500">Saved to local storage</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
              Model
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
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
              Size
            </Label>
            <Select value={size} onValueChange={(v) => v && setSize(v)}>
              <SelectTrigger className="text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SIZES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label
            htmlFor="prompt"
            className="text-xs uppercase tracking-wider text-muted-foreground"
          >
            Prompt
          </Label>
          <Textarea
            id="prompt"
            placeholder="Describe the image you want to generate..."
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
          {loading ? "Generating..." : "Generate"}
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

      <footer className="mt-16 text-xs text-muted-foreground text-center space-x-2">
        <span>Powered by</span>
        <a
          href="https://openrouter.ai"
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2 hover:text-foreground transition-colors"
        >
          OpenRouter
        </a>
        <span>·</span>
        <a
          href="https://github.com/JayLyu/openpix"
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2 hover:text-foreground transition-colors"
        >
          GitHub
        </a>
      </footer>
    </div>
  );
}
