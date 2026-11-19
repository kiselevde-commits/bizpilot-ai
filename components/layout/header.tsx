import type { SessionUser } from "@/lib/auth/session";
import { MobileNav } from "@/components/layout/mobile-nav";
import { UserMenu } from "@/components/layout/user-menu";

export function Header({ user }: { user: SessionUser }) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-white/95 px-4 backdrop-blur sm:px-6 lg:px-8">
      <MobileNav user={user} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-muted-foreground">BizPilot AI</p>
      </div>
      <UserMenu user={user} />
    </header>
  );
}
