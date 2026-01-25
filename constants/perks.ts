import type { PerkSlot } from "@/types";

export {
  RARITY_OPTIONS,
  RARITY_KEY_MAP,
  RARITY_CARD_STYLES,
  RARITY_NUM_MAP,
} from "./common";

export const SLOT_OPTIONS: { type: PerkSlot; label: string }[] = [
  { type: 1, label: "1号槽位" },
  { type: 2, label: "2号槽位" },
  { type: 3, label: "3号槽位" },
  { type: 4, label: "4号槽位" },
];
