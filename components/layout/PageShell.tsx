"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import ConnectButton from "@/components/ui/ConnectButton";
import NetworkBadge from "@/components/botchain/NetworkBadge";
import { app } from "@/lib/app-config";

export type NavItem = { href: string; label: string };

interface PageShellProps {
  children: React.ReactNode;
  nav?: NavItem[];
  title?: string;
  description?: string;
}

/**
 * App frame.
 *
 * A top bar rather than ghost-pay's 220px rail. These apps have two or three screens, and a rail
 * that wide spends a fifth of a laptop window — and all of a phone — on three links. The bar is
 * the same at every width, which also means there is no drawer, no focus trap and no hamburger to
 * get wrong.
 *
 * Height is `100dvh` rather than `100vh`. On mobile Safari and Chrome, `100vh` is the viewport
 * with the browser chrome *retracted*, so a `h-screen` layout with `overflow-hidden` pushes its
 * own footer under the address bar and the user cannot scroll to it.
 */
export default function PageShell({ children, nav = [], title, description }: PageShellProps) {
  return (
    <div
      className="flex flex-col overflow-x-hidden"
      style={{ minHeight: "100dvh", background: "var(--bg-base)" }}
    >
      <header
        className="sticky top-0 z-30 flex-shrink-0"
        style={{
          borderBottom: "1px solid var(--border-subtle)",
          background: "var(--bg-surface)",
        }}
      >
        <div className="mx-auto w-full max-w-[880px] px-4 md:px-6">
          <div className="flex items-center gap-3 py-2.5">
            <Link href="/" className="flex items-center gap-2 flex-shrink-0 no-underline">
              <span
                className="w-2 h-2 flex-shrink-0"
                style={{ background: "var(--accent)" }}
                aria-hidden="true"
              />
              <span
                className="text-[14px] font-semibold tracking-[-0.01em]"
                style={{ color: "var(--text-primary)" }}
              >
                {app.name}
              </span>
            </Link>

            <div className="flex-1" />
            <NetworkBadge />
            <div className="w-[150px] md:w-[180px] flex-shrink-0">
              <ConnectButton />
            </div>
          </div>

          {nav.length > 0 && <Nav items={nav} />}
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-[880px] px-4 py-6 md:px-6 md:py-8">
        {(title || description) && (
          <div className="mb-6">
            {title && (
              <h1
                className="text-[20px] md:text-[24px] font-semibold tracking-[-0.015em]"
                style={{ color: "var(--text-primary)" }}
              >
                {title}
              </h1>
            )}
            {description && (
              <p
                className="mt-1.5 text-[13px] leading-relaxed"
                style={{ color: "var(--text-secondary)" }}
              >
                {description}
              </p>
            )}
          </div>
        )}
        {children}
      </main>

      <footer
        className="flex-shrink-0 mx-auto w-full max-w-[880px] px-4 py-5 md:px-6"
        style={{ borderTop: "1px solid var(--border-subtle)" }}
      >
        <p className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>
          {app.tagline} Built on BOT Chain.
        </p>
      </footer>
    </div>
  );
}

/**
 * Horizontal tabs. `aria-current` rather than colour alone marks the active one, and the active
 * check is an exact match so `/` does not light up on every page.
 */
function Nav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-1 -mb-px overflow-x-auto">
      {items.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className="nav-link flex items-center px-3 py-2 text-[12px] uppercase tracking-[0.04em] no-underline whitespace-nowrap"
            style={{
              color: active ? "var(--accent)" : "var(--text-secondary)",
              borderBottom: `1px solid ${active ? "var(--accent)" : "transparent"}`,
            }}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
