"use client";

import type { ReactNode } from "react";

function hasHoverPointer() {
  return window.matchMedia("(hover: hover) and (pointer: fine)").matches;
}

export function MultiplierBadgeStack({
  id,
  className,
  children,
}: {
  id?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <details
      id={id}
      className={`multiplier-badge-stack ${className ?? ""}`}
      onMouseEnter={event => {
        if (hasHoverPointer()) event.currentTarget.open = true;
      }}
      onMouseLeave={event => {
        if (hasHoverPointer() && !event.currentTarget.contains(document.activeElement)) {
          event.currentTarget.open = false;
        }
      }}
      onFocus={event => {
        if (event.target.matches(":focus-visible")) event.currentTarget.open = true;
      }}
      onBlur={event => {
        if (!event.currentTarget.contains(event.relatedTarget)) event.currentTarget.open = false;
      }}
      onKeyDown={event => {
        if (event.key !== "Escape") return;
        event.currentTarget.querySelector("summary")?.focus();
        event.currentTarget.open = false;
      }}
    >
      {children}
    </details>
  );
}
