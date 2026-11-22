import * as React from "react";
import { cn } from "@/lib/utils/cn";

const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<"textarea">>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        "flex min-h-28 w-full rounded-field border border-input/90 bg-white/80 px-3 py-2.5 text-sm leading-relaxed text-ink shadow-[inset_0_1px_1px_rgba(32,38,61,0.03)] outline-none ring-offset-canvas transition-all duration-150 ease-premium placeholder:text-muted-foreground hover:border-primary/25 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-muted/50 disabled:opacity-60",
        className,
      )}
      {...props}
    />
  ),
);
Textarea.displayName = "Textarea";

export { Textarea };
