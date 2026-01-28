import { SPRITE_SHEETS, type SpriteConfig } from "@/constants/sprites";

interface SpriteIconProps {
  sprite?: SpriteConfig;
  size?: number;
  className?: string;
}

export function SpriteIcon({ sprite, size = 20, className = "" }: SpriteIconProps) {
  if (!sprite) {
    return null;
  }

  const scale = size / sprite.width;

  return (
    <div
      className={`inline-block overflow-hidden ${className}`}
      style={{
        width: size,
        height: size * (sprite.height / sprite.width),
      }}
    >
      <div
        style={{
          width: sprite.width,
          height: sprite.height,
          backgroundImage: `url(${SPRITE_SHEETS[sprite.sheet]})`,
          backgroundPosition: `-${sprite.x}px -${sprite.y}px`,
          backgroundRepeat: "no-repeat",
          transform: `scale(${scale})`,
          transformOrigin: "top left",
        }}
      />
    </div>
  );
}
