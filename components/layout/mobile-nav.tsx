"use client";

import { useState } from "react";
import { Menu, Sparkles } from "lucide-react";
import type { SessionUser } from "@/lib/auth/session";
import { ROLE_LABELS } from "@/lib/utils/labels";
import { initials } from "@/lib/utils/initials";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
      <DialogContent className="left-0 top-0 h-full max-w-[19rem] translate-x-0 translate-y-0 rounded-none rounded-r-card border-y-0 border-l-0 p-0">
        <DialogTitle className="sr-only">Навигация</DialogTitle>
        <DialogDescription className="sr-only">
          Разделы рабочего пространства BizPilot AI
        </DialogDescription>
        <div className="flex h-full flex-col bg-white/95">
          <div className="flex h-[72px] shrink-0 items-center border-b border-border/60 px-5">
            <span className="flex items-center gap-3 font-semibold">
              <span className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-brand-gradient text-white shadow-glow">
                <Sparkles className="h-[18px] w-[18px]" aria-hidden="true" />
                <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full border-2 border-white bg-aqua" />
              </span>
              <span>
                <span className="block text-[15px] leading-tight tracking-[-0.02em] text-ink">
                  BizPilot AI
                </span>
                <span className="mt-0.5 block text-[9px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Intelligent CRM
                </span>
              </span>
            </span>
          </div>
          <div className="flex-1 overflow-y-auto px-3.5 py-5">
            <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Рабочее пространство
            </p>
            <NavLinks onNavigate={() => setOpen(false)} />
          </div>
          <div className="border-t border-border/60 p-4">
            <div className="flex items-center gap-2.5">
              <Avatar className="h-9 w-9">
                <AvatarFallback className="text-[11px]">{initials(user.name)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold">{user.name}</p>
                <p className="truncate text-[11px] text-muted-foreground">{user.email}</p>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-2.5">
              <Badge variant="indigo">{ROLE_LABELS[user.role]}</Badge>
              <span className="max-w-36 truncate text-[11px] text-muted-foreground">
                {user.workspaceName}
              </span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
