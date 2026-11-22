import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export interface SelectProps extends React.ComponentProps<"select"> {
  containerClassName?: string;
}

/**
 * Native select with the shared field styling. Keeping the native element means
 * keyboard behaviour, labels and server-rendered forms keep working unchanged.
 */
const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, containerClassName, children, ...props }, ref) => (
    <div className={cn("relative", containerClassName)}>
      <select
        ref={ref}
        className={cn(
          "flex h-10 w-full appearance-none rounded-field border border-input/90 bg-white/80 py-2 pl-3 pr-9 text-sm text-ink shadow-[inset_0_1px_1px_rgba(32,38,61,0.03)] outline-none ring-offset-canvas transition-all duration-150 ease-premium hover:border-primary/25 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-muted/50 disabled:opacity-60",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
    </div>
  ),
);
Select.displayName = "Select";

export { Select };
