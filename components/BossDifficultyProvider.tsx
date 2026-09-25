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
import { getOriginRooms, type OriginDifficulty } from "@/lib/origin-boss-health";

export type BossMode = "classic" | "origin";

interface BossDifficultyContextValue {
  difficulty: BossDifficulty;
  ready: boolean;
  setDifficulty: (difficulty: BossDifficulty) => void;
  withDifficulty: (href: string) => string;
  mode: BossMode;
  setMode: (mode: BossMode) => void;
  roomIndex: number | null;
  setRoomIndex: (index: number | null) => void;
}

const BossDifficultyContext = createContext<BossDifficultyContextValue | null>(
  null,
);

function isBossRoute(pathname: string): boolean {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
  if (basePath && pathname.startsWith(`${basePath}/`)) {
    pathname = pathname.slice(basePath.length);
  }
  return (
    pathname === "/bosses" ||
    pathname.startsWith("/bosses/") ||
    pathname === "/enemies/lc" ||
    pathname.startsWith("/enemies/lc/")
  );
}

function replaceSelectionInUrl(difficulty: BossDifficulty, mode: BossMode, roomIndex: number | null): void {
  const url = new URL(window.location.href);
  url.searchParams.set("difficulty", difficulty);
  if (mode === "origin") {
    url.searchParams.set("mode", mode);
    if (roomIndex !== null) url.searchParams.set("room", String(roomIndex));
    else url.searchParams.delete("room");
  } else {
    url.searchParams.delete("mode");
    url.searchParams.delete("room");
  }
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
  const [mode, setModeState] = useState<BossMode>("classic");
  const [roomIndex, setRoomIndexState] = useState<number | null>(null);
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
    let nextDifficulty = urlValue
      ? isBossDifficulty(urlValue)
        ? urlValue
        : DEFAULT_BOSS_DIFFICULTY
      : isBossDifficulty(saved)
        ? saved
        : DEFAULT_BOSS_DIFFICULTY;
    const params = new URL(window.location.href).searchParams;
    const nextMode: BossMode = isBossRoute(window.location.pathname) &&
      window.location.pathname.includes("/bosses") && params.get("mode") === "origin" ? "origin" : "classic";
    if (nextMode === "origin" && nextDifficulty === "overlimit") nextDifficulty = "torment";
    const parsedRoom = Number(params.get("room"));
    const nextRoom = nextMode === "origin" && params.has("room") &&
      Number.isInteger(parsedRoom) && parsedRoom >= 0 &&
      parsedRoom < getOriginRooms(nextDifficulty as OriginDifficulty).length
      ? parsedRoom : null;

    try {
      window.localStorage.setItem(
        BOSS_DIFFICULTY_STORAGE_KEY,
        nextDifficulty,
      );
    } catch {
      // URL persistence still works when localStorage is unavailable.
    }

    setDifficultyState(nextDifficulty);
    setModeState(nextMode);
    setRoomIndexState(nextRoom);
    setReady(true);

    if (isBossRoute(window.location.pathname)) {
      replaceSelectionInUrl(nextDifficulty, nextMode, nextRoom);
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
    if (mode === "origin" && nextDifficulty === "overlimit") return;
    setDifficultyState(nextDifficulty);
    setRoomIndexState(null);
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
      replaceSelectionInUrl(nextDifficulty, mode, null);
    }
  }, [mode]);

  const setMode = useCallback((nextMode: BossMode) => {
    const nextDifficulty = nextMode === "origin" && difficulty === "overlimit" ? "torment" : difficulty;
    setModeState(nextMode);
    setDifficultyState(nextDifficulty);
    setRoomIndexState(null);
    replaceSelectionInUrl(nextDifficulty, nextMode, null);
  }, [difficulty]);

  const setRoomIndex = useCallback((index: number | null) => {
    setRoomIndexState(index);
    replaceSelectionInUrl(difficulty, mode, index);
  }, [difficulty, mode]);

  const withDifficulty = useCallback(
    (href: string) => {
      const [pathAndQuery, hash = ""] = href.split("#", 2);
      const [targetPath, query = ""] = pathAndQuery.split("?", 2);
      const params = new URLSearchParams(query);
      params.set("difficulty", difficulty);
      if (targetPath.startsWith("/bosses") && mode === "origin") {
        params.set("mode", "origin");
        if (roomIndex !== null) params.set("room", String(roomIndex));
      }
      return `${targetPath}?${params.toString()}${hash ? `#${hash}` : ""}`;
    },
    [difficulty, mode, roomIndex],
  );

  const value = useMemo(
    () => ({ difficulty, ready, setDifficulty, withDifficulty, mode, setMode, roomIndex, setRoomIndex }),
    [difficulty, ready, setDifficulty, withDifficulty, mode, setMode, roomIndex, setRoomIndex],
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
