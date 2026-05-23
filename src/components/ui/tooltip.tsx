import { cn } from "@/lib/utils";

type TooltipProps = {
  content: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
};

export function Tooltip({
  content,
  children,
  className,
  contentClassName,
}: TooltipProps) {
  return (
    <span className={cn("group/tooltip relative inline-flex", className)}>
      {children}
      <span
        role="tooltip"
        className={cn(
          "pointer-events-none absolute bottom-full left-1/2 z-50 mb-1.5 w-max max-w-[min(240px,90vw)] -translate-x-1/2 rounded-md border border-border bg-popover px-2 py-1 text-[10px] leading-snug text-popover-foreground opacity-0 shadow-md transition-opacity group-hover/tooltip:opacity-100 group-focus-within/tooltip:opacity-100",
          contentClassName ?? "break-all",
        )}
      >
        {content}
      </span>
    </span>
  );
}
