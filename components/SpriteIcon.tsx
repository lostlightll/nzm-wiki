"use client";

import { useEffect, useRef } from "react";
import { SPRITE_SHEETS, type SpriteConfig } from "@/constants/sprites";
import { getAssetPath } from "@/lib/path";

interface SpriteIconProps {
  sprite?: SpriteConfig;
  size?: number;
  className?: string;
}

// 缓存已加载的精灵图图片
const imageCache = new Map<string, HTMLImageElement>();

function loadImage(src: string): Promise<HTMLImageElement> {
  const cached = imageCache.get(src);
  if (cached?.complete) return Promise.resolve(cached);

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      imageCache.set(src, img);
      resolve(img);
    };
    img.onerror = reject;
    img.src = src;
  });
}

export function SpriteIcon({ sprite, size = 20, className = "" }: SpriteIconProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const displayWidth = sprite ? size : 0;
  const displayHeight = sprite ? size * (sprite.height / sprite.width) : 0;

  useEffect(() => {
    if (!sprite || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = displayWidth * dpr;
    canvas.height = displayHeight * dpr;

    const src = getAssetPath(SPRITE_SHEETS[sprite.sheet]);
    loadImage(src).then((img) => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, displayWidth, displayHeight);

      if (sprite.rotated) {
        const storedW = sprite.height;
        const storedH = sprite.width;
        const scaleX = displayWidth / sprite.width;
        const scaleY = displayHeight / sprite.height;

        ctx.scale(scaleX, scaleY);
        ctx.translate(sprite.width / 2, sprite.height / 2);
        ctx.rotate(Math.PI / 2);
        ctx.drawImage(
          img,
          sprite.x, sprite.y, storedW, storedH,
          -storedW / 2, -storedH / 2, storedW, storedH,
        );
      } else {
        const scaleX = displayWidth / sprite.width;
        const scaleY = displayHeight / sprite.height;
        ctx.scale(scaleX, scaleY);
        ctx.drawImage(
          img,
          sprite.x, sprite.y, sprite.width, sprite.height,
          0, 0, sprite.width, sprite.height,
        );
      }
    });
  }, [sprite, displayWidth, displayHeight]);

  if (!sprite) return null;

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ width: displayWidth, height: displayHeight }}
    />
  );
}
