"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  getMainDamageSource,
  WeaponConsumerInvariantError,
  type ConsumerDamageSource,
  type WeaponDetailData,
} from "@/lib/weapon-consumers";

interface WeaponDetailContextValue {
  weapon: WeaponDetailData;
  selectedSourceId?: string;
  selectedSource?: ConsumerDamageSource;
  selectSource: (sourceId: string) => void;
}

const WeaponDetailContext = createContext<WeaponDetailContextValue | null>(null);

export function WeaponDetailProvider({
  weapon,
  children,
}: {
  weapon: WeaponDetailData;
  children: ReactNode;
}) {
  const mainSource = getMainDamageSource(weapon);
  const [selectedSourceId, setSelectedSourceId] = useState(mainSource?.id);
  const selectedSource = useMemo(() => {
    if (selectedSourceId === undefined) return undefined;
    const matches = weapon.damageSources.filter(
      (source) => source.id === selectedSourceId,
    );
    if (matches.length !== 1) {
      throw new WeaponConsumerInvariantError(
        `selectedSourceId ${selectedSourceId} matched ${matches.length} sources`,
      );
    }
    return matches[0];
  }, [selectedSourceId, weapon.damageSources]);

  const value = useMemo<WeaponDetailContextValue>(
    () => ({
      weapon,
      selectedSourceId,
      selectedSource,
      selectSource: (sourceId) => {
        if (!weapon.damageSources.some((source) => source.id === sourceId)) {
          throw new WeaponConsumerInvariantError(
            `cannot select unknown damage source ${sourceId}`,
          );
        }
        setSelectedSourceId(sourceId);
      },
    }),
    [selectedSource, selectedSourceId, weapon],
  );

  return (
    <WeaponDetailContext.Provider value={value}>
      {children}
    </WeaponDetailContext.Provider>
  );
}

export function useWeaponDetail(): WeaponDetailContextValue {
  const value = useContext(WeaponDetailContext);
  if (!value) {
    throw new WeaponConsumerInvariantError(
      "weapon detail consumer must be inside WeaponDetailProvider",
    );
  }
  return value;
}
