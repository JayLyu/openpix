"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "openpix_theme";

type Theme = "light" | "dark";

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    const initial: Theme = stored === "light" ? "light" : "dark";
    setTheme(initial);
    applyTheme(initial);
    setMounted(true);
  }, []);

  const toggleTheme = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    applyTheme(next);
    localStorage.setItem(STORAGE_KEY, next);
  };

  return (
    <button
      type="button"
      role="switch"
      aria-checked={theme === "dark"}
      aria-label={theme === "dark" ? "切换到浅色模式" : "切换到深色模式"}
      disabled={!mounted}
      onClick={toggleTheme}
      className={cn(
        "relative inline-flex h-7 w-[3.25rem] shrink-0 rounded-full border border-border bg-muted p-0.5 transition-colors",
        "hover:bg-muted/80 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
        "disabled:opacity-100",
      )}
    >
      <Sun
        className={cn(
          "pointer-events-none absolute left-1.5 top-1/2 size-3 -translate-y-1/2 transition-colors",
          theme === "light" ? "text-foreground" : "text-muted-foreground/45",
        )}
        aria-hidden
      />
      <Moon
        className={cn(
          "pointer-events-none absolute right-1.5 top-1/2 size-3 -translate-y-1/2 transition-colors",
          theme === "dark" ? "text-foreground" : "text-muted-foreground/45",
        )}
        aria-hidden
      />
      <span
        className={cn(
          "pointer-events-none block size-6 rounded-full bg-background shadow-sm ring-1 ring-border/60 transition-transform duration-200 ease-out",
          theme === "dark" ? "translate-x-6" : "translate-x-0",
        )}
        aria-hidden
      />
    </button>
  );
}
