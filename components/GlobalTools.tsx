"use client";

import { useState, useCallback } from "react";
import { Calculator } from "./Calculator";
import { CommandPalette, useCommands } from "./CommandPalette";
import { SearchPalette } from "./SearchPalette";

export function GlobalTools() {
  const [calculatorOpen, setCalculatorOpen] = useState(false);

  const openCalculator = useCallback(() => {
    setCalculatorOpen(true);
  }, []);

  const commands = useCommands({
    onOpenCalculator: openCalculator,
  });

  return (
    <>
      <Calculator
        externalOpen={calculatorOpen}
        onOpenChange={setCalculatorOpen}
      />
      <CommandPalette commands={commands} />
      <SearchPalette />
    </>
  );
}
