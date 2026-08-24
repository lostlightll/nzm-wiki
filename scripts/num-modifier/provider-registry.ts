import { readFileSync } from "node:fs";
import path from "node:path";

import {
  parseMultiplierProviderRegistry,
  type MultiplierProviderRegistry,
} from "../../lib/multiplier-provider-registry";

export const MULTIPLIER_PROVIDER_REGISTRY_PATH = path.join(
  process.cwd(),
  "data",
  "guides",
  "multiplier-providers.json",
);

export function loadMultiplierProviderRegistry(): MultiplierProviderRegistry {
  return parseMultiplierProviderRegistry(
    JSON.parse(readFileSync(MULTIPLIER_PROVIDER_REGISTRY_PATH, "utf8")),
  );
}
