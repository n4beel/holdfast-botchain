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
 * Ledger shell: a right-hand rail carrying the state machine.
 *
 * Holdfast's whole difficulty is that two parties must both act and either may vanish. The rail
 * keeps the states and the deadline rule permanently in view on the right, so the escape hatch —
 * the buyer can reclaim after the deadline — is never something a user has to go looking for. The
 * rail is on the right rather than the left specifically so it does not read as Scatter's.
 *
 * These are the contract's six states, not a simplification of them. The rail used to list four,
 * collapsing "the seller has confirmed" and "the buyer has confirmed" into one "Confirmed" — which
 * is the same mistake that made the deal page call a half-confirmed deal "Released". A reader
 * whose deal says "Buyer Confirmed" must be able to find that name here.
 */
const STATES = [
  ["Open", "Funded by the buyer. Neither side has confirmed."],
  ["Seller Confirmed", "The seller has agreed. Waiting on the buyer."],
  ["Buyer Confirmed", "The buyer has agreed. Waiting on the seller."],
  ["Both Confirmed", "Both sides agreed. The funds can be released to the seller."],
  ["Released", "Paid to the seller. Final."],
  ["Refunded", "Returned to the buyer after the deadline. Final."],
];

export default function PageShell({ children, nav = [], title, description }: PageShellProps) {
  const pathname = usePathname();

  return (
    <div className="flex flex-col" style={{ minHeight: "100dvh" }}>
      <header className="flex-shrink-0" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
        <div className="mx-auto w-full px-5 md:px-8 py-4 flex items-center justify-between gap-4" style={{ maxWidth: "1140px" }}>
          <Link href="/" className="flex items-center gap-2.5 no-underline">
            <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
              <rect x="2" y="8" width="16" height="10" rx="2" fill="none" stroke="var(--accent)" strokeWidth="2" />
              <path d="M6 8V6a4 4 0 0 1 8 0v2" fill="none" stroke="var(--accent)" strokeWidth="2" />
            </svg>
            <span className="text-[17px] font-semibold tracking-[-0.025em]">{app.name}</span>
          </Link>
          <div className="flex items-center gap-3">
            {nav.length > 1 && (
              <nav className="hidden sm:flex items-center gap-4 mr-1">
                {nav.map((item) => {
                  const active = pathname === item.href;
                  return (
                    <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined}
                      className="nav-link text-[13px] no-underline"
                      style={{ color: active ? "var(--accent)" : "var(--text-tertiary)" }}>
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
            )}
            <NetworkBadge />
            <div style={{ width: "155px" }}><ConnectButton /></div>
          </div>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full px-5 md:px-8 py-8" style={{ maxWidth: "1140px" }}>
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div className="min-w-0">
            {title && <h1 className="text-[28px] md:text-[32px]" style={{ color: "var(--text-primary)" }}>{title}</h1>}
            {description && (
              <p className="mt-2 text-[14px]" style={{ color: "var(--text-secondary)", maxWidth: "60ch" }}>
                {description}
              </p>
            )}
            <div className={title || description ? "mt-7" : ""}>{children}</div>
          </div>

          <aside className="lg:sticky lg:top-8 self-start w-full">
            <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: "5px", padding: "18px" }}>
              <p className="mono text-[11px] uppercase tracking-[0.08em] mb-4" style={{ color: "var(--text-tertiary)" }}>
                Deal states
              </p>
              <ol className="flex flex-col gap-3.5">
                {STATES.map(([name, detail], i) => (
                  <li key={name} className="flex gap-3">
                    <span className="mono text-[11px] flex-shrink-0 pt-0.5" style={{ color: "var(--accent)" }}>
                      {i + 1}
                    </span>
                    <span>
                      <span className="block text-[13px]" style={{ color: "var(--text-primary)" }}>{name}</span>
                      <span className="block text-[12px]" style={{ color: "var(--text-tertiary)" }}>{detail}</span>
                    </span>
                  </li>
                ))}
              </ol>
              <p className="mt-4 pt-4 text-[12px]" style={{ borderTop: "1px solid var(--border-subtle)", color: "var(--warning)" }}>
                A deal that is never confirmed is refundable to the buyer once the deadline passes.
                Nothing is ever stuck.
              </p>
            </div>
          </aside>
        </div>
      </main>

      <footer className="flex-shrink-0 mx-auto w-full px-5 md:px-8 py-6 flex flex-wrap items-center gap-x-5 gap-y-2" style={{ maxWidth: "1140px", borderTop: "1px solid var(--border-subtle)" }}>
        <span className="text-[12px]" style={{ color: "var(--text-tertiary)" }}>{app.tagline}</span>
        <div className="flex-1" />
        <span className="text-[12px]" style={{ color: "var(--text-secondary)" }}>Built on BOT Chain</span>
        <a href="https://botchain.ai" target="_blank" rel="noreferrer" className="text-[12px]" style={{ color: "var(--text-tertiary)" }}>botchain.ai</a>
        <a href="https://scan.botchain.ai" target="_blank" rel="noreferrer" className="text-[12px]" style={{ color: "var(--text-tertiary)" }}>BOT Chain Explorer</a>
      </footer>
    </div>
  );
}
