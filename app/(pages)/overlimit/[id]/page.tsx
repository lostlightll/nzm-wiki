import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OverlimitCardDetail } from "@/components/OverlimitCardDetail";
import { TriggerDamagePanel } from "@/components/TriggerDamageCatalog";
import {
  getAllOverlimitCards,
  getOverlimitCardById,
} from "@/lib/overlimit-cards";
import { getTriggerDamageByOverlimitId } from "@/lib/trigger-damage";

const cards = getAllOverlimitCards();

export function generateStaticParams() {
  return cards.map((card) => ({ id: card.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const card = getOverlimitCardById(id);
  if (!card) return {};

  return {
    title: card.name,
    description: `${card.name} — ${card.description}`,
    alternates: { canonical: `/overlimit/${card.id}` },
  };
}

export default async function OverlimitCardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const card = getOverlimitCardById(id);
  if (!card) notFound();
  const triggerDamage = getTriggerDamageByOverlimitId(id);

  return (
    <div className="mx-auto max-w-4xl py-6">
      <OverlimitCardDetail card={card} />
      {triggerDamage && <TriggerDamagePanel entry={triggerDamage} />}
    </div>
  );
}
