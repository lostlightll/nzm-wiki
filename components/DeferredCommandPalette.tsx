"use client";

import { useEffect } from "react";
import { CommandPalette, useCommands } from "./CommandPalette";

export function DeferredCommandPalette({
  onOpenCalculator,
}: {
  onOpenCalculator: () => void;
}) {
  const commands = useCommands({ onOpenCalculator });

  useEffect(() => {
    const timer = window.setTimeout(() => {
      document.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "p",
          ctrlKey: true,
          shiftKey: true,
          bubbles: true,
        }),
      );
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  return <CommandPalette commands={commands} />;
}
