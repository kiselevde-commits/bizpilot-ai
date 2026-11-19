import Link from "next/link";
import { Sparkles } from "lucide-react";
import type { SessionUser } from "@/lib/auth/session";
import { ROLE_LABELS } from "@/lib/utils/labels";
import { Badge } from "@/components/ui/badge";
import { NavLinks } from "@/components/layout/nav-links";

export function Sidebar({ user }: { user: SessionUser }) {
  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r bg-white lg:flex">
      <div className="flex h-16 items-center border-b px-6">
        <Link href="/dashboard" className="flex items-center gap-2 font-semibold">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Sparkles className="h-4 w-4" aria-hidden="true" />
          </span>
          <span>BizPilot AI</span>
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-5">
        <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Рабочее пространство
        </p>
        <NavLinks />
      </div>

      <div className="border-t p-4">
        <div className="rounded-lg bg-muted/60 p-3">
          <p className="truncate text-sm font-medium">{user.name}</p>
          <p className="truncate text-xs text-muted-foreground">{user.email}</p>
          <Badge variant="secondary" className="mt-2">
            {ROLE_LABELS[user.role]}
          </Badge>
        </div>
      </div>
    </aside>
  );
}
