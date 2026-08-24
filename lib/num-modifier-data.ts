import rawLock from "@/data/num-modifier-lock.json";
import { parseNumModifierDataLock } from "@/lib/num-modifier-data-lock";
import { createNumModifierResolver } from "@/lib/num-modifier";

export const NUM_MODIFIER_LOCK = parseNumModifierDataLock(rawLock);
export const NUM_MODIFIER_RESOLVER = createNumModifierResolver(NUM_MODIFIER_LOCK);
