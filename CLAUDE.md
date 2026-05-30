# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

nzm-wiki is a wiki website for the pve fps game "逆战未来" (Nizhan: Future), built with Next.js 16, React 19, TypeScript, and Tailwind CSS v4.

## Note

始终考虑移动端适配，但是 PC 的显示的效果优先

这里是 Windows msys2 ucrt64 环境。Claude Code 的 Bash 工具运行在 Windows 原生路径下，**不识别 msys2 虚拟路径**：
- 正确：`C:/msys64/home/user/projects/nzm-wiki`
- 错误：`/home/user/projects/nzm-wiki`（msys2 虚拟路径，Bash 工具无法识别）

执行 cd 或引用文件时，始终使用 `C:/msys64/...` 开头的 Windows 路径。

如果你执行命令的时候失败了，向我求助

当我发送的前缀为 NZM/Content/ 的路径，实际对应的位置是 ./refs/Exports/NZM/Content/

## 项目文档

`MD/` 目录存放项目规划、设计记录等文档。当前索引：

| 文件 | 说明 |
|:---|:---|
| [MD/PLAN-WEAPON.md](MD/PLAN-WEAPON.md) | 武器数据管线改造规划与进度 |
| [MD/IDEAS.md](MD/IDEAS.md) | 灵感记录，每条一句话 |

## Development Commands

```bash
pnpm i          # Install dependencies
pnpm dev        # Start development server (http://localhost:3000)
pnpm build      # Production build
pnpm start      # Start production server
pnpm lint       # Run ESLint
```

## Architecture

### Routing Structure
Uses Next.js App Router with route groups:
- `app/page.tsx` - Home page
- `app/(pages)/weapons/page.tsx` - Weapons listing
- `app/(pages)/perks/page.tsx` - Perks listing

The `(pages)` folder is a route group (not part of URL path).

### Type Definitions
All data types are centralized in `types/index.ts`:
- **Weapon types**: `Weapon`, `WeaponStats`, `WeaponSkill`, `WeaponType`, `WeaponTag`, `Rarity`
- **Perk types**: `Perk`, `PerkEffect`, `PerkSlot`, `PerkCategory`
- **Calculator types**: `DamageCalculation`, `DamageResult`

### Path Aliases
Use `@/*` to import from project root (configured in tsconfig.json).

## Code Style

- ESLint configured with Next.js Core Web Vitals and TypeScript rules
- Tailwind CSS v4 for styling (using PostCSS plugin)

## MDX Frontmatter

MDX 文件支持以下 frontmatter 字段：

| 字段 | 类型 | 默认值 | 说明 |
| :--- | :--- | :--- | :--- |
| `title` | string | - | 页面标题 |
| `tag` | string | - | 分类标签 |
| `toc` | boolean | `true` | 是否显示目录 |
| `draft` | boolean | `false` | 草稿模式（仅 dev 可见，build 时排除） |
| `page-width` | string | `lg` | 页面宽度 |
| `keywords` | string \| string[] | - | 搜索关键词（用于 Ctrl+P 搜索） |

`page-width` 可选值：

| 值 | Tailwind class | 宽度 |
| :--- | :--- | :--- |
| `sm` | max-w-xl | 576px |
| `md` | max-w-2xl | 672px |
| `lg` | max-w-3xl | 768px |
| `xl` | max-w-4xl | 896px |
| `2xl` | max-w-5xl | 1024px |
| `3xl` | max-w-6xl | 1152px |
| `full` | max-w-7xl | 1280px |

也支持自定义宽度值（如 `1024px`、`80rem`），移动端会自动撑满屏幕：

```yaml
---
page-width: 1200px
---
```
### 不要无编码原则

- MDX 不存放任何需要查 `refs/` 才能理解的魔术数字
- `prototype_id` 例外——它是武器身份标识，必须保留
- 新加武器时，从 refs 提取数据填入 MDX，不写 `numerical_id` 外键
### 武器 Frontmatter 扩展

武器 MDX 除通用字段外，支持以下字段（配合 `lib/weapons.ts` 的 `transformWeapon` 使用）：

| 字段 | 类型 | 默认值 | 说明 |
| :--- | :--- | :--- | :--- |
| `prototype_id` | string | - | WeaponPrototypeConfig 的 PrototypeID，用于匹配游戏数据 |
| `damage_label` | number | `0` | 非主模式伤害标签：`0`=命中伤害，`1`=爆炸伤害，`2`=自定义 |
| `damage_label_text` | string | `"爆炸伤害"` | `damage_label=2` 时的自定义标签文字 |
| `extra_modes` | array | - | 不在 WeaponPrototypeConfig 中的技能模式。每项：`name`(模式名)、`numerical_id`(NumericalID)、`fire_interval`(可选，默认继承主模式射速) |

示例：
```yaml
extra_modes:
  - name: 浮游模式
    numerical_id: 120700152
    fire_interval: 0.65
```

### 武器数据管线

`lib/weapons.ts` 的 `transformWeapon` 优先从游戏解包数据注入数值，查不到则回退 MDX 旧字段：

1. MDX `title` → `WeaponPrototypeConfig` → `ASCTypeID` + `NumericalID`
2. `ASCTypeID` → `attr_weapon_asc`（射速/弹匣/弹丸）+ `WeaponFeelParamTable`（换弹）
3. `NumericalID` → `numerical_config_composite`（伤害/元素/弱点/破韧）

`lib/weapon-data.ts` 提供三个手动覆盖表，处理游戏数据与社区约定的差异：

| 覆盖表 | 作用 | 示例 |
| :--- | :--- | :--- |
| `MODE_NAME_OVERRIDES` | 模式显示名 | `精绝兽神: {0:"速射模式",1:"爆发模式",2:"秘法榴弹"}` |
| `SKILL_NUMERICAL_OVERRIDES` | 技能伤害用不同 NumericalID | `精绝兽神: {2:120100242}`（秘法榴弹读 WeaponSkillDamage 表） |
| 模式分类规则 | 与主模式不同 NumericalID → `damageModes`；相同 → `extraModes`（技能/特殊攻击） |

## MDX 组件

### VideoGif

以类似 GIF 的方式展示 mp4 视频（自动播放、循环、静音、无控制栏）。视频文件放在 `public/videos/` 目录下。

```mdx
<VideoGif src="/videos/snake-god-slash.mp4" />
<VideoGif src="/videos/demo.mp4" alt="技能演示" width={400} />
```

| 属性 | 类型 | 必填 | 说明 |
| :--- | :--- | :--- | :--- |
| `src` | string | 是 | mp4 路径，如 `"/videos/xxx.mp4"` |
| `alt` | string | 否 | 无障碍描述 |
| `width` | number | 否 | 视频宽度（px） |

## GitHub Pages 图片路径

部署到 GitHub Pages 时，URL 为 `qiekn.github.io/nzm-wiki`，需要处理 basePath。

**重要：所有图片路径必须使用 `getAssetPath()` 函数包装！**

```typescript
import { getAssetPath } from "@/lib/path";

// 正确
<Image src={getAssetPath("/icons/elements/fire.png")} ... />
<Image src={getAssetPath(weapon.image)} ... />

// 错误 - 不要直接使用路径
<Image src="/icons/elements/fire.png" ... />
<Image src={weapon.image} ... />
```

工作原理：
- `lib/path.ts` 中的 `getAssetPath()` 会自动添加 basePath 前缀
- 本地开发：basePath 为空，路径为 `/icons/...`
- GitHub Pages：basePath 为 `/nzm-wiki`，路径为 `/nzm-wiki/icons/...`

## 搜索功能

使用 `Ctrl+P`（Mac 为 `Cmd+P`）打开全局搜索。

搜索会匹配以下内容：
- `title` - 页面标题
- `keywords` - 自定义搜索关键词
- 文件名
- `nickname` - 别名（陷阱、敌人等）
- `tags` - 标签（武器）
- `weapon_type` - 武器类型
- `element` - 元素类型
- `rarity` - 稀有度

支持拼音首字母搜索（常用字）。

### 自定义搜索关键词

在 MDX frontmatter 中添加 `keywords` 字段：

```yaml
---
title: 首领血量
keywords:
  - boss hp
  - 血量表
  - 猎场boss
---
```

### 生成搜索索引

搜索索引在构建时自动生成。手动生成：

```bash
pnpm search-index
```

## SEO

主域名为 `https://nzm-wiki.pages.dev`（Cloudflare Pages），所有 canonical URL 以此为基准。

### 修改路由或页面结构时必须同步更新：

1. **`scripts/generate-sitemap.ts`** — `pathMap` 对象和 `staticPages` 数组需要与实际路由保持一致
2. **`scripts/generate-search-index.ts`** — `pathMap` 和 `categoryMap` 同理
3. **新的详情页（动态路由）** 必须导出 `generateMetadata()` 函数，包含 `title`、`description`、`alternates.canonical`
4. **新的列表页（静态路由）** 需要手动加入 `generate-sitemap.ts` 的 `staticPages`

### 现有 SEO 配置

| 文件 | 作用 |
| :--- | :--- |
| `app/layout.tsx` | 全局 metadata（title template、metadataBase、OpenGraph） |
| `public/robots.txt` | 爬虫规则，指向 sitemap |
| `scripts/generate-sitemap.ts` | 构建时生成 `public/sitemap.xml` |
| 各 `[slug]/page.tsx` | 每个详情页的 `generateMetadata()` |


### generateMetadata 模板

```typescript
import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const { metadata } = getMDXDetail("folder", slug);
  const title = metadata.title || slug;
  return {
    title,
    description: `${title} — 逆战未来xxx详情`,
    alternates: { canonical: `/route/${slug}` },
  };
}
```
