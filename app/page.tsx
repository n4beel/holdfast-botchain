import PageShell from "@/components/layout/PageShell";
import Panel from "@/components/ui/Panel";
import OpenDealForm from "@/components/holdfast/OpenDealForm";
import { app } from "@/lib/app-config";
import { NAV } from "@/lib/nav";

export default function Home() {
  return (
    <PageShell title={app.name} description={app.tagline} nav={NAV}>
      <div className="flex flex-col gap-6">
        <Panel>
          <div className="flex flex-col gap-3">
            <h1 className="text-[16px] font-semibold" style={{ color: "var(--text-primary)" }}>
              Two-Party Escrow on BOT Chain
            </h1>
            <p className="text-[13px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
              Holdfast holds native BOT in escrow until both buyer and seller confirm delivery.
              Deadlock is prevented by a mandatory deadline: if either party disappears or fails to
              confirm before the deadline, the buyer can pull a complete refund.
            </p>
            <div
              className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 text-[12px]"
              style={{ color: "var(--text-secondary)" }}
            >
              <div
                className="p-3"
                style={{
                  background: "var(--bg-base)",
                  borderRadius: "4px",
                  border: "1px solid var(--border-subtle)",
                }}
              >
                <div className="font-semibold mb-1" style={{ color: "var(--accent)" }}>
                  1. Lock Deposit
                </div>
                <div>Buyer specifies the seller address, amount, and deadline to fund escrow.</div>
              </div>
              <div
                className="p-3"
                style={{
                  background: "var(--bg-base)",
                  borderRadius: "4px",
                  border: "1px solid var(--border-subtle)",
                }}
              >
                <div className="font-semibold mb-1" style={{ color: "var(--accent)" }}>
                  2. Both Confirm
                </div>
                <div>Seller and buyer confirm independently when goods or services are delivered.</div>
              </div>
              <div
                className="p-3"
                style={{
                  background: "var(--bg-base)",
                  borderRadius: "4px",
                  border: "1px solid var(--border-subtle)",
                }}
              >
                <div className="font-semibold mb-1" style={{ color: "var(--accent)" }}>
                  3. Release / Refund
                </div>
                <div>Releases to seller once both confirm, or refunds to buyer if deadline lapses.</div>
              </div>
            </div>
          </div>
        </Panel>

        <OpenDealForm />
      </div>
    </PageShell>
  );
}
