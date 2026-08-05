"use client";

import {
  createContext,
  useContext,
  type ReactNode,
} from "react";
import {
  getMainDamageSource,
  type ConsumerDamageSource,
  type WeaponDetailData,
  WeaponConsumerInvariantError,
} from "@/lib/weapon-consumers";

interface WeaponDetailContextValue {
  weapon: WeaponDetailData;
  mainSource?: ConsumerDamageSource;
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

  return (
    <WeaponDetailContext.Provider value={{ weapon, mainSource }}>
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
