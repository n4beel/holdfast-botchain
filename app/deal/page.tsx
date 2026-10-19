import PageShell from "@/components/layout/PageShell";
import DealView from "@/components/holdfast/DealView";
import MyDeals from "@/components/holdfast/MyDeals";
import { NAV } from "@/lib/nav";

export const metadata = {
  title: "Deals — Holdfast",
  description: "Your Holdfast escrows on BOT Chain, and any deal by number.",
};

export default function DealPage() {
  return (
    <PageShell
      nav={NAV}
      title="Deals"
      description="Every escrow this wallet is a party to, and any deal by number."
    >
      <div className="flex flex-col gap-5">
        {/* Your own first: the number is the only other way back to a deal, and nobody notes it. */}
        <MyDeals />
        <DealView />
      </div>
    </PageShell>
  );
}
