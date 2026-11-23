import { getCurrentUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="relative min-h-screen bg-canvas">
      <div
        className="pointer-events-none fixed inset-0 bg-canvas-glow"
        aria-hidden="true"
      />
      <Sidebar user={user} />
      <div className="relative flex min-h-screen flex-col lg:pl-64">
        <Header user={user} />
        <main className="flex-1 px-4 pb-12 pt-6 sm:px-6 lg:px-8 lg:pt-8">
          <div className="mx-auto w-full max-w-[1320px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
