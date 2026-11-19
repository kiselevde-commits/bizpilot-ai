"use client";

import { useState } from "react";
import { Menu, Sparkles } from "lucide-react";
import type { SessionUser } from "@/lib/auth/session";
import { ROLE_LABELS } from "@/lib/utils/labels";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { NavLinks } from "@/components/layout/nav-links";

export function MobileNav({ user }: { user: SessionUser }) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Открыть меню">
          <Menu className="h-5 w-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="left-0 top-0 h-full max-w-xs translate-x-0 translate-y-0 rounded-none p-0">
        <DialogTitle className="sr-only">Навигация</DialogTitle>
        <div className="flex h-full flex-col">
          <div className="flex h-16 items-center border-b px-4">
            <span className="flex items-center gap-2 font-semibold">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Sparkles className="h-4 w-4" aria-hidden="true" />
              </span>
              BizPilot AI
            </span>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-5">
            <NavLinks onNavigate={() => setOpen(false)} />
          </div>
          <div className="border-t p-4">
            <p className="truncate text-sm font-medium">{user.name}</p>
            <p className="truncate text-xs text-muted-foreground">{user.email}</p>
            <p className="mt-1 text-xs text-muted-foreground">{ROLE_LABELS[user.role]}</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
