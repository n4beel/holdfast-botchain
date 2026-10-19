import type { Metadata, Viewport } from "next";
import { Manrope, Fira_Code } from "next/font/google";
import { EvmProvider } from "@/components/providers/EvmProvider";
import { ToastProvider } from "@/components/ui/Toast";
import { app } from "@/lib/app-config";
import "./globals.css";

const ui = Manrope({ variable: "--font-ui", subsets: ["latin"], display: "swap" });
const state = Fira_Code({ variable: "--font-state", subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: `${app.name} — ${app.tagline}`,
  description: app.tagline,
  openGraph: { title: app.name, description: app.tagline, type: "website", url: app.url },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0D0F12" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${ui.variable} ${state.variable} h-full`}>
      <body className="min-h-full antialiased">
        <EvmProvider>
          <ToastProvider>{children}</ToastProvider>
        </EvmProvider>
      </body>
    </html>
  );
}
