import { LoginForm } from "@/components/auth/login-form";

export default async function LoginPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{ callbackUrl?: string }>;
}>) {
  const { callbackUrl } = await searchParams;

  return (
    <div className="flex h-screen flex-col items-center justify-center bg-background">
      <div className="w-full max-w-md space-y-6 p-6">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <span className="h-4 w-4">★</span>
          </span>
          <span className="text-xl font-bold">BizPilot AI</span>
        </div>
        <h2 className="text-2xl font-semibold">Вход</h2>
        <LoginForm callbackUrl={callbackUrl || "/dashboard"} />
        <p className="text-sm text-muted-foreground text-center">
          Демо-учётные записи созданы в процессе seeding.
        </p>
      </div>
    </div>
  );
}
