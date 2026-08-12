"use client";

import { useState } from "react";
import { getAssetPath } from "@/lib/path";
import { ImageViewer } from "./ImageViewer";

// prettier-ignore
const imageIds = [
  "04", "05", "06", "07", "08", "09", "10", "11", "12", "13",
  "14", "15", "16", "17", "18", "19", "20", "21", "22", "23",
  "24", "25", "26", "27", "30", "31", "32", "33", "34", "35",
  "36", "37", "38", "39", "40", "43", "44", "45", "46", "47",
  "48", "49", "50", "51", "52", "53", "54", "55", "56", "57",
  "58", "59", "60", "62", "63", "64", "65", "66", "67", "68",
  "69", "70", "71", "72", "73", "74", "75", "76", "77", "78",
  "79", "80", "81", "82", "83"
];

const images = imageIds.map((id) => ({
  src: `/webp/icons/peekaboo/${id}.webp`,
  pngSrc: `/icons/peekaboo/${id}.png`,
  alt: `物品 ${id}`,
}));

export function PeekabooGrid() {
  const [viewerOpen, setViewerOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const handleImageClick = (index: number) => {
    setSelectedIndex(index);
    setViewerOpen(true);
  };

  return (
    <>
      <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2 p-4 rounded-lg border border-zinc-700">
        {images.map((image, index) => (
          <div
            key={imageIds[index]}
            className="flex flex-col items-center cursor-pointer group"
            onClick={() => handleImageClick(index)}
          >
            <img
              src={getAssetPath(image.src)}
              alt={image.alt}
              width={512}
              height={512}
              className="w-full h-auto rounded transition-transform group-hover:scale-105"
            />
            {/* 我决定不显示 caption */}
            {/* <span className="text-xs text-zinc-500 mt-1">{imageIds[index]}</span> */}
          </div>
        ))}
      </div>

      {viewerOpen && (
        <ImageViewer
          images={images}
          initialIndex={selectedIndex}
          onClose={() => setViewerOpen(false)}
        />
      )}
    </>
  );
}
