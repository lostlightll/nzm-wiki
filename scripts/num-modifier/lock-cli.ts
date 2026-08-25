import {
  auditNumModifierDataLock,
  checkNumModifierDataLock,
  readNumModifierDataLock,
  refreshNumModifierDataLock,
} from "./lock";
import { writeModifierRuntimeProjections } from "./project";

function printList(label: string, values: readonly string[]): void {
  if (values.length === 0) return;
  console.log(`${label} (${values.length})`);
  for (const value of values) console.log(`  - ${value}`);
}

function fail(issues: readonly string[]): void {
  printList("Errors", issues);
  process.exitCode = 1;
}

function runRefresh(): void {
  const result = refreshNumModifierDataLock();
  const checked = checkNumModifierDataLock(result.lock);
  printList("Warnings", checked.warnings);
  if (!checked.ok) return fail(checked.issues);
  writeModifierRuntimeProjections();
  printList("Changes", result.differences);
  console.log(
    `Num Modifier Lock and runtime projections refreshed: ${result.lock.sources.lc.modifiers.row_count} rows, sha256=${result.lock.sources.lc.modifiers.sha256}, changed=${result.changed}`,
  );
}

function runCheck(): void {
  const result = checkNumModifierDataLock(readNumModifierDataLock());
  printList("Warnings", result.warnings);
  if (!result.ok) return fail(result.issues);
  console.log("Num Modifier Lock is valid.");
}

function runAudit(): void {
  const result = auditNumModifierDataLock();
  printList("Warnings", result.warnings);
  if (!result.ok) return fail(result.issues);
  console.log(
    `Num Modifier Lock matches both LC source tables; game tokens resolved ${result.resolvedTokenCount}/${result.tokenCount}; ` +
      `attributes connected ${result.connectedAttributeNameCount}/${result.attributeNameCount}, missing ${result.missingAttributeNameCount}; ` +
      `${result.unresolvedOperationRowCount} rows use operations without a global formula.`,
  );
}

try {
  const command = process.argv[2];
  if (command === "refresh") runRefresh();
  else if (command === "check") runCheck();
  else if (command === "audit") runAudit();
  else {
    console.error("Usage: lock-cli.ts <refresh|check|audit>");
    process.exitCode = 1;
  }
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
