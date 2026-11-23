import Link from "next/link";
import { Plus, Sparkles } from "lucide-react";
import type { SessionUser } from "@/lib/auth/session";
import { MobileNav } from "@/components/layout/mobile-nav";
import { HeaderContext } from "@/components/layout/header-context";
import { UserMenu } from "@/components/layout/user-menu";
import { Button } from "@/components/ui/button";

export function Header({ user }: { user: SessionUser }) {
  return (
    <header className="sticky top-0 z-30 flex h-[72px] items-center gap-3 border-b border-border/60 bg-white/65 px-4 backdrop-blur-xl backdrop-saturate-150 sm:px-6 lg:px-8">
      <MobileNav user={user} />
      <HeaderContext workspaceName={user.workspaceName} />

      <div className="flex flex-1 items-center justify-end gap-2">
        <Link
          href="/ai-assistant"
          className="hidden items-center gap-2 rounded-full border border-primary/[0.12] bg-primary/[0.06] px-3 py-1.5 text-[11px] font-semibold text-primary transition-colors hover:bg-primary/10 md:inline-flex"
        >
          <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
          AI-студия
        </Link>
        <Button asChild variant="secondary" size="icon" className="hidden sm:inline-flex">
          <Link href="/leads/new" aria-label="Создать заявку из шапки">
            <Plus className="h-4 w-4" aria-hidden="true" />
          </Link>
        </Button>
        <UserMenu user={user} />
      </div>
    </header>
  );
}
