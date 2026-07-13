"use client";

import { useEffect } from "react";
import { SearchPalette } from "./SearchPalette";

const OPEN_SEARCH_EVENT = "nzm:open-search";

export function DeferredSearchPalette() {
  useEffect(() => {
    const timer = window.setTimeout(() => {
      window.dispatchEvent(new Event(OPEN_SEARCH_EVENT));
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  return <SearchPalette />;
}
