import Link from "next/link";
import { SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function DashboardNotFound() {
  return (
    <div className="flex min-h-[55vh] flex-col items-center justify-center gap-4 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-soft">
        <SearchX className="h-6 w-6" aria-hidden="true" />
      </span>
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          404
        </p>
        <h1 className="mt-1 text-[22px] font-semibold tracking-[-0.03em]">
          Страница или запись не найдена
        </h1>
        <p className="mx-auto mt-2 max-w-md text-[13px] leading-relaxed text-muted-foreground">
          Возможно, запись была удалена или относится к другому рабочему пространству.
        </p>
      </div>
      <Button asChild>
        <Link href="/dashboard">На дашборд</Link>
      </Button>
    </div>
  );
}
