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
              "group relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-all duration-150 ease-premium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar",
              isActive ? "nav-active" : "text-sidebar-muted hover:bg-muted/70 hover:text-ink",
            )}
          >
            <span
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-all duration-150",
                isActive
                  ? "bg-brand-gradient text-white shadow-glow"
                  : "bg-muted/70 text-muted-foreground group-hover:bg-white group-hover:text-primary group-hover:shadow-soft",
              )}
            >
              <Icon className="h-[17px] w-[17px]" aria-hidden="true" />
            </span>
            <span className="truncate">{item.label}</span>
            {isActive ? (
              <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" aria-hidden="true" />
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
