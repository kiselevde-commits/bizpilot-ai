"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CheckSquare, Inbox, LayoutDashboard, Settings, Sparkles, Users } from "lucide-react";
import { cn } from "@/lib/utils/cn";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Обзор", icon: LayoutDashboard },
  { href: "/leads", label: "Заявки", icon: Inbox },
  { href: "/crm", label: "Контакты", icon: Users },
  { href: "/tasks", label: "Задачи", icon: CheckSquare },
  { href: "/ai-assistant", label: "AI-помощник", icon: Sparkles },
  { href: "/settings", label: "Настройки", icon: Settings },
] as const;

export function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="space-y-1" aria-label="Основная навигация">
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
