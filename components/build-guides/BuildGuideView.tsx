import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { ReactNode } from "react";
import { getAssetPath } from "@/lib/path";
import {
  BUILD_GUIDE_PERK_SLOTS,
  type BuildGuideSummary,
  type ResolvedBuildGuide,
  type ResolvedBuildGuidePerk,
  type ResolvedBuildGuideWeapon,
} from "@/lib/build-guides";

function WeaponIcon({
  weapon,
  className,
}: {
  weapon: ResolvedBuildGuideWeapon;
  className: string;
}) {
  return (
    <Image
      src={getAssetPath(weapon.icon)}
      alt=""
      width={320}
      height={160}
      className={`${className} object-contain`}
    />
  );
}

function PerkIcon({
  perk,
  className = "h-12 w-12",
}: {
  perk: ResolvedBuildGuidePerk;
  className?: string;
}) {
  return perk.icon ? (
    <Image
      src={getAssetPath(`/webp/icons/perks/${perk.icon}.webp`)}
      alt=""
      width={64}
      height={64}
      className={`${className} shrink-0 object-contain`}
    />
  ) : (
    <span
      aria-hidden="true"
      className={`flex ${className} shrink-0 items-center justify-center rounded border border-zinc-700 bg-black/20 text-zinc-500`}
    >
      ?
    </span>
  );
}

function renderTalentDescription(value: string): ReactNode[] {
  const result: ReactNode[] = [];
  const pattern = /<(qiangdiao|T002)>(.*?)<\/>/g;
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(value)) !== null) {
    if (match.index > cursor) result.push(value.slice(cursor, match.index));
    result.push(
      <strong key={`${match.index}-${match[1]}`} className="font-semibold text-[#e2c38b]">
        {match[2]}
      </strong>,
    );
    cursor = pattern.lastIndex;
  }

  if (cursor < value.length) result.push(value.slice(cursor));
  return result;
}

function TalentDescription({
  value,
  className,
}: {
  value: string;
  className: string;
}) {
  return (
    <div className={className}>
      {value.split("\n").map((paragraph, index) => (
        <p key={`${index}-${paragraph.slice(0, 12)}`}>{renderTalentDescription(paragraph)}</p>
      ))}
    </div>
  );
}

function BuildPerkPreview({
  perks,
}: {
  perks: ResolvedBuildGuide["perks"]["primary"];
}) {
  return (
    <div aria-label="插件搭配" className="grid grid-cols-4 gap-2">
      {BUILD_GUIDE_PERK_SLOTS.map((slot) => {
        const perk = perks[slot];
        return (
          <span
            key={slot}
            role="img"
            aria-label={`${slot} 号槽：${perk.name}`}
            title={`${slot} 号槽 · ${perk.name}`}
            className="flex min-w-0 flex-col items-center justify-start"
          >
            <PerkIcon perk={perk} className="h-16 w-16" />
            <span className="mt-1 block w-full truncate text-center text-xs leading-4 text-zinc-400">
              {perk.name}
            </span>
          </span>
        );
      })}
    </div>
  );
}

function BuildWeaponPreview({
  label,
  weapon,
  perks,
}: {
  label: string;
  weapon: ResolvedBuildGuideWeapon;
  perks: ResolvedBuildGuide["perks"]["primary"];
}) {
  return (
    <div className="grid gap-3 border-t border-zinc-800 py-3 sm:grid-cols-[minmax(0,1fr)_18rem] sm:items-center">
      <div className="flex min-w-0 items-center gap-3">
        <WeaponIcon weapon={weapon} className="h-14 w-24 shrink-0" />
        <span className="min-w-0">
          <span className="block text-[11px] text-zinc-500">{label}</span>
          <strong className="mt-0.5 block text-sm font-semibold leading-5 text-zinc-200">
            {weapon.title}
          </strong>
        </span>
      </div>
      <BuildPerkPreview perks={perks} />
    </div>
  );
}

export function BuildGuideList({ guides }: { guides: BuildGuideSummary[] }) {
  if (guides.length === 0) {
    return (
      <div className="mx-auto flex min-h-52 max-w-3xl items-center justify-center border-y border-zinc-800 px-6 text-center">
        <p className="text-sm leading-6 text-zinc-400">暂无公开的搭配攻略</p>
      </div>
    );
  }

  return (
    <ul className="mx-auto grid w-full max-w-6xl gap-4 md:grid-cols-2">
      {guides.map((guide) => (
        <li key={guide.slug}>
          <article className="group relative flex min-h-full flex-col rounded-lg border border-zinc-700 bg-zinc-900/55 p-4 transition-colors duration-200 hover:border-[#d1ac69]/70 hover:bg-zinc-900 motion-reduce:transition-none sm:p-5">
            <Link
              href={`/builds/${encodeURIComponent(guide.slug)}`}
              aria-labelledby={`build-guide-title-${guide.slug}`}
              className="peer absolute inset-0 z-0 cursor-pointer touch-manipulation rounded-lg focus-visible:outline-none"
            />
            <div className="pointer-events-none relative z-10 flex items-start justify-between gap-4 peer-focus-visible:[&_h2]:underline peer-focus-visible:[&_h2]:decoration-2 peer-focus-visible:[&_h2]:underline-offset-4">
              <div className="min-w-0">
                <div className="mb-2 flex flex-wrap gap-1.5">
                  <span className="rounded border border-[#d1ac69]/35 bg-[#d1ac69]/10 px-2 py-0.5 text-xs font-semibold text-[#e2c38b]">
                    S3
                  </span>
                  {guide.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded border border-zinc-700 bg-zinc-800/70 px-2 py-0.5 text-xs text-zinc-400"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                <h2
                  id={`build-guide-title-${guide.slug}`}
                  className="text-lg font-semibold text-zinc-100 sm:text-xl"
                >
                  {guide.title}
                </h2>
              </div>
              <ArrowRight
                aria-hidden="true"
                className="mt-1 h-5 w-5 shrink-0 text-zinc-500 transition-colors group-hover:text-[#e2c38b]"
              />
            </div>

            <div className="pointer-events-none relative z-10 mt-2 flex flex-col items-start gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
              <p className="min-w-0 text-sm leading-6 text-zinc-400">
                {guide.summary}
              </p>
              <Link
                href="/credits#main-credits"
                className="pointer-events-auto relative z-20 inline-flex shrink-0 cursor-pointer touch-manipulation whitespace-nowrap py-1 text-xs text-zinc-500 hover:text-zinc-300 focus-visible:outline-none focus-visible:underline focus-visible:decoration-2 focus-visible:underline-offset-4"
              >
                搭配来源：<span className="text-zinc-300">{guide.source}</span>
              </Link>
            </div>

            <div className="pointer-events-none relative z-10 mt-2">
              <BuildWeaponPreview
                label="主武器"
                weapon={guide.weapons.primary}
                perks={guide.perks.primary}
              />
              <BuildWeaponPreview
                label="副武器"
                weapon={guide.weapons.secondary}
                perks={guide.perks.secondary}
              />
            </div>

            <div className="pointer-events-none relative z-10 grid gap-3 border-t border-zinc-800 pt-3 sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
              <div className="flex min-w-0 items-center gap-2">
                <WeaponIcon
                  weapon={guide.weapons.melee}
                  className="h-12 w-20 shrink-0"
                />
                <div className="min-w-0">
                  <p className="text-[11px] text-zinc-500">近战武器</p>
                  <p className="mt-0.5 text-sm font-medium text-zinc-200">
                    {guide.weapons.melee.title}
                  </p>
                </div>
              </div>
              <div className="flex min-w-0 items-center gap-2 sm:border-l sm:border-zinc-800 sm:pl-3">
                <Image
                  src={getAssetPath(guide.talent.treeIcon)}
                  alt=""
                  width={56}
                  height={56}
                  className="h-11 w-11 shrink-0 object-contain"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] text-zinc-500">赛季天赋</p>
                  <p className="mt-0.5 truncate text-sm font-medium text-zinc-200">
                    {guide.talent.treeName} · {guide.talent.passive.name}
                  </p>
                </div>
                <code className="shrink-0 text-sm font-semibold tabular-nums text-[#e2c38b]">
                  {guide.talent.route}
                </code>
              </div>
            </div>
          </article>
        </li>
      ))}
    </ul>
  );
}

export function BuildGuideCatalog({ guides }: { guides: BuildGuideSummary[] }) {
  return (
    <div className="mx-auto w-full max-w-6xl">
      <header className="mb-6 flex flex-col gap-2 border-b border-zinc-700 pb-5 sm:mb-8 sm:flex-row sm:items-end sm:justify-between sm:pb-6">
        <div>
          <p className="text-xs font-semibold text-[#d1ac69]">S3 猎场</p>
          <h1 className="mt-1 text-2xl font-bold text-white sm:text-3xl">搭配攻略</h1>
        </div>
        <p className="text-sm tabular-nums text-zinc-500">
          {guides.length > 0 ? `${guides.length} 篇攻略` : "暂无公开内容"}
        </p>
      </header>
      <BuildGuideList guides={guides} />
    </div>
  );
}

function PerkGrid({
  perks,
}: {
  perks: ResolvedBuildGuide["perks"]["primary"];
}) {
  return (
    <ul className="mt-4 grid grid-cols-2 gap-2">
      {BUILD_GUIDE_PERK_SLOTS.map((slot) => {
        const perk = perks[slot];
        return (
          <li key={slot}>
            <Link
              href={perk.href}
              className="group flex min-h-16 cursor-pointer touch-manipulation items-center gap-2 rounded-lg border border-zinc-700/80 bg-zinc-900/55 px-2.5 py-2 transition-colors duration-200 hover:border-[#d1ac69]/60 hover:bg-zinc-900 focus-visible:outline-none focus-visible:[&_strong]:underline focus-visible:[&_strong]:decoration-2 focus-visible:[&_strong]:underline-offset-4 motion-reduce:transition-none sm:gap-3 sm:px-3"
            >
              <PerkIcon perk={perk} />
              <span className="min-w-0">
                <span className="block text-[11px] text-zinc-500">{slot} 号槽</span>
                <strong className="mt-0.5 block text-sm font-medium leading-5 text-zinc-200">
                  {perk.name}
                </strong>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function WeaponBuildSection({
  label,
  weapon,
  perks,
}: {
  label: string;
  weapon: ResolvedBuildGuideWeapon;
  perks: ResolvedBuildGuide["perks"]["primary"];
}) {
  return (
    <section aria-label={label} className="min-w-0">
      <p className="text-xs font-medium text-zinc-500">{label}</p>
      <Link
        href={weapon.href}
        className="group mt-2 flex min-h-24 cursor-pointer touch-manipulation items-center gap-4 focus-visible:outline-none focus-visible:[&_h3]:underline focus-visible:[&_h3]:decoration-2 focus-visible:[&_h3]:underline-offset-4"
      >
        <WeaponIcon weapon={weapon} className="h-20 w-32 shrink-0 sm:h-24 sm:w-40" />
        <div className="min-w-0">
          <h3 className="text-xl font-semibold text-zinc-100 sm:text-2xl">
            {weapon.title}
          </h3>
          <span className="mt-2 inline-flex items-center gap-1.5 text-sm text-zinc-500 transition-colors group-hover:text-[#e2c38b]">
            查看武器详情
            <ArrowRight aria-hidden="true" className="h-4 w-4" />
          </span>
        </div>
      </Link>
      <PerkGrid perks={perks} />
    </section>
  );
}

export function BuildGuideDetail({ guide }: { guide: ResolvedBuildGuide }) {
  return (
    <div className="mx-auto w-full max-w-6xl py-6 sm:py-8">
      <header className="pb-2">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Link
            href="/builds"
            className="min-h-11 cursor-pointer touch-manipulation content-center text-zinc-400 hover:text-[#e2c38b] focus-visible:outline-none focus-visible:underline focus-visible:decoration-2 focus-visible:underline-offset-4"
          >
            搭配攻略
          </Link>
          <span aria-hidden="true" className="text-zinc-700">/</span>
          <span className="rounded border border-[#d1ac69]/35 bg-[#d1ac69]/10 px-2 py-0.5 font-semibold text-[#e2c38b]">
            S3
          </span>
          {guide.draft && (
            <span className="rounded border border-amber-500/35 bg-amber-500/10 px-2 py-0.5 text-amber-300">
              草稿示例
            </span>
          )}
        </div>
        <h1 className="mt-3 text-3xl font-bold text-white sm:text-4xl">{guide.title}</h1>
        <p className="mt-3 max-w-3xl text-base leading-7 text-zinc-400">{guide.summary}</p>
        {guide.tags.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {guide.tags.map((tag) => (
              <span
                key={tag}
                className="rounded border border-zinc-700 bg-zinc-900/70 px-2.5 py-1 text-xs text-zinc-400"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </header>

      <section aria-labelledby="build-loadout-heading" className="pt-3 pb-2 sm:pt-4 sm:pb-3">
        <h2 id="build-loadout-heading" className="text-xl font-semibold text-zinc-100">
          武器与插件
        </h2>
        <div className="mt-5 grid gap-8 lg:grid-cols-2 lg:gap-10">
          <WeaponBuildSection
            label="主武器"
            weapon={guide.weapons.primary}
            perks={guide.perks.primary}
          />
          <WeaponBuildSection
            label="副武器"
            weapon={guide.weapons.secondary}
            perks={guide.perks.secondary}
          />
        </div>

        <section aria-label="近战武器" className="mt-8 border-t border-zinc-700 pt-4 lg:mt-10">
          <Link
            href={guide.weapons.melee.href}
            className="group flex min-h-24 cursor-pointer touch-manipulation items-center gap-4 focus-visible:outline-none focus-visible:[&_h3]:underline focus-visible:[&_h3]:decoration-2 focus-visible:[&_h3]:underline-offset-4"
          >
            <WeaponIcon
              weapon={guide.weapons.melee}
              className="h-20 w-32 shrink-0 sm:h-24 sm:w-44"
            />
            <div className="min-w-0">
              <p className="text-xs font-medium text-zinc-500">近战武器</p>
              <h3 className="mt-1 text-xl font-semibold text-zinc-100 sm:text-2xl">
                {guide.weapons.melee.title}
              </h3>
            </div>
            <ArrowRight
              aria-hidden="true"
              className="ml-auto h-5 w-5 shrink-0 text-zinc-600 transition-colors group-hover:text-[#e2c38b]"
            />
          </Link>
        </section>
      </section>

      <section aria-labelledby="build-talent-heading" className="border-t border-zinc-700 py-7 sm:py-9">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-medium text-zinc-500">赛季天赋</p>
            <h2 id="build-talent-heading" className="mt-1 text-xl font-semibold text-zinc-100">
              S3 天赋方案
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-zinc-500">通用路线</span>
            <code className="rounded border border-[#d1ac69]/45 bg-[#d1ac69]/10 px-3 py-1.5 text-lg font-bold tabular-nums text-[#e2c38b]">
              {guide.talent.route}
            </code>
          </div>
        </div>

        <div className="mt-5 grid gap-7 lg:grid-cols-2 lg:gap-10">
          <Link
            href={guide.talent.treeHref}
            className="group grid min-h-20 cursor-pointer touch-manipulation grid-cols-[3rem_minmax(0,1fr)_auto] items-start gap-3 py-2 focus-visible:outline-none focus-visible:[&_h3]:underline focus-visible:[&_h3]:decoration-2 focus-visible:[&_h3]:underline-offset-4"
          >
            <Image
              src={getAssetPath(guide.talent.treeIcon)}
              alt=""
              width={48}
              height={48}
              className="h-12 w-12 shrink-0 object-contain"
            />
            <div className="min-w-0">
              <span className="block text-xs text-zinc-500">主动天赋</span>
              <h3 className="mt-1 text-lg font-semibold text-zinc-100">
                {guide.talent.treeName}
              </h3>
            </div>
            <ArrowRight
              aria-hidden="true"
              className="mt-4 h-5 w-5 text-zinc-600 transition-colors group-hover:text-[#e2c38b]"
            />
          </Link>
          <Link
            href={guide.talent.passive.href}
            className="group grid min-h-20 cursor-pointer touch-manipulation grid-cols-[3rem_minmax(0,1fr)_auto] items-start gap-3 py-2 focus-visible:outline-none focus-visible:[&_h3]:underline focus-visible:[&_h3]:decoration-2 focus-visible:[&_h3]:underline-offset-4"
          >
            <Image
              src={getAssetPath(guide.talent.passive.icon)}
              alt=""
              width={48}
              height={48}
              className="h-12 w-12 shrink-0 object-contain"
            />
            <div className="min-w-0">
              <span className="block text-xs text-zinc-500">被动天赋卡</span>
              <h3 className="mt-1 text-lg font-semibold text-zinc-100">
                {guide.talent.passive.name}
              </h3>
            </div>
            <ArrowRight
              aria-hidden="true"
              className="mt-4 h-5 w-5 text-zinc-600 transition-colors group-hover:text-[#e2c38b]"
            />
          </Link>
        </div>

        <h3 className="mt-7 text-sm font-semibold text-zinc-300">通用节点</h3>
        <ol className="mt-3 grid gap-3 lg:grid-cols-5">
          {guide.talent.nodes.map((node, index) => (
            <li key={node.id}>
              <Link
                href={node.href}
                className="group flex min-h-full cursor-pointer touch-manipulation flex-col rounded-lg border border-zinc-700 bg-zinc-900/45 p-3 text-left transition-colors duration-200 hover:border-[#d1ac69]/60 hover:bg-zinc-900 focus-visible:outline-none focus-visible:[&_strong]:underline focus-visible:[&_strong]:decoration-2 focus-visible:[&_strong]:underline-offset-4 motion-reduce:transition-none"
              >
                <span className="flex items-center gap-2.5">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded border border-zinc-700 bg-black/25 text-xs font-bold text-[#e2c38b]">
                    {index + 1}
                  </span>
                  <Image
                    src={getAssetPath(node.icon)}
                    alt=""
                    width={44}
                    height={44}
                    className="h-11 w-11 shrink-0 object-contain"
                  />
                  <span className="min-w-0 flex-1">
                    <strong className="block text-sm font-medium leading-5 text-zinc-200">
                      {node.name}
                    </strong>
                    <span className="mt-0.5 block text-xs tabular-nums text-zinc-500">
                      {node.level}/{node.level}
                    </span>
                  </span>
                </span>
                <TalentDescription
                  value={node.description}
                  className="mt-3 space-y-1 text-xs leading-5 text-zinc-400"
                />
              </Link>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
