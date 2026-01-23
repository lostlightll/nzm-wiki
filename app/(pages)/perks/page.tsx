import { getAllPerks } from "@/lib/perks";
import PerksPageClient from "./client";

export default function PerksPage() {
  const perks = getAllPerks();
  return <PerksPageClient initialPerks={perks} />;
}
