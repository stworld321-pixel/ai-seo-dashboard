import type { Metadata } from "next";
import { Suspense } from "react";
import "./globals.css";
import { Sidebar } from "@/components/sidebar";

export const metadata: Metadata = {
  title: "AI SEO Command Center",
  description: "Autonomous SEO Intelligence & Growth Platform",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className="h-full antialiased font-sans"
    >
      <body className="min-h-full" suppressHydrationWarning>
        <div className="flex min-h-screen">
          <Suspense fallback={<aside className="w-64 border-r border-[var(--color-border)] bg-[var(--color-surface)] hidden lg:block shrink-0" />}>
            <Sidebar />
          </Suspense>
          <main className="min-w-0 flex-1">{children}</main>
        </div>
      </body>
    </html>
  );
}
