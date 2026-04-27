import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ProcureAI",
  description: "BOM cost intelligence for engineering teams",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-[var(--app-bg)] text-foreground">
        {children}
      </body>
    </html>
  );
}
