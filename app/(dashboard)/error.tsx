"use client";

import Link from "next/link";
import { useEffect } from "react";
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
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-center">
      <h1 className="text-xl font-semibold">Что-то пошло не так</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        Не удалось загрузить раздел. Повторите попытку — если ошибка повторяется, проверьте
        подключение к базе данных.
      </p>
      <div className="flex gap-2">
        <Button onClick={reset}>Повторить</Button>
        <Link href="/dashboard">
          <Button variant="outline">На дашборд</Button>
        </Link>
      </div>
    </div>
  );
}
