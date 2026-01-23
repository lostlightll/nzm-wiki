"use client";

import { useState } from "react";

export function useSelection<T>() {
  const [selected, setSelected] = useState<Set<T>>(new Set());

  const toggle = (item: T) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(item)) next.delete(item);
      else next.add(item);
      return next;
    });
  };

  return { selected, toggle };
}
