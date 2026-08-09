import { getSummonCatalog } from "@/lib/summons";
import { SummonCompendiumClient } from "./SummonCompendiumClient";

export async function SummonCompendium() {
  const catalog = await getSummonCatalog();
  return <SummonCompendiumClient catalog={catalog} />;
}
