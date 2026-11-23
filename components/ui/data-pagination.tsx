import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { buttonVariants } from "@/components/ui/button";

type QueryValue = string | number | boolean | undefined | null;

function buildHref(basePath: string, page: number, query: Record<string, QueryValue>): string {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "" || key === "page") continue;
    params.set(key, String(value));
  }

  params.set("page", String(page));

  return `${basePath}?${params.toString()}`;
}

function pageWindow(page: number, totalPages: number): number[] {
  const start = Math.max(1, Math.min(page - 2, totalPages - 4));
  const end = Math.min(totalPages, start + 4);
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

export function DataPagination({
  page,
  limit,
  total,
  totalPages,
  basePath,
  query = {},
}: {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  basePath: string;
  query?: Record<string, QueryValue>;
}) {
  if (totalPages <= 1) return null;

  const pages = pageWindow(page, totalPages);
  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  return (
    <nav
      aria-label="Пагинация"
      className="flex flex-col items-start justify-between gap-3 border-t border-border/70 px-4 py-3 sm:flex-row sm:items-center sm:px-5"
    >
      <p className="text-xs text-muted-foreground">
        Строка {from}–{to} из {total}
        <span className="mx-2 text-muted-foreground">·</span>
        Страница {page} из {totalPages}
      </p>

      <div className="flex items-center gap-1">
        <Link
          href={buildHref(basePath, Math.max(1, page - 1), query)}
          aria-disabled={page <= 1}
          aria-label="Предыдущая страница"
          tabIndex={page <= 1 ? -1 : undefined}
          className={cn(
            buttonVariants({ variant: "ghost", size: "icon" }),
            "h-8 w-8 focus-visible:ring-offset-card",
            page <= 1 && "pointer-events-none opacity-40",
          )}
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        </Link>

        {pages.map((item) => (
          <Link
            key={item}
            href={buildHref(basePath, item, query)}
            aria-current={item === page ? "page" : undefined}
            className={cn(
              "flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-xs font-medium tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card",
              item === page
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-ink",
            )}
          >
            {item}
          </Link>
        ))}

        <Link
          href={buildHref(basePath, Math.min(totalPages, page + 1), query)}
          aria-disabled={page >= totalPages}
          aria-label="Следующая страница"
          tabIndex={page >= totalPages ? -1 : undefined}
          className={cn(
            buttonVariants({ variant: "ghost", size: "icon" }),
            "h-8 w-8 focus-visible:ring-offset-card",
            page >= totalPages && "pointer-events-none opacity-40",
          )}
        >
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
    </nav>
  );
}
