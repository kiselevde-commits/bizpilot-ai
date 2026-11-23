import Link from "next/link";
import { Sparkles } from "lucide-react";
import type { SessionUser } from "@/lib/auth/session";
import { ROLE_LABELS } from "@/lib/utils/labels";
import { initials } from "@/lib/utils/initials";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { NavLinks } from "@/components/layout/nav-links";

export function Sidebar({ user }: { user: SessionUser }) {
  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-sidebar-border/80 bg-white/80 backdrop-blur-xl lg:flex">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-44 bg-gradient-to-b from-primary/[0.07] via-iris/[0.03] to-transparent"
        aria-hidden="true"
      />

      <div className="relative flex h-[72px] shrink-0 items-center border-b border-border/60 px-5">
        <Link href="/dashboard" className="flex min-w-0 items-center gap-3">
          <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-gradient text-white shadow-glow">
            <Sparkles className="h-[18px] w-[18px]" aria-hidden="true" />
            <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full border-2 border-white bg-aqua" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[15px] font-semibold leading-tight tracking-[-0.02em] text-ink">
              BizPilot AI
            </span>
            <span className="mt-0.5 block text-[9px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Intelligent CRM
            </span>
          </span>
        </Link>
      </div>

      <div className="relative flex-1 overflow-y-auto px-3.5 py-5">
        <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Рабочее пространство
        </p>
        <NavLinks />
      </div>

      <div className="relative border-t border-border/60 p-3.5">
        <div className="rounded-2xl border border-white/80 bg-white/60 p-3 shadow-soft backdrop-blur-sm">
          <div className="flex min-w-0 items-center gap-2.5">
            <Avatar className="h-9 w-9">
              <AvatarFallback className="text-[11px]">{initials(user.name)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold text-ink">{user.name}</p>
              <p className="truncate text-[11px] text-muted-foreground">{user.email}</p>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between gap-2 border-t border-border/60 pt-2.5">
            <Badge variant="indigo">{ROLE_LABELS[user.role]}</Badge>
            <Link
              href="/settings"
              className="truncate text-[11px] font-medium text-muted-foreground transition-colors hover:text-primary"
            >
              {user.workspaceName}
            </Link>
          </div>
        </div>
      </div>
    </aside>
  );
}
