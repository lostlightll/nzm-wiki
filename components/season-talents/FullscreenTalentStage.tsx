import Image from "next/image";
import type { ReactNode } from "react";
import { getAssetPath } from "@/lib/path";

interface FullscreenTalentStageProps {
  background: string;
  backgroundAlt: string;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  imageClassName?: string;
}

export function FullscreenTalentStage({
  background,
  backgroundAlt,
  children,
  className = "",
  contentClassName = "",
  imageClassName = "object-cover",
}: FullscreenTalentStageProps) {
  return (
    <section
      className={`relative isolate min-h-[calc(100dvh-8.375rem)] w-full overflow-hidden bg-black lg:h-full lg:min-h-0 ${className}`}
    >
      <Image
        src={getAssetPath(background)}
        alt={backgroundAlt}
        fill
        priority
        sizes="100vw"
        className={imageClassName}
      />
      <div className={`absolute inset-0 z-10 ${contentClassName}`}>
        {children}
      </div>
    </section>
  );
}
