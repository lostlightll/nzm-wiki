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
  const options: { weaponTitle?: string; contentRoot?: string } = {};
  const args = process.argv.slice(3);
  for (let index = 0; index < args.length; index += 2) {
    const flag = args[index];
    const value = args[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`missing value for ${flag}`);
    if (flag === "--weapon" && options.weaponTitle === undefined) options.weaponTitle = value;
    else if (flag === "--content-root" && options.contentRoot === undefined) options.contentRoot = value;
    else throw new Error(`unknown or repeated option ${flag}`);
  }
  const result = refreshWeaponDataLock(options);
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
  else if (command === "check" && process.argv.length === 3) runCheck();
  else {
    console.error("Usage: lock-cli.ts refresh [--weapon TITLE] [--content-root PATH] | check");
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
