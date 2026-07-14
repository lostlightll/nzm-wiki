"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";

function getStorageKey(pathname: string, key: string) {
  return `filter:${pathname}:${key}`;
}

// Subscribe to sessionStorage changes within the same tab
const listeners = new Set<() => void>();
function emitChange() {
  for (const listener of listeners) listener();
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useSelection<T extends string | number>(
  key: string,
  initial?: T[],
  parse?: (value: string) => T,
) {
  const pathname = usePathname();
  const storageKey = getStorageKey(pathname, key);

  const selected = useSyncExternalStore(
    subscribe,
    () => sessionStorage.getItem(storageKey),
    () => null,
  );

  const parsed = useMemo(() => {
    if (selected !== null) {
      if (!selected) return new Set<T>();
      const values = selected.split(",").map((v) => (parse ? parse(v) : (v as T)));
      return new Set(values);
    }
    return new Set(initial);
  }, [selected, initial, parse]);

  const update = useCallback(
    (next: Set<T>) => {
      if (next.size === 0) {
        sessionStorage.setItem(storageKey, "");
      } else {
        sessionStorage.setItem(storageKey, [...next].join(","));
      }
      emitChange();
    },
    [storageKey],
  );

  const toggle = useCallback(
    (item: T) => {
      const next = new Set(parsed);
      if (next.has(item)) next.delete(item);
      else next.add(item);
      update(next);
    },
    [parsed, update],
  );

  const clear = useCallback(() => {
    update(new Set());
  }, [update]);

  const selectOnly = useCallback(
    (item?: T) => {
      update(item === undefined ? new Set() : new Set([item]));
    },
    [update],
  );

  return { selected: parsed, toggle, clear, selectOnly };
}
