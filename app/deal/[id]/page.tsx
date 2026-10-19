import PageShell from "@/components/layout/PageShell";
import DealView from "@/components/holdfast/DealView";
import { NAV } from "@/lib/nav";

/**
 * A deal at its own URL.
 *
 * The open form hands the buyer a link of this shape to send to the seller, and before this route
 * existed every one of those links 404'd — the only page was /deal?id=N. A shared escrow link is
 * the entire point of the handoff, so it gets a real path.
 */
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return {
    title: `Deal #${id} — Holdfast`,
    description: "Read this Holdfast escrow on BOT Chain, confirm your side, release or reclaim.",
  };
}

export default async function DealByIdPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <PageShell
      nav={NAV}
      title={`Deal #${id}`}
      description="Where it has got to, and what is yours to do."
    >
      <DealView initialId={id} />
    </PageShell>
  );
}
