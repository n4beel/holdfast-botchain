import PageShell from "@/components/layout/PageShell";
import DealView from "@/components/holdfast/DealView";
import { NAV } from "@/lib/nav";

export const metadata = {
  title: "Open a deal — Holdfast",
  description: "Read any Holdfast escrow on BOT Chain, confirm your side, release or reclaim.",
};

export default function DealPage() {
  return (
    <PageShell nav={NAV} title="A deal" description="Enter its number to see where it has got to and what is yours to do.">
      <DealView />
    </PageShell>
  );
}
