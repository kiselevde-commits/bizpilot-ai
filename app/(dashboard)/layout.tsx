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
    <div className="flex h-screen flex-col overflow-hidden">
      <Header user={user} />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar user={user} />
        <main className="flex-1 overflow-y-auto bg-background p-4 md:p-6 lg:ml-64">
          {children}
        </main>
      </div>
    </div>
  );
}
