"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import { Calculator as CalculatorIcon } from "lucide-react";

const OPEN_SEARCH_EVENT = "nzm:open-search";
const OPEN_COMMAND_EVENT = "nzm:open-command-palette";
const OPEN_CALCULATOR_EVENT = "nzm:open-calculator";

const DeferredCalculator = dynamic<{
  externalOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}>(() => import("./Calculator").then((module) => module.Calculator), {
  ssr: false,
});

const DeferredCommandPalette = dynamic<{
  onOpenCalculator: () => void;
}>(
  () =>
    import("./DeferredCommandPalette").then(
      (module) => module.DeferredCommandPalette,
    ),
  { ssr: false },
);

const DeferredSearchPalette = dynamic(
  () =>
    import("./DeferredSearchPalette").then(
      (module) => module.DeferredSearchPalette,
    ),
  { ssr: false },
);

export function GlobalTools() {
  const [calculatorMounted, setCalculatorMounted] = useState(false);
  const [calculatorOpen, setCalculatorOpen] = useState(false);
  const [commandPaletteMounted, setCommandPaletteMounted] = useState(false);
  const [searchPaletteMounted, setSearchPaletteMounted] = useState(false);

  const openCalculator = useCallback(() => {
    setCalculatorMounted(true);
    setCalculatorOpen(true);
  }, []);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (
        !(event.ctrlKey || event.metaKey) ||
        event.key.toLowerCase() !== "p"
      ) {
        return;
      }

      event.preventDefault();
      if (event.shiftKey) setCommandPaletteMounted(true);
      else setSearchPaletteMounted(true);
    };

    const mountSearchPalette = () => setSearchPaletteMounted(true);
    const mountCommandPalette = () => setCommandPaletteMounted(true);

    document.addEventListener("keydown", handleShortcut);
    window.addEventListener(OPEN_SEARCH_EVENT, mountSearchPalette);
    window.addEventListener(OPEN_COMMAND_EVENT, mountCommandPalette);
    window.addEventListener(OPEN_CALCULATOR_EVENT, openCalculator);

    return () => {
      document.removeEventListener("keydown", handleShortcut);
      window.removeEventListener(OPEN_SEARCH_EVENT, mountSearchPalette);
      window.removeEventListener(OPEN_COMMAND_EVENT, mountCommandPalette);
      window.removeEventListener(OPEN_CALCULATOR_EVENT, openCalculator);
    };
  }, [openCalculator]);

  return (
    <>
      {!calculatorMounted && (
        <button
          type="button"
          onClick={openCalculator}
          aria-label="打开计算器"
          title="计算器"
          className="fixed bottom-4 right-4 z-50 hidden h-12 w-12 items-center justify-center rounded-full bg-zinc-800 text-zinc-300 shadow-lg ring-1 ring-zinc-700 transition-colors hover:bg-zinc-700 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white md:flex"
        >
          <CalculatorIcon className="h-6 w-6" aria-hidden="true" />
        </button>
      )}

      {calculatorMounted && (
        <DeferredCalculator
          externalOpen={calculatorOpen}
          onOpenChange={setCalculatorOpen}
        />
      )}
      {commandPaletteMounted && (
        <DeferredCommandPalette onOpenCalculator={openCalculator} />
      )}
      {searchPaletteMounted && <DeferredSearchPalette />}
    </>
  );
}
