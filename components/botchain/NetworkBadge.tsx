"use client";

import { useAccount, useChainId } from "wagmi";
import { activeBotChain, botChain, isBotChainId } from "@/lib/botchain/chain";

/**
 * Which network the user is actually on.
 *
 * It says "Testnet" in amber on Bohr for one reason: the listing bar is mainnet-only, and a
 * screenshot of a testnet transaction submitted as proof is a wasted submission. The label makes
 * that impossible to miss.
 *
 * `isConnected` is checked rather than trusting `useChainId` alone. With no wallet, wagmi reports
 * the config's first chain, which is a real BOT Chain ID and so passes `isBotChainId` — it is just
 * not the user's. `WAGMI_CHAINS` now puts the build's target first so the two agree, and this is
 * the belt to that braces: the badge says what the build targets until a wallet says otherwise.
 */
export default function NetworkBadge() {
  const chainId = useChainId();
  const { isConnected } = useAccount();
  const shown = isConnected && isBotChainId(chainId) ? chainId : activeBotChain.id;
  const mainnet = shown === botChain.id;

  return (
    <span
      className="hidden sm:inline-flex items-center gap-1.5 px-2 py-1 text-[10px] uppercase tracking-[0.06em] flex-shrink-0"
      style={{
        borderRadius: "2px",
        border: `1px solid ${mainnet ? "var(--border-default)" : "var(--warning)"}`,
        color: mainnet ? "var(--text-secondary)" : "var(--warning)",
      }}
      title={mainnet ? "BOT Chain mainnet (677)" : "Bohr testnet (968) — not mainnet"}
    >
      {mainnet ? "Mainnet" : "Testnet"}
    </span>
  );
}
