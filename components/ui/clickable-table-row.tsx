"use client";

import { useRouter } from "next/navigation";
import type { ComponentPropsWithoutRef, MouseEvent } from "react";
import { TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils/cn";

const INTERACTIVE_SELECTOR = 'a, button, input, select, textarea, [role="button"]';

type ClickableTableRowProps = ComponentPropsWithoutRef<typeof TableRow> & {
  href: string;
};

export function ClickableTableRow({ href, className, onClick, ...props }: ClickableTableRowProps) {
  const router = useRouter();

  function handleClick(event: MouseEvent<HTMLTableRowElement>) {
    onClick?.(event);

    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    const target = event.target;
    if (target instanceof Element && target.closest(INTERACTIVE_SELECTOR)) return;

    router.push(href);
  }

  return <TableRow onClick={handleClick} className={cn("cursor-pointer", className)} {...props} />;
}
