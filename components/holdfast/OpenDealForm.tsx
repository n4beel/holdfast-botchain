"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  BaseError,
  ContractFunctionRevertedError,
  isAddress,
  parseEventLogs,
  type Address,
  type Hex,
} from "viem";
import {
  useAccount,
  useChainId,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import Panel from "@/components/ui/Panel";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import TxStatus, { type TxStage } from "@/components/ui/TxStatus";
import { useToast } from "@/components/ui/Toast";
import BotChainGate from "@/components/botchain/BotChainGate";
import { activeBotChain, isBotChainId } from "@/lib/botchain/chain";
import { getDeployment } from "@/lib/botchain/deployment";
import { holdfastAbi } from "@/lib/botchain/abi";
import { parseNativeAmount } from "@/lib/botchain/amount";

function getDefaultDeadlineString(): string {
  const d = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function OpenDealForm() {
  const chainId = useChainId();
  const { address } = useAccount();
  const { toast } = useToast();
  const { writeContractAsync } = useWriteContract();

  const [seller, setSeller] = useState("");
  const [deadlineStr, setDeadlineStr] = useState(getDefaultDeadlineString());
  const [amountStr, setAmountStr] = useState("");
  const [stage, setStage] = useState<TxStage>("idle");
  const [hash, setHash] = useState<Hex | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const deployment = isBotChainId(chainId) ? getDeployment(chainId) : null;

  const receipt = useWaitForTransactionReceipt({
    hash: hash ?? undefined,
    query: { enabled: Boolean(hash) },
  });

  const settledHash = useRef<Hex | null>(null);

  useEffect(() => {
    if (!hash || settledHash.current === hash) return;
    if (!receipt.isSuccess && !receipt.isError) return;

    settledHash.current = hash;

    if (receipt.isSuccess) {
      setStage("confirmed");
      toast("success", "Deal opened", "Escrow funded and deal created on chain.");

      if (receipt.data?.logs) {
        try {
          const logs = parseEventLogs({
            abi: holdfastAbi,
            logs: receipt.data.logs,
            eventName: "DealOpened",
          });
          if (logs[0]?.args?.id !== undefined) {
            setCreatedId(logs[0].args.id.toString());
          }
        } catch {
          // ignore log parse issues
        }
      }
    } else {
      setStage("failed");
      toast(
        "error",
        "Transaction failed",
        "Nothing was recorded. Check the explorer and try again.",
      );
    }
  }, [hash, receipt.isSuccess, receipt.isError, toast]);

  const handleCopyLink = useCallback(() => {
    if (!createdId) return;
    const url = `${window.location.origin}/deal/${createdId}`;
    void navigator.clipboard.writeText(url);
    setCopied(true);
    toast("info", "Link copied", "Share this deal link with the seller.");
    setTimeout(() => setCopied(false), 2500);
  }, [createdId, toast]);

  const handleOpen = useCallback(async () => {
    if (!deployment || !isBotChainId(chainId) || !address) return;

    const trimmedSeller = seller.trim();
    if (!isAddress(trimmedSeller)) {
      toast("error", "Invalid seller", "Please enter a valid 0x Ethereum address.");
      return;
    }

    if (trimmedSeller.toLowerCase() === address.toLowerCase()) {
      toast("error", "Seller is buyer", "The seller address cannot be your own address.");
      return;
    }

    const deadlineTimestamp = Math.floor(new Date(deadlineStr).getTime() / 1000);
    const nowSeconds = Math.floor(Date.now() / 1000);
    if (isNaN(deadlineTimestamp) || deadlineTimestamp <= nowSeconds) {
      toast("error", "Deadline in past", "The deadline must be in the future.");
      return;
    }

    const valueWei = parseNativeAmount(amountStr);
    if (!valueWei || valueWei <= 0n) {
      toast("error", "Invalid amount", "Please enter a positive amount of BOT.");
      return;
    }

    setStage("signing");
    setHash(null);
    setCreatedId(null);
    settledHash.current = null;

    try {
      const txHash = await writeContractAsync({
        address: deployment.address,
        abi: holdfastAbi,
        functionName: "open",
        args: [trimmedSeller as Address, BigInt(deadlineTimestamp)],
        value: valueWei,
        chainId,
      });
      setHash(txHash);
      setStage("pending");
    } catch (err) {
      setStage("idle");

      const reverted =
        err instanceof BaseError
          ? err.walk((e) => e instanceof ContractFunctionRevertedError)
          : null;

      if (reverted instanceof ContractFunctionRevertedError) {
        const error = reverted.data;
        if (error?.errorName === "SellerIsBuyer") {
          toast("error", "Seller is buyer", "You cannot open an escrow deal with yourself.");
          return;
        }
        if (error?.errorName === "DeadlineInPast") {
          toast("error", "Deadline in past", "The deadline must be in the future.");
          return;
        }
        if (error?.errorName === "ZeroValue") {
          toast("error", "Zero amount", "Escrow deposit must be greater than zero.");
          return;
        }
        if (error?.errorName === "ZeroAddress") {
          toast("error", "Zero address", "Seller cannot be the zero address.");
          return;
        }
      }

      const message = err instanceof BaseError ? err.shortMessage : "Something went wrong.";
      if (/rejected|denied/i.test(message)) {
        toast("info", "Cancelled", "Nothing was sent.");
      } else {
        toast("error", "Could not send", message);
      }
    }
  }, [deployment, chainId, address, seller, deadlineStr, amountStr, writeContractAsync, toast]);

  // Checked FIRST: stage === 'confirmed'
  if (stage === "confirmed") {
    return (
      <Panel>
        <div className="flex flex-col gap-4">
          <TxStatus stage="confirmed" hash={hash} confirmedLabel="Escrow Deal Opened" />

          {createdId && (
            <div
              className="flex flex-col gap-2 p-3"
              style={{
                background: "var(--bg-base)",
                border: "1px solid var(--border-subtle)",
                borderRadius: "4px",
              }}
            >
              <div className="flex items-center justify-between">
                <span
                  className="text-[11px] uppercase tracking-[0.04em]"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Deal ID
                </span>
                <span className="font-mono text-sm font-semibold text-[var(--accent)]">
                  #{createdId}
                </span>
              </div>
              <p className="text-[12px]" style={{ color: "var(--text-secondary)" }}>
                Share this deal with the seller so they can review terms and confirm.
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Link
                  href={`/deal/${createdId}`}
                  className="inline-flex items-center justify-center px-3 py-1.5 text-[11px] uppercase tracking-[0.04em] no-underline font-medium"
                  style={{
                    background: "var(--accent)",
                    color: "var(--bg-base)",
                    borderRadius: "2px",
                  }}
                >
                  View Escrow Deal
                </Link>
                <Button size="sm" variant="ghost" onClick={handleCopyLink}>
                  {copied ? "Copied!" : "Copy Deal Link"}
                </Button>
              </div>
            </div>
          )}

          <div className="pt-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setStage("idle");
                setHash(null);
                setCreatedId(null);
                setAmountStr("");
                setSeller("");
              }}
            >
              Open Another Deal
            </Button>
          </div>
        </div>
      </Panel>
    );
  }

  return (
    <BotChainGate
      noWalletNote="Opening an escrow deal requires connecting a BOT Chain wallet to fund escrow."
    >
      <Panel>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void handleOpen();
          }}
          className="flex flex-col gap-4"
        >
          <div className="flex flex-col gap-1">
            <h2 className="text-[15px] font-semibold" style={{ color: "var(--text-primary)" }}>
              Open an Escrow Deal
            </h2>
            <p className="text-[12px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
              Deposit BOT into trustless escrow. Funds release when both you and the seller confirm,
              or can be refunded to you after the deadline.
            </p>
          </div>

          <Input
            label="Seller Address"
            placeholder="0x..."
            value={seller}
            onChange={(e) => setSeller(e.target.value)}
            mono
            required
            hint="The recipient address who will confirm delivery and receive the escrowed funds."
          />

          <Input
            label="Amount (BOT)"
            placeholder="0.0"
            value={amountStr}
            onChange={(e) => setAmountStr(e.target.value)}
            mono
            suffix={activeBotChain.nativeCurrency.symbol}
            required
            hint="Amount of native BOT to deposit into escrow."
          />

          <Input
            label="Refund Deadline"
            type="datetime-local"
            value={deadlineStr}
            onChange={(e) => setDeadlineStr(e.target.value)}
            required
            hint="If both parties have not confirmed by this time, you can pull a full refund."
          />

          <div
            className="p-3 text-[12px] leading-relaxed"
            style={{
              background: "rgba(212, 168, 87, 0.08)",
              border: "1px solid rgba(212, 168, 87, 0.25)",
              borderRadius: "4px",
              color: "var(--text-primary)",
            }}
          >
            <span className="font-semibold" style={{ color: "var(--accent)" }}>
              Escrow Notice:{" "}
            </span>
            After the deadline, an unconfirmed deal can be refunded to you. Before that, funds are in escrow.
          </div>

          <div className="flex flex-col gap-2 pt-1">
            <Button
              type="submit"
              loading={stage === "signing" || stage === "pending"}
              disabled={stage === "signing" || stage === "pending"}
            >
              Fund Escrow & Open Deal
            </Button>
            <TxStatus stage={stage} hash={hash} />
          </div>
        </form>
      </Panel>
    </BotChainGate>
  );
}
