import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils/cn";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[11px] font-semibold leading-4 tracking-[0.01em] transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-primary/[0.15] bg-primary/10 text-primary",
        secondary: "border-slate-200/80 bg-slate-100/80 text-slate-600",
        destructive: "border-destructive/20 bg-destructive/10 text-destructive",
        success: "border-success/20 bg-success/10 text-success",
        warning: "border-warning/25 bg-warning/[0.15] text-[#7d5410]",
        outline: "border-border bg-white/60 text-muted-foreground",
        brand: "border-transparent bg-brand-gradient text-white shadow-glow",
        iris: "border-iris/20 bg-iris/10 text-iris",
        aqua: "border-aqua/20 bg-aqua/10 text-aqua",
        indigo: "border-primary/[0.15] bg-primary/10 text-primary",
        violet: "border-iris/20 bg-iris/10 text-iris",
        teal: "border-aqua/20 bg-aqua/10 text-aqua",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
