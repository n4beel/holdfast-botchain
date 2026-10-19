import { createPublicClient, http, type Address, type PublicClient } from "viem";
import { activeBotChain, type BotChainId } from "@/lib/botchain/chain";
import { getDeployment, isDeployed } from "@/lib/botchain/deployment";
import { holdfastAbi } from "@/lib/botchain/abi";

export const DealState = {
  Open: 0,
  SellerConfirmed: 1,
  BuyerConfirmed: 2,
  BothConfirmed: 3,
  Released: 4,
  Refunded: 5,
} as const;

export type HoldfastDeal = {
  buyer: Address;
  seller: Address;
  deadline: number;
  state: number;
  amount: bigint;
};

export function dealStatusLabel(state: number): string {
  const labels: Record<number, string> = {
    0: "Open",
    1: "Seller Confirmed",
    2: "Buyer Confirmed",
    3: "Both Confirmed",
    4: "Released",
    5: "Refunded",
  };
  return labels[state] ?? "Unknown";
}

export function canRelease(deal: HoldfastDeal): boolean {
  return deal.state === DealState.BothConfirmed;
}

export function canRefund(deal: HoldfastDeal, now?: number): boolean {
  const t = now ?? Math.floor(Date.now() / 1000);
  return deal.state < DealState.BothConfirmed && t > deal.deadline;
}

export function isFinalized(deal: HoldfastDeal): boolean {
  return deal.state === DealState.Released || deal.state === DealState.Refunded;
}

/**
 * Which actions a given viewer may take on a deal right now.
 *
 * Kept here, as a pure function over the contract's own six states, because the version of this
 * that lived inline in the deal page was written against a four-state enum and was wrong in three
 * separate ways: it printed BuyerConfirmed as "Released", it offered Release from
 * SellerConfirmed (which the contract rejects), and it only ever showed a confirm button from
 * Open — so whichever party went second could never confirm, and no deal could reach
 * BothConfirmed at all. None of that was reachable by a test while it sat in JSX.
 *
 * Mirrors the contract exactly:
 *   confirmBySeller — seller only, from Open or BuyerConfirmed
 *   confirmByBuyer  — buyer only, from Open or SellerConfirmed
 *   release         — anyone, only from BothConfirmed
 *   refund          — after the deadline, from any state before BothConfirmed
 */
export interface DealActions {
  confirmAsSeller: boolean;
  confirmAsBuyer: boolean;
  release: boolean;
  refund: boolean;
}

export function availableActions(
  deal: HoldfastDeal,
  viewer: Address | undefined,
  now?: number,
): DealActions {
  const none: DealActions = {
    confirmAsSeller: false,
    confirmAsBuyer: false,
    release: false,
    refund: false,
  };
  if (isFinalized(deal)) return none;

  const who = viewer?.toLowerCase();
  const isBuyer = who !== undefined && who === deal.buyer.toLowerCase();
  const isSeller = who !== undefined && who === deal.seller.toLowerCase();

  return {
    confirmAsSeller:
      isSeller && (deal.state === DealState.Open || deal.state === DealState.BuyerConfirmed),
    confirmAsBuyer:
      isBuyer && (deal.state === DealState.Open || deal.state === DealState.SellerConfirmed),
    release: canRelease(deal),
    refund: isBuyer && canRefund(deal, now),
  };
}

export function formatDeadline(deadline: number): string {
  return new Date(deadline * 1000).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZoneName: "short",
  });
}

export function formatRelativeTime(timestamp: number, now?: number): string {
  const current = now ?? Math.floor(Date.now() / 1000);
  const diff = timestamp - current;

  if (diff <= 0) return "Passed";

  const days = Math.floor(diff / 86400);
  const hours = Math.floor((diff % 86400) / 3600);
  const minutes = Math.floor((diff % 3600) / 60);

  if (days > 0) return `${days}d ${hours}h remaining`;
  if (hours > 0) return `${hours}h ${minutes}m remaining`;
  return `${minutes}m remaining`;
}

/**
 * Public client for reading Holdfast state without a wallet.
 */
export function readClient(): PublicClient {
  return createPublicClient({
    chain: activeBotChain,
    transport: http(undefined, { timeout: 15_000 }),
  }) as PublicClient;
}

/**
 * Read deal by ID. Returns null for an unknown or empty deal.
 */
export async function readDeal(
  client: PublicClient,
  chainId: BotChainId,
  id: bigint,
): Promise<HoldfastDeal | null> {
  if (!isDeployed(chainId)) return null;

  const data = await client.readContract({
    address: getDeployment(chainId).address,
    abi: holdfastAbi,
    functionName: "dealOf",
    args: [id],
  });

  if (!data || data.buyer === "0x0000000000000000000000000000000000000000") {
    return null;
  }

  return {
    buyer: data.buyer,
    seller: data.seller,
    deadline: Number(data.deadline),
    state: Number(data.state),
    amount: data.amount,
  };
}
