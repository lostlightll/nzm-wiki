---
name: mdx-components
description: "nzm-wiki 可用的 MDX 组件参考。包含 Callout、Credit、VideoGif、DataTable、LevelTable、WeaponSkill、BossCard、BuffCard、TextStyle 等组件的用法和属性说明。"
---
# MDX 组件参考

在编写 MDX 内容时参考以下组件。每个组件的详细用法见对应文件。

| 组件 | 说明 | 文件 |
|---|---|---|
| TextStyle | 彩色文字（Red/Yellow/Green 等）、元素色（Fire/Ice 等）、高亮 | [text-style.md](text-style.md) |
| Callout | 提示框（6 色） | [callout.md](callout.md) |
| VideoGif | mp4 自动播放（类 GIF） | [video-gif.md](video-gif.md) |
| Credit | 致谢来源卡片（7 个平台） | [credit.md](credit.md) |
| LevelTable | 等级数据表（带色条） | [level-table.md](level-table.md) |
| DataTable | 通用数据表（支持图标列） | [data-table.md](data-table.md) |
| WeaponSkill | 武器技能展示（ActiveSkill / PassiveSkill） | [weapon-skill.md](weapon-skill.md) |
| GameMode / WeaponModeDiff | 武器页模式正文与 LC/TD 数值差异 | [weapon-game-mode.md](weapon-game-mode.md) |
| BossCard | Boss 卡片 / 网格 | [boss-card.md](boss-card.md) |
| BuffCard | Buff/Debuff 卡片系统 | [buff-card.md](buff-card.md) |

## 无属性工具组件

直接使用，无需传参：

```mdx
<AtkChart />
<CritCalculator />
<DamageCalculator />
<PeekabooGrid />
```
