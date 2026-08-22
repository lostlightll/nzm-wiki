"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";
import { getAssetPath } from "@/lib/path";

export default function PagesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isSeasonTalentDetail = pathname.startsWith("/guides/season-talents/");
  const seasonTalentVersion = pathname.split("/")[3];
  const isFullSeasonTalentDetail =
    isSeasonTalentDetail && seasonTalentVersion !== "s3";
  const isSeasonTalentsLanding = pathname === "/season-talents";
  const isGuidesLanding =
    pathname === "/guides" ||
    pathname === "/multiplier" ||
    pathname === "/season-talents" ||
    pathname === "/posts";

  return (
    <div
      className={`relative min-h-[calc(100dvh-3.5rem)] ${
        isFullSeasonTalentDetail
          ? "overflow-x-clip bg-[#03101a] lg:h-[calc(100dvh-3.5rem)] lg:overflow-hidden"
          : isGuidesLanding
            ? "bg-[#0b0e10]"
            : "bg-background"
      }`}
    >
      {isSeasonTalentDetail && !isFullSeasonTalentDetail && (
        <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0">
          <Image
            src={getAssetPath("/webp/images/season-talents/s3/T_FX_TalentS3_08.webp")}
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-[#071018]/20" />
        </div>
      )}
      <main
        className={`relative z-10 mx-auto w-full ${
          isSeasonTalentsLanding ? "" : "xl:-left-8 2xl:-left-14"
        } ${
          isFullSeasonTalentDetail
            ? "max-w-[1600px] px-4 py-3 sm:px-6 lg:h-[calc(100dvh-3.5rem)] xl:w-[calc(100%-4rem)] xl:px-12"
            : isSeasonTalentsLanding
              ? "max-w-none p-0 lg:h-[calc(100dvh-3.5rem)]"
            : isSeasonTalentDetail
            ? "max-w-[1600px] px-4 py-4 sm:px-6 xl:w-[calc(100%-4rem)] xl:px-12"
            : isGuidesLanding
              ? "max-w-[1440px] px-4 py-6 sm:px-6 sm:py-7 xl:w-[calc(100%-4rem)] xl:py-3"
              : "max-w-7xl px-4 py-8 xl:w-[calc(100%-4rem)]"
        }`}
      >
        {children}
      </main>
    </div>
  );
}
