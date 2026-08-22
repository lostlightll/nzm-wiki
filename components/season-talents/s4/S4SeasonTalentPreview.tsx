import Image from "next/image";
import Link from "next/link";
import { getAssetPath } from "@/lib/path";

type S4TalentId =
  | "machine-dance"
  | "dual-star"
  | "matrix-symbiosis"
  | "black-hole";

interface S4Talent {
  id: S4TalentId;
  name: string;
  subtitle: string;
  icon: string;
  accent: string;
  desktopPosition: string;
}

const S4_TALENTS: readonly S4Talent[] = [
  {
    id: "machine-dance",
    name: "机械之舞",
    subtitle: "新手推荐",
    icon: "/webp/images/season-talents/s4/machine-dance.webp",
    accent: "#f4df4f",
    desktopPosition: "bottom-[3.5%] left-[13%]",
  },
  {
    id: "dual-star",
    name: "双星",
    subtitle: "强化武器射击",
    icon: "/webp/images/season-talents/s4/dual-star.webp",
    accent: "#a44cf5",
    desktopPosition: "left-[41%] top-[62%]",
  },
  {
    id: "matrix-symbiosis",
    name: "矩阵共生",
    subtitle: "强化召唤物",
    icon: "/webp/images/season-talents/s4/matrix-symbiosis.webp",
    accent: "#e93a31",
    desktopPosition: "right-[8%] top-[35%]",
  },
  {
    id: "black-hole",
    name: "黑洞",
    subtitle: "区域控制",
    icon: "/webp/images/season-talents/s4/black-hole.webp",
    accent: "#38a5ed",
    desktopPosition: "bottom-[3.5%] right-[17%]",
  },
];

function S4TalentMarker({ talent }: { talent: S4Talent }) {
  const content = (
    <>
      <span className="relative z-10 -mr-3 h-[4.75rem] w-[4.75rem] shrink-0 overflow-hidden drop-shadow-[0_5px_10px_rgba(0,0,0,0.7)]">
        <Image
          src={getAssetPath(talent.icon)}
          alt=""
          fill
          sizes="76px"
          className="scale-110 object-contain"
        />
      </span>
      <span
        className="relative flex h-[3.6rem] min-w-52 items-center rounded-lg border border-white/20 border-l-2 bg-[#07141d]/80 px-5 pr-10 text-white shadow-[0_7px_18px_rgba(0,0,0,0.32)] backdrop-blur-sm transition-colors duration-200 group-hover:bg-[#0b1c27]/92 motion-reduce:transition-none"
        style={{ borderLeftColor: talent.accent }}
      >
        <span>
          <strong className="block text-[1.05rem] font-semibold leading-5">
            {talent.name}
          </strong>
          <span className="mt-1 block text-xs leading-4 text-slate-300">
            {talent.subtitle}
          </span>
        </span>
        <span
          aria-hidden="true"
          className="absolute right-3 top-1/2 flex h-5 w-5 -translate-y-1/2 rotate-45 items-center justify-center border border-slate-400/60"
        >
          <span className="-rotate-45 text-[0.65rem] font-medium leading-none">
            i
          </span>
        </span>
      </span>
    </>
  );

  const className = `group absolute z-20 flex min-h-16 min-w-64 items-center text-left transition-[filter,transform] duration-200 motion-reduce:transition-none ${talent.desktopPosition}`;
  if (talent.id === "machine-dance") {
    return <div className={`${className} opacity-80`}>{content}</div>;
  }
  return (
    <Link
      href={`/guides/season-talents/s4/${talent.id}`}
      className={`${className} cursor-pointer touch-manipulation hover:brightness-125 focus-visible:outline-none focus-visible:[&_strong]:underline focus-visible:[&_strong]:underline-offset-4`}
    >
      {content}
    </Link>
  );
}

function MobileTalentButton({ talent }: { talent: S4Talent }) {
  const content = (
    <>
      <span className="relative h-16 w-16 shrink-0">
        <Image
          src={getAssetPath(talent.icon)}
          alt=""
          fill
          sizes="64px"
          className="object-contain"
        />
      </span>
      <span className="min-w-0">
        <strong className="block text-sm font-semibold leading-5">
          {talent.name}
        </strong>
        <span className="mt-0.5 block text-xs leading-4 text-slate-300">
          {talent.subtitle}
        </span>
      </span>
    </>
  );
  const className =
    "relative flex min-h-24 touch-manipulation items-center gap-2 overflow-hidden rounded-lg border border-l-2 border-white/15 bg-[#07141d]/92 px-2 py-2 text-left text-white transition-colors duration-200 motion-reduce:transition-none";
  if (talent.id === "machine-dance") {
    return (
      <div
        className={`${className} opacity-75`}
        style={{ borderLeftColor: talent.accent }}
      >
        {content}
      </div>
    );
  }
  return (
    <Link
      href={`/guides/season-talents/s4/${talent.id}`}
      className={`${className} cursor-pointer hover:bg-[#0c202c] focus-visible:outline-none focus-visible:[&_strong]:underline focus-visible:[&_strong]:underline-offset-4`}
      style={{ borderLeftColor: talent.accent }}
    >
      {content}
    </Link>
  );
}

export function S4SeasonTalentPreview() {
  return (
    <section aria-labelledby="s4-season-talents-heading" className="lg:h-full">
      <h2 id="s4-season-talents-heading" className="sr-only">
        S4 赛季天赋预览
      </h2>

      <div className="relative hidden h-full w-full overflow-hidden bg-[#03121b] lg:block">
        <Image
          src={getAssetPath("/webp/images/season-talents/s4/background.webp")}
          alt="太空站、行星与黑洞组成的 S4 赛季天赋场景"
          fill
          sizes="(min-width: 1440px) 1392px, calc(100vw - 3rem)"
          className="object-cover"
        />
        <Image
          src={getAssetPath("/webp/images/season-talents/s4/hud-frame.webp")}
          alt=""
          fill
          sizes="(min-width: 1440px) 1392px, calc(100vw - 3rem)"
          className="pointer-events-none object-cover opacity-35 mix-blend-screen"
        />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(1,8,14,0.05),transparent_67%,rgba(2,8,14,0.34))]" />

        <Image
          src={getAssetPath("/webp/images/season-talents/s4/logo.webp")}
          alt="S4 新星计划"
          width={644}
          height={264}
          className="absolute left-[5.5%] top-[27%] z-10 h-auto w-[23%] drop-shadow-[0_5px_12px_rgba(0,0,0,0.35)]"
        />

        <div className="absolute right-6 top-5 z-10 flex items-center gap-2 font-mono text-[0.62rem] text-cyan-50/75">
          <span className="h-1.5 w-1.5 bg-cyan-300" />
          S4 // TEST SERVER PREVIEW
        </div>

        {S4_TALENTS.map((talent) => (
          <S4TalentMarker key={talent.id} talent={talent} />
        ))}
      </div>

      <div className="lg:hidden">
        <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-[#03121b]">
          <Image
            src={getAssetPath("/webp/images/season-talents/s4/background.webp")}
            alt="太空站、行星与黑洞组成的 S4 赛季天赋场景"
            fill
            sizes="calc(100vw - 2rem)"
            className="object-contain"
          />
          <Image
            src={getAssetPath("/webp/images/season-talents/s4/logo.webp")}
            alt="S4 新星计划"
            width={644}
            height={264}
            className="absolute left-4 top-4 h-auto w-[42%] drop-shadow-[0_4px_10px_rgba(0,0,0,0.55)]"
          />
          <span className="absolute right-3 top-3 border-l border-cyan-300/80 bg-black/45 px-2 py-1 font-mono text-[0.58rem] text-cyan-50">
            S4 // TEST SERVER PREVIEW
          </span>
        </div>
        <div className="mt-2 grid grid-cols-1 gap-2 min-[430px]:grid-cols-2">
          {S4_TALENTS.map((talent) => (
            <MobileTalentButton key={talent.id} talent={talent} />
          ))}
        </div>
      </div>
    </section>
  );
}
