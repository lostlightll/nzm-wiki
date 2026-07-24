import { getAllPerks } from "@/lib/perks";
import { getShanghaiDateKey } from "@/lib/date-key";
import PerksPageClient from "./client";

export default function PerksPage() {
  const perks = getAllPerks();
  return (
    <PerksPageClient
      initialPerks={perks}
      initialDateKey={getShanghaiDateKey()}
    />
  );
}
