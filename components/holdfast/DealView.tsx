"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { BaseError, type Address, type Hex } from "viem";
import { useAccount, useChainId, useReadContract, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import Panel from "@/components/ui/Panel";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import Spinner from "@/components/ui/Spinner";
import TxStatus, { type TxStage } from "@/components/ui/TxStatus";
import { useToast } from "@/components/ui/Toast";
import { activeBotChain, addressUrl, isBotChainId } from "@/lib/botchain/chain";
import { formatNativeAmount } from "@/lib/botchain/amount";
import { getDeployment, isDeployed } from "@/lib/botchain/deployment";
import { holdfastAbi } from "@/lib/botchain/abi";
import { availableActions, DealState, dealStatusLabel } from "@/lib/holdfast";

type Deal = {
  buyer: Address;
  seller: Address;
  deadline: bigint;
  state: number;
  amount: bigint;
};

/**
 * What the deal is waiting on, said from the reader's side.
 *
 * The contract has six states, not four: a deal that one party has confirmed is a different thing
 * depending on WHICH party, because the other one still has to act. This page used to carry its
 * own four-name table — Open, Confirmed, Released, Refunded — which meant BuyerConfirmed (2) was
 * printed as "Released" on a deal where no money had moved, and SellerConfirmed (1) offered a
 * Release button that the contract could only reject. `dealStatusLabel` in lib/holdfast.ts had
 * the right six names the whole time; this now uses it, and adds who is being waited on.
 */
function waitingOn(state: number, isBuyer: boolean, isSeller: boolean): string | null {
  if (state === DealState.Open) return "Neither side has confirmed yet.";
  if (state === DealState.SellerConfirmed) {
    return isBuyer
      ? "The seller has confirmed. Waiting on you."
      : "The seller has confirmed. Waiting on the buyer.";
  }
  if (state === DealState.BuyerConfirmed) {
    return isSeller
      ? "The buyer has confirmed. Waiting on you."
      : "The buyer has confirmed. Waiting on the seller.";
  }
  if (state === DealState.BothConfirmed) {
    return "Both sides have confirmed. The funds can be released to the seller.";
  }
  return null;
}

/**
 * A deal, and whichever action is actually yours.
 *
 * Both parties and a passer-by see the same page; only the buttons differ. The deadline is shown
 * as a standing fact rather than a footnote, because it is the thing that guarantees nobody's
 * money is ever stuck — an unconfirmed deal becomes refundable to the buyer once it passes, and a
 * user who does not know that will assume the opposite.
 */
function DealBody({ initialId }: { initialId?: string }) {
  const chainId = useChainId();
  const { address } = useAccount();
  const { toast } = useToast();
  const { writeContractAsync } = useWriteContract();
  const search = useSearchParams();
  // /deal/<id> wins over /deal?id=<id>; both resolve to the same view.
  const fromQuery = initialId ?? search.get("id") ?? "";

  const [typed, setTyped] = useState(fromQuery);
  const [stage, setStage] = useState<TxStage>("idle");
  const [hash, setHash] = useState<Hex | null>(null);
  const [now, setNow] = useState(() => BigInt(Math.floor(Date.now() / 1000)));

  useEffect(() => setTyped(fromQuery), [fromQuery]);
  useEffect(() => {
    const t = setInterval(() => setNow(BigInt(Math.floor(Date.now() / 1000))), 5000);
    return () => clearInterval(t);
  }, []);

  const id = /^\d+$/.test(typed.trim()) ? BigInt(typed.trim()) : null;
  const deployment = isBotChainId(chainId) ? getDeployment(chainId) : null;
  const ready = id !== null && isBotChainId(chainId) && isDeployed(chainId);

  const read = useReadContract({
    address: deployment?.address,
    abi: holdfastAbi,
    functionName: "dealOf",
    args: id !== null ? [id] : undefined,
    query: { enabled: ready },
  });

  const deal = read.data as Deal | undefined;
  const exists = deal && deal.amount > 0n;

  const receipt = useWaitForTransactionReceipt({ hash: hash ?? undefined, query: { enabled: Boolean(hash) } });
  const settled = useRef<Hex | null>(null);
  const refetch = read.refetch;

  useEffect(() => {
    if (!hash || settled.current === hash) return;
    if (!receipt.isSuccess && !receipt.isError) return;
    settled.current = hash;
    if (receipt.isSuccess) {
      setStage("confirmed");
      toast("success", "Done", "The deal has moved on.");
      void refetch();
    } else {
      setStage("failed");
      toast("error", "Transaction failed", "Nothing changed.");
    }
  }, [hash, receipt.isSuccess, receipt.isError, toast, refetch]);

  const act = useCallback(
    async (fn: "confirmBySeller" | "confirmByBuyer" | "release" | "refund") => {
      if (!deployment || !isBotChainId(chainId) || id === null) return;
      setStage("signing");
      setHash(null);
      settled.current = null;
      try {
        const txHash = await writeContractAsync({
          address: deployment.address, abi: holdfastAbi, functionName: fn, args: [id], chainId,
        });
        setHash(txHash);
        setStage("pending");
      } catch (err) {
        setStage("idle");
        const message = err instanceof BaseError ? err.shortMessage : "Something went wrong.";
        if (/rejected|denied/i.test(message)) toast("info", "Cancelled", "Nothing was sent.");
        else toast("error", "Could not send", message);
      }
    },
    [deployment, chainId, id, writeContractAsync, toast],
  );

  const symbol = activeBotChain.nativeCurrency.symbol;
  const isBuyer = Boolean(address && deal && address.toLowerCase() === deal.buyer.toLowerCase());
  const isSeller = Boolean(address && deal && address.toLowerCase() === deal.seller.toLowerCase());
  const busy = stage === "signing" || stage === "pending";
  const pastDeadline = deal ? now > deal.deadline : false;
  // Final means the money has moved — Released or Refunded. It used to mean `state >= 2`, which
  // swept in BuyerConfirmed and BothConfirmed and hid the very buttons those states exist for.
  const finalised = deal
    ? deal.state === DealState.Released || deal.state === DealState.Refunded
    : false;

  // One source of truth for the buttons, shared with the tests in lib/__tests__/deal-actions.
  const can = deal
    ? availableActions(
        { ...deal, deadline: Number(deal.deadline) },
        address,
        Number(now),
      )
    : null;

  return (
    <div className="flex flex-col gap-5">
      {/* A field, not a panel. Under the list of your own deals a boxed input reads as a second
          thing of equal weight, when it is the way to reach somebody else's. */}
      <div className="max-w-sm">
        <Input label="Open a deal by number" value={typed} onChange={(e) => setTyped(e.target.value)}
          placeholder="0" mono hint="Anyone's. No wallet needed to read one." />
      </div>

      {ready && read.isLoading && <Panel><Spinner label="Reading the chain" /></Panel>}

      {ready && read.isError && (
        <Panel>
          <p className="text-[13px]" style={{ color: "var(--warning)" }}>
            Could not reach the chain. This is unknown, not missing — try again.
          </p>
        </Panel>
      )}

      {ready && read.isSuccess && !exists && (
        <Panel><p className="text-[13px]" style={{ color: "var(--text-tertiary)" }}>No deal with that number.</p></Panel>
      )}

      {ready && exists && deal && (
        <>
          <Panel>
            <div className="flex flex-col gap-4">
              <div className="flex items-baseline justify-between gap-3 flex-wrap">
                <span className="mono text-[11px] uppercase tracking-[0.08em]"
                  style={{ color: finalised ? "var(--success)" : "var(--accent)" }}>
                  {dealStatusLabel(deal.state)}
                </span>
                <span className="mono text-[18px]" style={{ color: "var(--text-primary)" }}>
                  {formatNativeAmount(deal.amount)} {symbol}
                </span>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="mono text-[11px] uppercase tracking-[0.08em] mb-1" style={{ color: "var(--text-tertiary)" }}>Buyer</p>
                  <a href={addressUrl(chainId, deal.buyer)} target="_blank" rel="noreferrer"
                    className="mono text-[12px] break-all" style={{ color: isBuyer ? "var(--accent)" : "var(--text-secondary)" }}>
                    {deal.buyer}{isBuyer ? " (you)" : ""}
                  </a>
                </div>
                <div>
                  <p className="mono text-[11px] uppercase tracking-[0.08em] mb-1" style={{ color: "var(--text-tertiary)" }}>Seller</p>
                  <a href={addressUrl(chainId, deal.seller)} target="_blank" rel="noreferrer"
                    className="mono text-[12px] break-all" style={{ color: isSeller ? "var(--accent)" : "var(--text-secondary)" }}>
                    {deal.seller}{isSeller ? " (you)" : ""}
                  </a>
                </div>
              </div>

              <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: "12px" }}>
                <p className="text-[12px]" style={{ color: pastDeadline && !finalised ? "var(--warning)" : "var(--text-tertiary)" }}>
                  Deadline {new Date(Number(deal.deadline) * 1000).toISOString().replace("T", " ").replace(".000Z", " UTC")}
                  {!finalised && (pastDeadline
                    ? " — passed. If this deal was never confirmed by both sides, the buyer can reclaim the funds."
                    : " — after this, an unconfirmed deal becomes refundable to the buyer.")}
                </p>
              </div>
            </div>
          </Panel>

          {!finalised && (isBuyer || isSeller) && (
            <Panel>
              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap gap-2">
                  {/* Each side may confirm from Open, or after the other side has gone first. */}
                  {can?.confirmAsSeller && (
                    <Button disabled={busy} onClick={() => act("confirmBySeller")}>
                      Confirm as seller
                    </Button>
                  )}
                  {can?.confirmAsBuyer && (
                    <Button disabled={busy} onClick={() => act("confirmByBuyer")}>
                      Confirm as buyer
                    </Button>
                  )}
                  {can?.release && (
                    <Button disabled={busy} onClick={() => act("release")}>
                      Release to the seller
                    </Button>
                  )}
                  {can?.refund && (
                    <Button variant="ghost" disabled={busy} onClick={() => act("refund")}>
                      Reclaim as buyer
                    </Button>
                  )}
                </div>

                {waitingOn(deal.state, isBuyer, isSeller) && (
                  <p className="text-[12px]" style={{ color: "var(--text-tertiary)" }}>
                    {waitingOn(deal.state, isBuyer, isSeller)}
                    {deal.state === DealState.Open &&
                      " Either of you may confirm first; the order does not matter."}
                  </p>
                )}

                <TxStatus stage={stage} hash={hash} confirmedLabel="Done" failedLabel="Transaction failed — nothing changed." />
              </div>
            </Panel>
          )}

          {!finalised && !isBuyer && !isSeller && address && (
            <Panel>
              <p className="text-[12px]" style={{ color: "var(--text-tertiary)" }}>
                You are neither the buyer nor the seller on this deal, so you can read it but not act on it.
              </p>
            </Panel>
          )}
        </>
      )}
    </div>
  );
}

export default function DealView({ initialId }: { initialId?: string }) {
  return (
    <Suspense fallback={<Panel><Spinner label="Loading" /></Panel>}>
      <DealBody initialId={initialId} />
    </Suspense>
  );
}
