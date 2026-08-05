"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { WeaponCard } from "@/components/WeaponCard";
import type { WeaponCatalogEntry } from "@/lib/weapon-consumers";

const GAP = 20;

interface ItemPosition {
  x: number;
  y: number;
}

interface MasonryLayout {
  columns: number;
  height: number;
  positions: Record<string, ItemPosition>;
  ready: boolean;
  entryId: number;
}

function layoutsEqual(current: MasonryLayout, next: MasonryLayout) {
  if (
    !current.ready ||
    current.columns !== next.columns ||
    current.height !== next.height ||
    current.entryId !== next.entryId
  ) {
    return false;
  }

  const currentKeys = Object.keys(current.positions);
  const nextKeys = Object.keys(next.positions);
  if (currentKeys.length !== nextKeys.length) return false;

  return nextKeys.every((key) => {
    const currentPosition = current.positions[key];
    const nextPosition = next.positions[key];
    return (
      currentPosition?.x === nextPosition.x &&
      currentPosition?.y === nextPosition.y
    );
  });
}

export function WeaponMasonry({
  weapons,
  columnCount,
}: {
  weapons: WeaponCatalogEntry[];
  columnCount: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef(new Map<string, HTMLDivElement>());

  const [layout, setLayout] = useState<MasonryLayout>({
    columns: 0,
    height: 0,
    positions: {},
    ready: false,
    entryId: 0,
  });
  const [positionAnimationEntryId, setPositionAnimationEntryId] = useState<number | null>(null);
  const layoutGenerationRef = useRef(0);

  const setItemRef = useCallback((slug: string, element: HTMLDivElement | null) => {
    if (element) {
      itemRefs.current.set(slug, element);
    } else {
      itemRefs.current.delete(slug);
    }
  }, []);

  const itemWidth = `calc((100% - ${(columnCount - 1) * GAP}px) / ${columnCount})`;
  const layoutMatchesItems =
    layout.ready &&
    layout.columns === columnCount &&
    Object.keys(layout.positions).length === weapons.length &&
    weapons.every((weapon) => layout.positions[weapon.slug]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let animationFrame = 0;
    const entryId = ++layoutGenerationRef.current;

    const updateLayout = () => {
      cancelAnimationFrame(animationFrame);
      animationFrame = requestAnimationFrame(() => {
        const containerWidth = container.clientWidth;
        const columnWidth =
          (containerWidth - (columnCount - 1) * GAP) / columnCount;
        const columnHeights = Array.from({ length: columnCount }, () => 0);
        const positions: Record<string, ItemPosition> = {};

        weapons.forEach((weapon, index) => {
          const element = itemRefs.current.get(weapon.slug);
          if (!element) return;

          const column = index % columnCount;
          positions[weapon.slug] = {
            x: column * (columnWidth + GAP),
            y: columnHeights[column],
          };
          columnHeights[column] += element.offsetHeight + GAP;
        });

        const nextLayout: MasonryLayout = {
          columns: columnCount,
          height: Math.max(0, ...columnHeights) - (weapons.length ? GAP : 0),
          positions,
          ready: true,
          entryId,
        };

        setLayout((current) =>
          layoutsEqual(current, nextLayout) ? current : nextLayout,
        );
      });
    };

    const resizeObserver = new ResizeObserver(updateLayout);
    resizeObserver.observe(container);
    itemRefs.current.forEach((element) => resizeObserver.observe(element));
    updateLayout();

    return () => {
      cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
    };
  }, [columnCount, weapons]);

  useEffect(() => {
    if (!layoutMatchesItems) return;

    const positionAnimationTimer = window.setTimeout(() => {
      setPositionAnimationEntryId(layout.entryId);
    }, 300);

    return () => {
      window.clearTimeout(positionAnimationTimer);
    };
  }, [layout.entryId, layoutMatchesItems]);

  return (
    <div
      ref={containerRef}
      className={
        layoutMatchesItems
          ? `relative${positionAnimationEntryId === layout.entryId ? " transition-[height] duration-200 ease-out motion-reduce:transition-none" : ""}`
          : "grid grid-cols-1 items-start gap-5 md:grid-cols-2 xl:grid-cols-3"
      }
      style={layoutMatchesItems ? { height: layout.height } : undefined}
    >
      {weapons.map((weapon) => {
        const position = layout.positions[weapon.slug];
        return (
          <div
            key={weapon.slug}
            ref={(element) => setItemRef(weapon.slug, element)}
            className={
              layoutMatchesItems
                ? `absolute left-0 top-0${positionAnimationEntryId === layout.entryId ? " transition-transform duration-200 ease-out motion-reduce:transition-none" : ""}`
                : "min-w-0"
            }
            style={
              layoutMatchesItems && position
                ? {
                    width: itemWidth,
                    transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
                  }
                : undefined
            }
          >
            <WeaponCard weapon={weapon} showDetails />
          </div>
        );
      })}
    </div>
  );
}
