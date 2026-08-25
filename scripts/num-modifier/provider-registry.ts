import { readFileSync } from "node:fs";
import path from "node:path";

import {
  parseModifierProviderRegistry,
  type ModifierProviderRegistry,
} from "../../lib/modifier-provider-registry";

export const MODIFIER_PROVIDER_REGISTRY_PATH = path.join(
  process.cwd(),
  "data",
  "modifier-providers.json",
);

export function loadModifierProviderRegistry(): ModifierProviderRegistry {
  return parseModifierProviderRegistry(
    JSON.parse(readFileSync(MODIFIER_PROVIDER_REGISTRY_PATH, "utf8")),
  );
}
