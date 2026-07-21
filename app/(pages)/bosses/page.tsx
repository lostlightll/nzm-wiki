import { BossCatalog } from "@/components/BossCatalog";
import { bossCatalogMetadata } from "@/lib/boss-routes";
import { getAllBosses } from "@/lib/bosses";

export const metadata = bossCatalogMetadata;

export default async function BossesPage() {
  const bosses = await getAllBosses();
  return <BossCatalog bosses={bosses} />;
}
