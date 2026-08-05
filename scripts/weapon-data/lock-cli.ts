import {
  checkWeaponDataLock,
  readWeaponDataLock,
  refreshWeaponDataLock,
  WeaponDataLockOperationError,
} from "./lock";

function printList(label: string, values: readonly string[]): void {
  if (values.length === 0) return;
  console.log(`${label} (${values.length})`);
  for (const value of values) console.log(`  - ${value}`);
}

function runRefresh(): void {
  const result = refreshWeaponDataLock();
  printList("Added", result.diff.added);
  printList("Removed / unused", result.diff.removed);
  printList("Changed fields", result.diff.changed);
  printList("Settlement Tag changes", result.diff.settlementChanges);
  printList("Source hash changes", result.diff.sourceHashChanges);
  printList("Warnings", result.warnings);
  console.log(`Weapon Data Lock refreshed: ${result.lockPath}`);
}

function runCheck(): void {
  const lock = readWeaponDataLock();
  const result = checkWeaponDataLock({ lock });
  printList("Warnings", result.warnings);
  if (!result.ok) {
    printList("Errors", result.issues);
    process.exitCode = 1;
    return;
  }
  console.log("Weapon Data Lock is consistent with all V2 MDX references.");
}

try {
  const command = process.argv[2];
  if (command === "refresh") runRefresh();
  else if (command === "check") runCheck();
  else {
    console.error("Usage: lock-cli.ts <refresh|check>");
    process.exitCode = 1;
  }
} catch (error) {
  if (error instanceof WeaponDataLockOperationError) {
    printList("Errors", error.issues);
  } else {
    console.error(error);
  }
  process.exitCode = 1;
}
