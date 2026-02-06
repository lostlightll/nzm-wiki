import { ProseTable } from "@/components/ProseTable";
import { Callout } from "@/components/Callout";
import { LevelTable } from "@/components/LevelTable";
import { DataTable } from "@/components/DataTable";
import { Credit } from "@/components/Credit";
import { BossCard, BossCardGrid } from "@/components/BossCard";
import { BuffCard, BuffCardGrid, BuffDetail, CardRef } from "@/components/BuffCard";
import {
  Red,
  Yellow,
  Green,
  Grey,
  Orange,
  Brown,
  Blue,
  Purple,
  Pink,
  Fire,
  Ice,
  Shock,
  Corrosive,
  Kinetic,
  Highlight,
} from "@/components/TextStyle";
import { MDXImage } from "@/components/MDXImage";
import { MDXLink } from "@/components/MDXLink";

export const mdxComponents = {
  img: MDXImage,
  a: MDXLink,
  table: ProseTable,
  Callout,
  LevelTable,
  DataTable,
  Credit,
  BossCard,
  BossCardGrid,
  BuffCard,
  BuffCardGrid,
  BuffDetail,
  CardRef,
  Red,
  Yellow,
  Green,
  Grey,
  Orange,
  Brown,
  Blue,
  Purple,
  Pink,
  Fire,
  Ice,
  Shock,
  Corrosive,
  Kinetic,
  Highlight,
};

export { TableOfContents } from "@/components/TableOfContents";
