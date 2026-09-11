import { Suspense } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { MDXRemote } from "next-mdx-remote/rsc";
import { HunterMonsterDetail } from "@/components/HunterMonsterCatalog";
import { getHunterMonsters } from "@/lib/hunter-monsters";
import { getMDXDetail } from "@/lib/mdx";

export function generateStaticParams() {
  return getHunterMonsters().map(monster => ({ slug: monster.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const monster = getHunterMonsters().find(item => item.slug === decodeURIComponent(slug));
  if (!monster) notFound();
  return { title: monster.title, description: monster.description, alternates: { canonical: `/enemies/lc/monsters/${monster.slug}` } };
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const monster = getHunterMonsters().find(item => item.slug === decodeURIComponent(slug));
  if (!monster) notFound();
  const { content } = getMDXDetail("enemies/lc/monsters", monster.slug);
  return <Suspense fallback={<p className="text-zinc-400">正在加载怪物档案…</p>}><HunterMonsterDetail monster={monster}><MDXRemote source={content} /></HunterMonsterDetail></Suspense>;
}
