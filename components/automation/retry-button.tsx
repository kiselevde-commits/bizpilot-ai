"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

type RetryResponse = {
  success: boolean;
  data?: {
    event?: {
      status?: string;
    };
  };
  error?: {
    message?: string;
  };
};

export function AutomationRetryButton({ eventId }: { eventId: string }) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  async function handleRetry(): Promise<void> {
    setIsLoading(true);

    try {
      const response = await fetch(`/api/automation/events/${encodeURIComponent(eventId)}/retry`, {
        method: "POST",
        headers: {
          accept: "application/json",
        },
      });

      const payload = (await response.json().catch(() => null)) as RetryResponse | null;

      if (!response.ok || !payload?.success) {
        toast.error(
          payload?.error?.message ?? "Не удалось выполнить повтор. Проверьте статус события.",
        );
        return;
      }

      const status = payload.data?.event?.status;

      toast.success(status ? `Повтор запущен. Текущий статус: ${status}` : "Повтор запущен.");
      router.refresh();
    } catch {
      toast.error("Сетевая ошибка при выполнении повтора");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      onClick={() => void handleRetry()}
      disabled={isLoading}
    >
      <RefreshCw
        className={`mr-1 h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`}
        aria-hidden="true"
      />
      {isLoading ? "Повтор…" : "Повторить"}
    </Button>
  );
}
