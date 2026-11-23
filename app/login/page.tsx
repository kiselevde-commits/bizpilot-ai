import { CheckCircle2, Inbox, ShieldCheck, Sparkles, Users } from "lucide-react";
import { LoginForm } from "@/components/auth/login-form";
import { safeCallbackUrl } from "@/lib/auth/callback";

export default async function LoginPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{ callbackUrl?: string }>;
}>) {
  const { callbackUrl } = await searchParams;

  return (
    <div className="relative flex min-h-screen bg-canvas">
      <div className="pointer-events-none absolute inset-0 bg-canvas-glow" aria-hidden="true" />

      <div className="relative hidden w-[46%] overflow-hidden bg-[linear-gradient(160deg,#20263D_0%,#272c4f_52%,#3a2f6a_100%)] p-10 text-white lg:flex lg:flex-col xl:p-14">
        <div className="dot-grid pointer-events-none absolute inset-0 opacity-[0.14]" aria-hidden="true" />
        <div
          className="pointer-events-none absolute -right-24 top-24 h-80 w-80 rounded-full bg-iris/20 blur-3xl"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -bottom-24 -left-16 h-80 w-80 rounded-full bg-aqua/10 blur-3xl"
          aria-hidden="true"
        />

        <div className="relative">
          <div className="flex items-center gap-3">
            <span className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-white shadow-lifted ring-1 ring-white/20 backdrop-blur">
              <Sparkles className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-[15px] font-semibold tracking-[-0.02em]">BizPilot AI</p>
              <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-white/60">
                Intelligent CRM
              </p>
            </div>
          </div>
        </div>

        <div className="relative my-auto max-w-xl py-12">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/70 backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-aqua" />
            Human-in-the-loop AI
          </span>
          <h1 className="mt-6 text-[38px] font-semibold leading-[1.08] tracking-[-0.04em] xl:text-[46px]">
            Заявки, клиенты и задачи{" "}
            <span className="text-white/60">в одном интеллектуальном</span> рабочем пространстве.
          </h1>
          <p className="mt-5 max-w-lg text-[14px] leading-relaxed text-white/60">
            BizPilot AI анализирует обращения, оценивает потенциал лида и готовит следующий шаг.
            Решение всегда остаётся за человеком.
          </p>

          <ul className="mt-8 space-y-3.5">
            {[
              { icon: Sparkles, text: "AI-анализ заявки с оценкой и рекомендациями" },
              { icon: Inbox, text: "Прозрачная воронка от первого контакта до конверсии" },
              { icon: Users, text: "Контакты, задачи и история коммуникации рядом" },
            ].map((item) => (
              <li key={item.text} className="flex items-center gap-3 text-[13px] text-white/75">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.07] ring-1 ring-white/10">
                  <item.icon className="h-4 w-4" aria-hidden="true" />
                </span>
                {item.text}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-white/10 pt-5 text-[10px] font-medium uppercase tracking-[0.12em] text-white/60">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
            Workspace isolation
          </span>
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
            PostgreSQL Outbox
          </span>
          <span className="flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            Real AI provider
          </span>
        </div>
      </div>

      <div className="relative flex flex-1 items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-[26rem]">
          <div className="mb-6 flex items-center gap-3 lg:hidden">
            <span className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-brand-gradient text-white shadow-glow">
              <Sparkles className="h-5 w-5" aria-hidden="true" />
              <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full border-2 border-white bg-aqua" />
            </span>
            <div>
              <p className="text-[15px] font-semibold tracking-[-0.02em] text-ink">BizPilot AI</p>
              <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Intelligent CRM
              </p>
            </div>
          </div>

          <div className="rounded-card border border-white/80 bg-white/80 p-6 shadow-lifted backdrop-blur-xl sm:p-8">
            <div className="mb-6">
              <p className="eyebrow">Secure access</p>
              <h2 className="mt-2 text-[24px] font-semibold tracking-[-0.03em] text-ink">Вход</h2>
              <p className="mt-1.5 text-[12px] leading-relaxed text-muted-foreground">
                Войдите в рабочее пространство, чтобы продолжить работу с заявками.
              </p>
            </div>

            <LoginForm callbackUrl={safeCallbackUrl(callbackUrl)} />

            <p className="mt-6 border-t border-border/70 pt-4 text-center text-[11px] leading-relaxed text-muted-foreground">
              Демо-учётные записи создаются при seeding рабочего пространства.
            </p>
          </div>

          <p className="mt-5 text-center text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            BizPilot AI · Premium Intelligent SaaS
          </p>
        </div>
      </div>
    </div>
  );
}
