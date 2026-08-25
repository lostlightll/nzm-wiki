import {
  checkModifierRuntimeProjections,
  writeModifierRuntimeProjections,
} from "./project";

try {
  const command = process.argv[2];
  if (command === "write") {
    writeModifierRuntimeProjections();
    console.log("Modifier runtime projections written.");
  } else if (command === "check") {
    const issues = checkModifierRuntimeProjections();
    if (issues.length > 0) throw new Error(issues.join("\n"));
    console.log("Modifier runtime projections are current.");
  } else {
    throw new Error("Usage: project-cli.ts <write|check>");
  }
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
