import rawLock from "@/data/num-modifier-lock.json";
import rawSemantics from "@/data/num-modifier-semantics.json";
import { parseNumModifierDataLock } from "@/lib/num-modifier-data-lock";
import { createNumModifierResolver } from "@/lib/num-modifier";
import { parseNumModifierSemantics } from "@/lib/num-modifier-semantics";

export const NUM_MODIFIER_LOCK = parseNumModifierDataLock(rawLock);
export const NUM_MODIFIER_SEMANTICS = parseNumModifierSemantics(rawSemantics);
export const NUM_MODIFIER_RESOLVER = createNumModifierResolver(
  NUM_MODIFIER_LOCK,
  NUM_MODIFIER_SEMANTICS,
);
