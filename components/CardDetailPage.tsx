import Image from "next/image";
import { ShieldAlert, Sparkles, Tag } from "lucide-react";
import { MDXRemote } from "next-mdx-remote/rsc";
import { MultiplierBadges } from "@/components/MultiplierBadges";
import { TableOfContents } from "@/components/TableOfContents";
import { getMDXDetail } from "@/lib/mdx";
import { mdxComponents } from "@/lib/mdx-components";
import { mdxOptions } from "@/lib/mdx-options";
import { getProviderRelationsForSource } from "@/lib/multiplier-data";
import { getAssetPath } from "@/lib/path";

const TYPE_DETAILS = {
  buff: {
    label: "增益卡片",
    Icon: Sparkles,
    className: "border-amber-400/40 bg-amber-400/10 text-amber-200",
  },
  debuff: {
    label: "减益卡片",
    Icon: ShieldAlert,
    className: "border-rose-400/40 bg-rose-400/10 text-rose-200",
  },
} as const;

export async function CardDetailPage({ slug }: { slug: string }) {
  const { content, metadata } = getMDXDetail("cards", slug);
  const title = String(metadata.title ?? slug);
  const icon = String(metadata.icon ?? "");
  const effect = String(metadata.effect ?? "");
  const type = metadata.type === "debuff" ? "debuff" : "buff";
  const tag = typeof metadata.tag === "string" ? metadata.tag : undefined;
  const typeDetails = TYPE_DETAILS[type];
  const TypeIcon = typeDetails.Icon;
  const multiplierRelations = getProviderRelationsForSource({
    type: "card",
    slug,
  });
  const hasContent = content.trim().length > 0;

  return (
    <>
      <TableOfContents enabled={hasContent && metadata.toc !== false} />
      <div className="mx-auto max-w-6xl">
        <section
          aria-labelledby="card-title"
          className="grid overflow-hidden rounded-lg border border-zinc-700 bg-zinc-900/70 lg:grid-cols-[430px_minmax(0,1fr)]"
        >
          <div className="flex items-center justify-center border-b border-zinc-700 bg-zinc-950/55 p-5 sm:p-7 lg:border-r lg:border-b-0">
            <div className="relative aspect-[960/1266] w-full max-w-[320px] overflow-hidden rounded-md shadow-2xl shadow-black/35 lg:max-w-[360px]">
              <Image
                src={getAssetPath(icon)}
                alt={title}
                fill
                priority
                sizes="(max-width: 1023px) 320px, 360px"
                className="object-contain"
              />
            </div>
          </div>

          <div className="flex min-w-0 flex-col p-5 sm:p-8 lg:p-10">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex min-h-8 items-center gap-1.5 rounded border px-2.5 py-1 text-sm font-medium ${typeDetails.className}`}
              >
                <TypeIcon aria-hidden="true" className="h-4 w-4" />
                {typeDetails.label}
              </span>
              {tag && (
                <span className="inline-flex min-h-8 items-center gap-1.5 rounded border border-zinc-600 bg-zinc-800/70 px-2.5 py-1 text-sm text-zinc-300">
                  <Tag aria-hidden="true" className="h-4 w-4" />
                  {tag}
                </span>
              )}
            </div>

            <h1
              id="card-title"
              className="mt-5 break-words text-3xl font-bold text-zinc-50 sm:text-4xl"
            >
              {title}
            </h1>

            <section aria-labelledby="card-effect-heading" className="mt-8 border-t border-zinc-700 pt-6">
              <h2
                id="card-effect-heading"
                className="text-sm font-semibold text-zinc-400"
              >
                卡片效果
              </h2>
              <p className="mt-2 max-w-2xl text-base leading-7 text-zinc-100 sm:text-lg sm:leading-8">
                {effect}
              </p>
            </section>

            {multiplierRelations.length > 0 && (
              <section
                id="multiplier-provider"
                aria-labelledby="card-multiplier-heading"
                className="mt-6 border-t border-zinc-700 pt-6"
              >
                <h2
                  id="card-multiplier-heading"
                  className="mb-3 text-sm font-semibold text-zinc-400"
                >
                  伤害乘区
                </h2>
                <MultiplierBadges relations={multiplierRelations} />
              </section>
            )}
          </div>
        </section>

        {hasContent && (
          <article className="prose prose-lg prose-invert mx-auto mt-10 max-w-4xl">
            <MDXRemote
              source={content}
              components={mdxComponents}
              options={mdxOptions}
            />
          </article>
        )}
      </div>
    </>
  );
}
