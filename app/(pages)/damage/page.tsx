import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "伤害计算器",
  description: "逆战未来武器伤害、射速与弹匣收益计算工具",
  alternates: { canonical: "/damage" },
};

export default function DamagePage() {
  return <h1>伤害计算器</h1>;
}
