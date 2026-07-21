"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { usePathname } from "next/navigation";
import {
  BOSS_DIFFICULTY_STORAGE_KEY,
  DEFAULT_BOSS_DIFFICULTY,
  isBossDifficulty,
} from "@/lib/boss-health";
import type { BossDifficulty } from "@/types";

interface BossDifficultyContextValue {
  difficulty: BossDifficulty;
  ready: boolean;
  setDifficulty: (difficulty: BossDifficulty) => void;
  withDifficulty: (href: string) => string;
}

const BossDifficultyContext = createContext<BossDifficultyContextValue | null>(
  null,
);

function isBossRoute(pathname: string): boolean {
  return (
    pathname === "/bosses" ||
    pathname.startsWith("/bosses/") ||
    pathname === "/enemies/lc" ||
    pathname.startsWith("/enemies/lc/")
  );
}

function replaceDifficultyInUrl(difficulty: BossDifficulty): void {
  const url = new URL(window.location.href);
  url.searchParams.set("difficulty", difficulty);
  window.history.replaceState(window.history.state, "", url);
}

export function BossDifficultyProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [storedDifficulty, setDifficultyState] = useState<BossDifficulty>(
    DEFAULT_BOSS_DIFFICULTY,
  );
  const [ready, setReady] = useState(false);
  const difficulty = (() => {
    if (!ready || typeof window === "undefined") return storedDifficulty;
    if (!isBossRoute(window.location.pathname)) return storedDifficulty;

    const urlValue = new URL(window.location.href).searchParams.get(
      "difficulty",
    );
    if (urlValue === null) return storedDifficulty;
    return isBossDifficulty(urlValue) ? urlValue : DEFAULT_BOSS_DIFFICULTY;
  })();

  const syncFromLocation = useCallback(() => {
    let saved: string | null = null;
    try {
      saved = window.localStorage.getItem(BOSS_DIFFICULTY_STORAGE_KEY);
    } catch {
      // Storage can be unavailable in privacy-restricted contexts.
    }

    const urlValue = new URL(window.location.href).searchParams.get(
      "difficulty",
    );
    const nextDifficulty = urlValue
      ? isBossDifficulty(urlValue)
        ? urlValue
        : DEFAULT_BOSS_DIFFICULTY
      : isBossDifficulty(saved)
        ? saved
        : DEFAULT_BOSS_DIFFICULTY;

    try {
      window.localStorage.setItem(
        BOSS_DIFFICULTY_STORAGE_KEY,
        nextDifficulty,
      );
    } catch {
      // URL persistence still works when localStorage is unavailable.
    }

    setDifficultyState(nextDifficulty);
    setReady(true);

    if (isBossRoute(window.location.pathname) && urlValue !== nextDifficulty) {
      replaceDifficultyInUrl(nextDifficulty);
    }
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(syncFromLocation, 0);
    return () => window.clearTimeout(timeout);
  }, [pathname, syncFromLocation]);

  useEffect(() => {
    window.addEventListener("popstate", syncFromLocation);
    return () => window.removeEventListener("popstate", syncFromLocation);
  }, [syncFromLocation]);

  const setDifficulty = useCallback((nextDifficulty: BossDifficulty) => {
    setDifficultyState(nextDifficulty);
    setReady(true);
    try {
      window.localStorage.setItem(
        BOSS_DIFFICULTY_STORAGE_KEY,
        nextDifficulty,
      );
    } catch {
      // URL persistence still works when localStorage is unavailable.
    }
    if (isBossRoute(window.location.pathname)) {
      replaceDifficultyInUrl(nextDifficulty);
    }
  }, []);

  const withDifficulty = useCallback(
    (href: string) => {
      const [pathAndQuery, hash = ""] = href.split("#", 2);
      const [targetPath, query = ""] = pathAndQuery.split("?", 2);
      const params = new URLSearchParams(query);
      params.set("difficulty", difficulty);
      return `${targetPath}?${params.toString()}${hash ? `#${hash}` : ""}`;
    },
    [difficulty],
  );

  const value = useMemo(
    () => ({ difficulty, ready, setDifficulty, withDifficulty }),
    [difficulty, ready, setDifficulty, withDifficulty],
  );

  return (
    <BossDifficultyContext.Provider value={value}>
      {children}
    </BossDifficultyContext.Provider>
  );
}

export function useBossDifficulty(): BossDifficultyContextValue {
  const context = useContext(BossDifficultyContext);
  if (!context) {
    throw new Error(
      "useBossDifficulty must be used inside BossDifficultyProvider",
    );
  }
  return context;
}
