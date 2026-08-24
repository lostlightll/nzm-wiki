import {
  checkMultiplierProviderRuntime,
  migrateMultiplierProviderRegistry,
  writeMultiplierProviderRuntime,
} from "./project";

try {
  const command = process.argv[2];
  if (command === "migrate-registry") {
    migrateMultiplierProviderRegistry();
    writeMultiplierProviderRuntime();
    console.log("Multiplier provider registry migrated and runtime projection written.");
  } else if (command === "write") {
    writeMultiplierProviderRuntime();
    console.log("Multiplier provider runtime projection written.");
  } else if (command === "check") {
    const issues = checkMultiplierProviderRuntime();
    if (issues.length > 0) throw new Error(issues.join("\n"));
    console.log("Multiplier provider runtime projection is current.");
  } else {
    throw new Error("Usage: project-cli.ts <migrate-registry|write|check>");
  }
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
