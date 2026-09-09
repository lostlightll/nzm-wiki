import historical from "../../data/season-talents/s2/provider-evidence.json";
import semantics from "../../data/num-modifier-semantics.json";
import { createNumModifierResolver } from "../../lib/num-modifier";
import { parseNumModifierDataLock } from "../../lib/num-modifier-data-lock";
import { parseNumModifierSemantics } from "../../lib/num-modifier-semantics";
import type { ModifierProviderRegistrySource } from "../../lib/modifier-provider-registry";

let s2Resolver: ReturnType<typeof createNumModifierResolver> | undefined;

// lc identifies the game mode; the provider's season selects its data snapshot.
// Never fall back to today's rows when an archived row is missing.
export function getProviderResolver(
  source: ModifierProviderRegistrySource,
  current: ReturnType<typeof createNumModifierResolver>,
) {
  if (source.type !== "season-talent" || source.season !== "s2") return current;
  return s2Resolver ??= createNumModifierResolver(
    parseNumModifierDataLock(historical.lock),
    parseNumModifierSemantics(semantics),
  );
}
