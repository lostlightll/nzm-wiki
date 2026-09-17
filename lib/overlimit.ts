import rawCatalog from "@/data/overlimit/current.json";
import { parseOverlimitCatalog } from "@/lib/overlimit-catalog";

const catalog = parseOverlimitCatalog(rawCatalog);

export function getOverlimitCatalog() {
  return catalog;
}
