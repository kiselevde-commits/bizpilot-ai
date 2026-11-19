import type { Metadata } from "next";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "BizPilot AI",
    template: "%s · BizPilot AI",
  },
  description: "Управление заявками, контактами и задачами с AI-анализом",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body>
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
