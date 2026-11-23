"use client";

import { usePathname } from "next/navigation";

const SECTIONS = [
  { prefix: "/dashboard", label: "Обзор" },
  { prefix: "/leads", label: "Заявки" },
  { prefix: "/crm", label: "Контакты" },
  { prefix: "/tasks", label: "Задачи" },
  { prefix: "/ai-assistant", label: "AI-помощник" },
  { prefix: "/settings", label: "Настройки" },
] as const;

export function HeaderContext({ workspaceName }: { workspaceName: string }) {
  const pathname = usePathname();
  const section = SECTIONS.find((item) => pathname.startsWith(item.prefix));

  return (
    <div className="hidden min-w-0 items-center gap-2 text-[13px] sm:flex">
      <span className="max-w-40 truncate font-medium text-muted-foreground">{workspaceName}</span>
      <span className="text-border" aria-hidden="true">
        /
      </span>
      <span className="truncate font-semibold text-ink">{section?.label ?? "Рабочее пространство"}</span>
    </div>
  );
}
