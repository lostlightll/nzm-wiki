import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OverlimitCardDetail } from "@/components/OverlimitCardDetail";
import overlimitCards from "@/data/overlimit-cards.json";
import type { OverlimitCard } from "@/types";

const cards = overlimitCards as OverlimitCard[];

export function generateStaticParams() {
  return cards.map((card) => ({ id: card.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const card = cards.find((item) => item.id === id);
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
  const card = cards.find((item) => item.id === id);
  if (!card) notFound();

  return (
    <div className="mx-auto max-w-4xl py-6">
      <OverlimitCardDetail card={card} />
    </div>
  );
}
