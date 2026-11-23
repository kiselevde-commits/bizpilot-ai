"use client";

import Link from "next/link";
import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Dashboard route error", { digest: error.digest, name: error.name });
  }, [error]);

  return (
    <div className="flex min-h-[55vh] flex-col items-center justify-center gap-4 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive shadow-soft">
        <AlertTriangle className="h-6 w-6" aria-hidden="true" />
      </span>
      <div>
        <h1 className="text-[22px] font-semibold tracking-[-0.03em]">Что-то пошло не так</h1>
        <p className="mx-auto mt-2 max-w-md text-[13px] leading-relaxed text-muted-foreground">
          Не удалось загрузить раздел. Повторите попытку — если ошибка повторяется, проверьте
          подключение к базе данных.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button onClick={reset}>
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
          Повторить
        </Button>
        <Button asChild variant="secondary">
          <Link href="/dashboard">На дашборд</Link>
        </Button>
      </div>
    </div>
  );
}
