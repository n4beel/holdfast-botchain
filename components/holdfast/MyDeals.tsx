"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { formatEther, type Address } from "viem";
import { useAccount, useChainId, usePublicClient, useReadContracts } from "wagmi";
import Panel from "@/components/ui/Panel";
import Spinner from "@/components/ui/Spinner";
import { activeBotChain, isBotChainId } from "@/lib/botchain/chain";
import { getDeployment, isDeployed } from "@/lib/botchain/deployment";
import { holdfastAbi } from "@/lib/botchain/abi";
import { DealState, dealStatusLabel } from "@/lib/holdfast";

// The chain's own symbol. Hardcoding "BOT" labelled every testnet amount as mainnet
// currency, which is the confusion the network badge exists to prevent.
const SYMBOL = activeBotChain.nativeCurrency.symbol;

/**
 * Every deal the connected wallet is a party to.
 *
 * There is no on-chain index of "my deals" — the contract numbers deals globally and stores
 * nothing per address. But `DealOpened` indexes both buyer and seller, so two filtered log
 * queries give the complete set without scanning anything, and the current state of each is a
 * single multicall afterwards. Without this a buyer who closed the tab had no way back to a deal
 * except the number, which is the sort of thing people do not write down.
 */
type DealOpenedEvent = Extract<
  (typeof holdfastAbi)[number],
  { type: "event"; name: "DealOpened" }
>;

/** Taken from the ABI itself; re-typing the signature here is how the two drift apart. */
const DEAL_OPENED = holdfastAbi.find(
  (item): item is DealOpenedEvent => item.type === "event" && item.name === "DealOpened",
)!;

export default function MyDeals() {
  const chainId = useChainId();
  const { address } = useAccount();
  const publicClient = usePublicClient(); // stable-hook-result

  const [ids, setIds] = useState<bigint[] | null>(null);
  const [failed, setFailed] = useState(false);

  const ready = Boolean(address) && isBotChainId(chainId) && isDeployed(chainId);
  const deployment = isBotChainId(chainId) && isDeployed(chainId) ? getDeployment(chainId) : null;
  const contract = deployment?.address;
  const fromBlock = deployment?.deployBlock;

  // Keyed on primitives, and guarded, so a re-render cannot restart the scan.
  const scanned = useRef<string | null>(null);

  useEffect(() => {
    if (!ready || !publicClient || !address || !contract || fromBlock === undefined) return;
    const key = `${chainId}:${address.toLowerCase()}`;
    if (scanned.current === key) return;
    scanned.current = key;

    let cancelled = false;
    void (async () => {
      try {
        const [asBuyer, asSeller] = await Promise.all([
          publicClient.getLogs({
            address: contract, event: DEAL_OPENED, args: { buyer: address }, fromBlock,
          }),
          publicClient.getLogs({
            address: contract, event: DEAL_OPENED, args: { seller: address }, fromBlock,
          }),
        ]);

        if (cancelled) return;
        const seen = new Set<string>();
        const found: bigint[] = [];
        for (const log of [...asBuyer, ...asSeller]) {
          const { id } = log.args;
          if (id === undefined || seen.has(id.toString())) continue;
          seen.add(id.toString());
          found.push(id);
        }
        found.sort((a, b) => (a < b ? 1 : a > b ? -1 : 0)); // newest first
        setIds(found);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [ready, publicClient, address, contract, fromBlock, chainId]);

  const states = useReadContracts({
    contracts: (ids ?? []).map((id) => ({
      address: contract,
      abi: holdfastAbi,
      functionName: "dealOf" as const,
      args: [id] as const,
    })),
    query: { enabled: Boolean(ids?.length) && Boolean(contract) },
  });

  const rows = useMemo(() => {
    if (!ids) return [];
    return ids.map((id, i) => {
      const deal = states.data?.[i]?.result as
        | { buyer: Address; seller: Address; deadline: bigint; state: number; amount: bigint }
        | undefined;
      return { id, deal };
    });
  }, [ids, states.data]);

  if (!ready) return null;

  if (failed) {
    return (
      <Panel>
        <p className="text-[12px]" style={{ color: "var(--text-tertiary)" }}>
          Could not list your deals — the node refused the log query. Deals are still reachable by
          number.
        </p>
      </Panel>
    );
  }

  if (ids === null) {
    return (
      <Panel>
        <Spinner label="Finding your deals" />
      </Panel>
    );
  }

  if (ids.length === 0) {
    return (
      <Panel>
        <p className="text-[12px]" style={{ color: "var(--text-tertiary)" }}>
          No deals yet for this wallet, as buyer or as seller.
        </p>
      </Panel>
    );
  }

  return (
    <Panel>
      <div className="flex flex-col gap-3">
        <span
          className="mono text-[11px] uppercase tracking-[0.08em]"
          style={{ color: "var(--text-tertiary)" }}
        >
          Your deals
        </span>

        <ul className="flex flex-col gap-2 list-none p-0 m-0">
          {rows.map(({ id, deal }) => {
            const role =
              deal && address
                ? deal.buyer.toLowerCase() === address.toLowerCase()
                  ? "buying"
                  : "selling"
                : "";
            const done =
              deal?.state === DealState.Released || deal?.state === DealState.Refunded;
            const yours =
              deal && address
                ? (deal.state === DealState.Open) ||
                  (deal.state === DealState.BuyerConfirmed &&
                    deal.seller.toLowerCase() === address.toLowerCase()) ||
                  (deal.state === DealState.SellerConfirmed &&
                    deal.buyer.toLowerCase() === address.toLowerCase()) ||
                  deal.state === DealState.BothConfirmed
                : false;

            return (
              <li
                key={id.toString()}
                className="flex items-baseline gap-3 flex-wrap py-2"
                style={{ borderBottom: "1px solid var(--border-subtle)" }}
              >
                <Link
                  href={`/deal/${id.toString()}`}
                  className="mono text-[13px] underline"
                  style={{ color: "var(--accent)" }}
                >
                  #{id.toString()}
                </Link>

                <span className="mono text-[12px]" style={{ color: "var(--text-secondary)" }}>
                  {deal ? `${formatEther(deal.amount)} ${SYMBOL}` : "…"}
                </span>

                <span className="text-[11px] uppercase tracking-[0.06em]" style={{ color: "var(--text-tertiary)" }}>
                  {role}
                </span>

                <span
                  className="mono text-[11px] uppercase tracking-[0.06em] ml-auto"
                  style={{ color: done ? "var(--text-tertiary)" : "var(--accent)" }}
                >
                  {deal ? dealStatusLabel(deal.state) : ""}
                </span>

                {yours && !done && (
                  <span
                    className="text-[11px] uppercase tracking-[0.06em]"
                    style={{ color: "var(--warning)" }}
                  >
                    your move
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </Panel>
  );
}
