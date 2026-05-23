"use client";

import { useId, useState } from "react";
import { createPortal } from "react-dom";
import {
  autoUpdate,
  flip,
  offset,
  shift,
  size as floatingSize,
  useFloating,
} from "@floating-ui/react-dom";
import { cn } from "@/lib/utils";

type TooltipProps = {
  content: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
  contentMaxWidth?: number;
};

export function Tooltip({
  content,
  children,
  className,
  contentClassName,
  contentMaxWidth = 280,
}: TooltipProps) {
  const [open, setOpen] = useState(false);
  const tooltipId = useId();

  const { refs, floatingStyles, isPositioned } = useFloating({
    open,
    placement: "top",
    strategy: "fixed",
    middleware: [
      offset(6),
      flip({
        padding: 8,
        fallbackPlacements: ["bottom", "top", "right", "left"],
      }),
      shift({ padding: 8 }),
      floatingSize({
        padding: 8,
        apply({ availableWidth, elements }) {
          Object.assign(elements.floating.style, {
            maxWidth: `${Math.max(120, Math.min(availableWidth, contentMaxWidth))}px`,
          });
        },
      }),
    ],
    whileElementsMounted: autoUpdate,
  });

  const showTooltip = open && typeof document !== "undefined";

  return (
    <>
      <span
        ref={refs.setReference}
        className={cn("inline-flex", className)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        aria-describedby={open ? tooltipId : undefined}
      >
        {children}
      </span>
      {showTooltip &&
        createPortal(
          <span
            ref={refs.setFloating}
            id={tooltipId}
            role="tooltip"
            style={{
              ...floatingStyles,
              visibility: isPositioned ? "visible" : "hidden",
            }}
            className={cn(
              "z-[100] w-max rounded-md border border-border bg-popover px-2 py-1 text-[10px] leading-snug text-popover-foreground shadow-md",
              contentClassName ?? "break-all",
            )}
          >
            {content}
          </span>,
          document.body,
        )}
    </>
  );
}
