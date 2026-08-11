import Image from "next/image";
import { HUNTING_TACTICAL_SKILLS } from "@/lib/hunting-tactical-skills";
import { getAssetPath } from "@/lib/path";

export function HuntingTacticalSkillCatalog() {
  return (
    <div className="not-prose mx-auto max-w-6xl pb-10">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {HUNTING_TACTICAL_SKILLS.map((skill) => (
          <article
            key={skill.id}
            className="flex min-h-40 gap-4 rounded-lg border border-zinc-700 bg-zinc-900/70 p-4 sm:p-5"
          >
            <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md border border-zinc-600 bg-zinc-950">
              <Image
                src={getAssetPath(skill.icon)}
                alt=""
                fill
                sizes="64px"
                className="object-contain p-1"
              />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h2 className="text-lg font-semibold leading-7 text-zinc-100">
                  {skill.name}
                </h2>
                {skill.availability === "limited" && (
                  <span className="inline-flex min-h-7 items-center rounded border border-amber-400/50 bg-amber-400/10 px-2 py-1 text-xs font-semibold text-amber-200">
                    限时
                  </span>
                )}
              </div>
              <p className="mt-3 text-sm leading-6 text-zinc-300">
                {skill.description}
              </p>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
